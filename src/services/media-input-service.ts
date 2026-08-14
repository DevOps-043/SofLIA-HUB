import { getApiKeyWithCache } from './api-keys';
import { GOOGLE_API_KEY } from '../config';
import type { MediaRef } from '../shared/multimodal-input';

/**
 * Wrapper tipado de la subida de medios.
 *
 * Ademas de cruzar el IPC, gobierna dos cosas que la capa de main no puede
 * decidir por si sola: el consentimiento antes de la primera transferencia de
 * la sesion, y la deteccion de una referencia caducada antes de reutilizarla.
 */

export type MediaUploadState = 'processing' | 'ready' | 'failed' | 'cancelled';

export interface MediaUploadRecord {
  uploadId: string;
  state: MediaUploadState;
  mimeType: string;
  displayName: string;
  uri?: string;
  expiresAt?: string;
  sizeBytes?: number;
  error?: string;
}

interface MediaInputApi {
  upload(input: { path: string; mimeType: string; apiKey: string }): Promise<{ success: boolean; upload?: MediaUploadRecord; error?: string }>;
  status(uploadId: string): Promise<{ success: boolean; upload?: MediaUploadRecord | null; error?: string }>;
  cancel(uploadId: string): Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
  release(uploadId: string, apiKey: string): Promise<{ success: boolean; released?: boolean; error?: string }>;
}

function api(): MediaInputApi | null {
  return (window as unknown as { mediaInput?: MediaInputApi }).mediaInput ?? null;
}

export function isMediaUploadAvailable(): boolean {
  return api() !== null;
}

/**
 * Consentimiento de salida de datos.
 *
 * El archivo deja el equipo y permanece temporalmente en la infraestructura del
 * proveedor. Se pregunta una vez por sesion: repetirlo por archivo convertiria
 * cada adjunto en una friccion, y no preguntarlo nunca ocultaria una
 * transferencia que el usuario no eligio.
 */
let uploadConsentGranted = false;

export function hasMediaUploadConsent(): boolean {
  return uploadConsentGranted;
}

export function grantMediaUploadConsent(): void {
  uploadConsentGranted = true;
}

export function resetMediaUploadConsent(): void {
  uploadConsentGranted = false;
}

export const MEDIA_UPLOAD_CONSENT_MESSAGE =
  'Para analizar este archivo debo enviarlo a la infraestructura del proveedor del modelo, '
  + 'donde permanece de forma temporal hasta caducar. ¿Lo envío?';

async function resolveApiKey(): Promise<string> {
  const guardada = await getApiKeyWithCache('google');
  return guardada || GOOGLE_API_KEY || '';
}

export async function uploadMedia(input: { path: string; mimeType: string }): Promise<MediaUploadRecord> {
  const bridge = api();
  if (!bridge) throw new Error('La subida de medios no esta disponible en esta superficie.');
  if (!uploadConsentGranted) throw new Error('Falta el consentimiento para enviar el archivo al proveedor.');

  const apiKey = await resolveApiKey();
  const result = await bridge.upload({ ...input, apiKey });
  if (!result.success || !result.upload) throw new Error(result.error || 'No pude subir el archivo.');
  return result.upload;
}

export async function cancelMediaUpload(uploadId: string): Promise<boolean> {
  const result = await api()?.cancel(uploadId);
  return Boolean(result?.success && result.cancelled);
}

export async function releaseMediaUpload(uploadId: string): Promise<boolean> {
  const bridge = api();
  if (!bridge) return false;
  const result = await bridge.release(uploadId, await resolveApiKey());
  return Boolean(result?.success && result.released);
}

/** ¿El proveedor ya dejo de servir esta referencia? */
export function isMediaReferenceExpired(record: Pick<MediaUploadRecord, 'expiresAt'>): boolean {
  if (!record?.expiresAt) return false;
  const vencimiento = Date.parse(record.expiresAt);
  return Number.isFinite(vencimiento) && vencimiento <= Date.now();
}

/**
 * Convierte una subida lista en el medio del turno. Una referencia caducada no
 * se envia: el proveedor devolveria un error opaco y el turno describiria un
 * archivo que ya no existe.
 */
export function toMediaRef(record: MediaUploadRecord, durationSeconds?: number): MediaRef | null {
  if (record.state !== 'ready' || !record.uri) return null;
  if (isMediaReferenceExpired(record)) return null;
  return { kind: 'remote', mimeType: record.mimeType, uri: record.uri, expiresAt: record.expiresAt, durationSeconds };
}
