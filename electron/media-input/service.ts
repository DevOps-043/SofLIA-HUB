import { createRequire } from 'node:module';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { MEDIA_BUDGET, isSupportedMediaMimeType } from '../../src/shared/multimodal-input';

/**
 * Subida de medios grandes a la API de archivos del proveedor.
 *
 * Vive en main y no en el renderer por dos razones. La primera es de memoria:
 * subir desde el renderer obliga a leer el archivo entero como `ArrayBuffer`, y
 * un video de cientos de megabytes no cabe en ese presupuesto. La segunda es de
 * superficie: la ruta local y la clave del proveedor no tienen por que cruzar
 * al renderer mas de lo que ya lo hacen.
 *
 * El SDK se carga perezosamente para degradar con elegancia si no estuviera
 * disponible, igual que el cliente de Computer Use.
 */

/** Un archivo subido deja de servirse pasado este plazo del proveedor. */
const PROVIDER_RETENTION_MS = 48 * 60 * 60 * 1000;
const PROCESSING_POLL_INTERVAL_MS = 1_500;
const PROCESSING_TIMEOUT_MS = 120_000;

export type MediaUploadState = 'processing' | 'ready' | 'failed' | 'cancelled';

export interface MediaUploadRecord {
  uploadId: string;
  state: MediaUploadState;
  mimeType: string;
  /** Nombre visible del archivo; nunca la ruta local completa. */
  displayName: string;
  uri?: string;
  expiresAt?: string;
  sizeBytes?: number;
  error?: string;
}

interface GenAiFile {
  name?: string;
  uri?: string;
  mimeType?: string;
  state?: string;
  sizeBytes?: string;
  expirationTime?: string;
  error?: { message?: string };
}

interface GenAiFilesApi {
  upload: (params: { file: string; config?: Record<string, unknown> }) => Promise<GenAiFile>;
  get: (params: { name: string }) => Promise<GenAiFile>;
  delete: (params: { name: string }) => Promise<unknown>;
}

interface GenAiClient { files: GenAiFilesApi }
interface GenAiModule { GoogleGenAI: new (opts: { apiKey: string }) => GenAiClient }

export function loadGenAiSdk(): GenAiModule | null {
  try {
    return createRequire(import.meta.url)('@google/genai') as GenAiModule;
  } catch {
    return null;
  }
}

export interface MediaInputServiceOptions {
  /** Inyectable para pruebas; por omision se carga @google/genai. */
  loadSdk?: () => GenAiModule | null;
  /** Inyectable para pruebas; por omision consulta el sistema de archivos. */
  statFile?: (path: string) => Promise<{ size: number }>;
  now?: () => number;
}

export class MediaInputService {
  private readonly uploads = new Map<string, MediaUploadRecord>();
  private readonly cancelled = new Set<string>();
  /** Nombre remoto por subida, para poder liberarlo despues. */
  private readonly remoteNames = new Map<string, string>();
  private clients = new Map<string, GenAiClient>();
  private sdk: GenAiModule | null | undefined;
  private sequence = 0;

  constructor(private readonly options: MediaInputServiceOptions = {}) {}

  disponible(): boolean {
    return Boolean(this.getSdk());
  }

  /**
   * Sube un archivo y espera a que el proveedor lo declare procesado.
   *
   * Nunca se queda esperando indefinidamente: un archivo que no termina de
   * procesarse aborta con su estado alcanzado, porque el turno del usuario
   * esta bloqueado detras de esta llamada.
   */
  async upload(input: { path: string; mimeType: string; apiKey: string }): Promise<MediaUploadRecord> {
    const uploadId = `media-${++this.sequence}-${Date.now()}`;
    const displayName = basename(String(input?.path || '')) || 'archivo';
    const mimeType = String(input?.mimeType || '').toLowerCase();

    if (!isSupportedMediaMimeType(mimeType)) {
      return this.record({ uploadId, state: 'failed', mimeType, displayName, error: `El formato ${mimeType || 'desconocido'} no puede analizarse.` });
    }

    let sizeBytes: number;
    try {
      sizeBytes = (await this.stat(input.path)).size;
    } catch {
      return this.record({ uploadId, state: 'failed', mimeType, displayName, error: 'El archivo ya no esta disponible.' });
    }
    if (sizeBytes > MEDIA_BUDGET.maxUploadBytes) {
      return this.record({ uploadId, state: 'failed', mimeType, displayName, sizeBytes, error: 'El archivo supera el tamaño maximo que admite el proveedor.' });
    }

    const client = this.ensureClient(input.apiKey);
    if (!client) {
      return this.record({ uploadId, state: 'failed', mimeType, displayName, sizeBytes, error: 'La subida de medios no esta disponible.' });
    }

    this.record({ uploadId, state: 'processing', mimeType, displayName, sizeBytes });

    let subido: GenAiFile;
    try {
      subido = await client.files.upload({ file: input.path, config: { mimeType, displayName } });
    } catch (error) {
      return this.record({ uploadId, state: 'failed', mimeType, displayName, sizeBytes, error: sanitizeProviderError(error) });
    }
    if (subido?.name) this.remoteNames.set(uploadId, subido.name);
    if (this.cancelled.has(uploadId)) return this.finishCancelled(uploadId, client);

    let archivo = subido;
    const limite = this.now() + PROCESSING_TIMEOUT_MS;
    while (archivo?.state === 'PROCESSING') {
      if (this.cancelled.has(uploadId)) return this.finishCancelled(uploadId, client);
      if (this.now() >= limite) {
        return this.record({ uploadId, state: 'failed', mimeType, displayName, sizeBytes, error: 'El proveedor no termino de procesar el archivo a tiempo.' });
      }
      await delay(PROCESSING_POLL_INTERVAL_MS);
      try {
        archivo = await client.files.get({ name: String(archivo.name || '') });
      } catch (error) {
        return this.record({ uploadId, state: 'failed', mimeType, displayName, sizeBytes, error: sanitizeProviderError(error) });
      }
    }

    if (this.cancelled.has(uploadId)) return this.finishCancelled(uploadId, client);
    if (archivo?.state === 'FAILED' || !archivo?.uri) {
      return this.record({
        uploadId, state: 'failed', mimeType, displayName, sizeBytes,
        error: sanitizeProviderError(archivo?.error?.message || 'El proveedor no pudo procesar el archivo.'),
      });
    }

    return this.record({
      uploadId,
      state: 'ready',
      mimeType: archivo.mimeType || mimeType,
      displayName,
      sizeBytes,
      uri: archivo.uri,
      expiresAt: archivo.expirationTime || new Date(this.now() + PROVIDER_RETENTION_MS).toISOString(),
    });
  }

  status(uploadId: string): MediaUploadRecord | null {
    return this.uploads.get(String(uploadId || '')) ?? null;
  }

  /**
   * Marca la subida como cancelada. El bucle de subida la observa en cada
   * punto de espera y suelta el archivo remoto si alcanzo a crearse.
   */
  cancel(uploadId: string): boolean {
    const id = String(uploadId || '');
    const registro = this.uploads.get(id);
    if (!registro || registro.state === 'ready' || registro.state === 'failed') return false;
    this.cancelled.add(id);
    this.record({ ...registro, state: 'cancelled', uri: undefined });
    return true;
  }

  /** Libera el archivo remoto al terminar o cancelarse el turno que lo consumia. */
  async release(uploadId: string, apiKey: string): Promise<boolean> {
    const id = String(uploadId || '');
    const remoteName = this.remoteNames.get(id);
    this.uploads.delete(id);
    this.cancelled.delete(id);
    this.remoteNames.delete(id);
    if (!remoteName) return false;
    const client = this.ensureClient(apiKey);
    if (!client) return false;
    try {
      await client.files.delete({ name: remoteName });
      return true;
    } catch {
      // El proveedor caduca el archivo por su cuenta; un fallo aqui no debe
      // romper el cierre del turno.
      return false;
    }
  }

  /** ¿La referencia sigue siendo utilizable, o el proveedor ya la caduco? */
  isExpired(record: Pick<MediaUploadRecord, 'expiresAt'>): boolean {
    if (!record?.expiresAt) return false;
    const vencimiento = Date.parse(record.expiresAt);
    return Number.isFinite(vencimiento) && vencimiento <= this.now();
  }

  private async finishCancelled(uploadId: string, client: GenAiClient): Promise<MediaUploadRecord> {
    const remoteName = this.remoteNames.get(uploadId);
    if (remoteName) {
      try { await client.files.delete({ name: remoteName }); } catch { /* mejor esfuerzo */ }
      this.remoteNames.delete(uploadId);
    }
    const registro = this.uploads.get(uploadId);
    return this.record({ ...(registro as MediaUploadRecord), uploadId, state: 'cancelled', uri: undefined });
  }

  private record(record: MediaUploadRecord): MediaUploadRecord {
    this.uploads.set(record.uploadId, record);
    // Una subida que ya no puede avanzar no necesita seguir en el conjunto de
    // canceladas: sin esto crecia indefinidamente durante toda la sesion, ya
    // que solo `release` lo limpiaba y el renderer no siempre lo llama.
    if (record.state === 'ready' || record.state === 'failed') this.cancelled.delete(record.uploadId);
    return record;
  }

  private ensureClient(apiKey: string): GenAiClient | null {
    const key = String(apiKey || '').trim();
    if (key.length < 20 || key.length > 512) return null;
    const existente = this.clients.get(key);
    if (existente) return existente;
    const mod = this.getSdk();
    if (!mod) return null;
    const client = new mod.GoogleGenAI({ apiKey: key });
    this.clients.set(key, client);
    return client;
  }

  private getSdk(): GenAiModule | null {
    if (this.sdk === undefined) this.sdk = (this.options.loadSdk ?? loadGenAiSdk)();
    return this.sdk;
  }

  private stat(path: string): Promise<{ size: number }> {
    return this.options.statFile ? this.options.statFile(path) : stat(path);
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }
}

/**
 * Nunca devolver al renderer la clave del proveedor ni la ruta local completa:
 * ambas aparecen en los mensajes de error crudos del SDK.
 */
export function sanitizeProviderError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Error desconocido');
  return raw
    .replace(/AIza[0-9A-Za-z_-]+/g, '[api-key]')
    .replace(/key=[^&\s]+/g, 'key=[api-key]')
    .replace(/[A-Za-z]:\\[^\s"']+/g, '[ruta-local]')
    .replace(/(?:\/[^\s"'/]+){2,}/g, '[ruta-local]')
    .slice(0, 300);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}
