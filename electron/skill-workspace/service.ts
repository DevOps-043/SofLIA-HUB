import { app, shell } from 'electron';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { hasAllowedExtension, resolveInsideWorkspace } from './paths';
import type {
  SkillWorkspaceFile,
  SkillWorkspacePolicyInput,
  SkillWorkspaceProgressEvent,
  SkillWorkspaceRecord,
  SkillWorkspaceResult,
  SkillWorkspaceState,
} from './types';

/**
 * Espacios de trabajo aislados donde una Skill del sistema escribe su
 * entregable. Toda operacion valida la ruta contra la raiz real del
 * workspace antes de tocar el disco (ver `paths.ts`).
 *
 * El indice de workspaces vive en un JSON bajo `userData`: no necesita
 * Supabase porque los archivos son locales y no se sincronizan.
 */

const INDEX_FILE = 'workspaces.json';
const WORKSPACES_DIRNAME = 'skill-workspaces';
/** Cota de archivos por workspace: evita que un bucle del modelo lo llene. */
const MAX_FILES_PER_WORKSPACE = 60;
/** Cota por imagen. Una ilustracion de fondo razonable no llega a esto. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Formatos que se aceptan como imagen del workspace. */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

interface WorkspaceEntry extends SkillWorkspaceRecord {
  rootFolder: string;
  allowedExtensions: string[];
  maxFileBytes: number;
  maxWorkspaceBytes: number;
  protectedFiles: string[];
}

export class SkillWorkspaceService extends EventEmitter {
  private entries = new Map<string, WorkspaceEntry>();
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly baseDir = path.join(app.getPath('userData'), WORKSPACES_DIRNAME)) {
    super();
  }

  /** Raiz de todos los workspaces. La usa el protocolo local para servir archivos. */
  getBaseDir(): string {
    return this.baseDir;
  }

  async createWorkspace(input: {
    skillId: string;
    title: string;
    conversationId?: string | null;
    policy: SkillWorkspacePolicyInput;
  }): Promise<SkillWorkspaceResult<SkillWorkspaceRecord>> {
    await this.ensureLoaded();
    const id = `${slugify(input.title) || 'presentacion'}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const entry: WorkspaceEntry = {
      id,
      skillId: input.skillId,
      conversationId: input.conversationId ?? null,
      title: input.title.trim() || 'Presentacion',
      entryFile: input.policy.entryFile,
      createdAt: now,
      updatedAt: now,
      rootFolder: input.policy.rootFolder,
      allowedExtensions: [...input.policy.allowedExtensions],
      maxFileBytes: input.policy.maxFileBytes,
      maxWorkspaceBytes: input.policy.maxWorkspaceBytes,
      protectedFiles: [...(input.policy.protectedFiles ?? [])],
    };

    try {
      await fs.mkdir(this.rootOf(entry), { recursive: true });
    } catch (error) {
      return { ok: false, error: `No se pudo crear el espacio de trabajo: ${describeError(error)}` };
    }

    this.entries.set(id, entry);
    await this.persist();
    return { ok: true, data: toRecord(entry) };
  }

  /** Workspace mas reciente asociado a una conversacion, para retomarla. */
  async findByConversation(conversationId: string): Promise<SkillWorkspaceRecord | null> {
    await this.ensureLoaded();
    const matches = [...this.entries.values()]
      .filter((entry) => entry.conversationId === conversationId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    return matches[0] ? toRecord(matches[0]) : null;
  }

  async getState(workspaceId: string): Promise<SkillWorkspaceResult<SkillWorkspaceState>> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return entry;

    const files = await this.listFilesUnsafe(entry.data);
    const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    return {
      ok: true,
      data: {
        workspace: toRecord(entry.data),
        files,
        totalBytes,
        ready: files.some((file) => file.path === entry.data.entryFile),
      },
    };
  }

  async listFiles(workspaceId: string): Promise<SkillWorkspaceResult<SkillWorkspaceFile[]>> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return entry;
    return { ok: true, data: await this.listFilesUnsafe(entry.data) };
  }

  async readFile(workspaceId: string, relativePath: string): Promise<SkillWorkspaceResult<string>> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return entry;

    const resolved = await resolveInsideWorkspace(this.rootOf(entry.data), relativePath, { mustExist: true });
    if (!resolved.ok) return { ok: false, error: resolved.message };

    try {
      return { ok: true, data: await fs.readFile(resolved.absolutePath, 'utf-8') };
    } catch (error) {
      return { ok: false, error: `No se pudo leer el archivo: ${describeError(error)}` };
    }
  }

  /** Escritura solicitada por el MODELO. No puede tocar archivos protegidos. */
  async writeFile(
    workspaceId: string,
    relativePath: string,
    content: string,
  ): Promise<SkillWorkspaceResult<SkillWorkspaceFile>> {
    return this.writeFileInternal(workspaceId, relativePath, content, false);
  }

  /**
   * Escritura solicitada por el SISTEMA (main). Puede escribir los archivos
   * protegidos, como la hoja de variables de marca, que el modelo no debe
   * poder reescribir.
   */
  async writeSystemFile(
    workspaceId: string,
    relativePath: string,
    content: string,
  ): Promise<SkillWorkspaceResult<SkillWorkspaceFile>> {
    return this.writeFileInternal(workspaceId, relativePath, content, true);
  }

  /**
   * Escribe una imagen en `assets/`. Camino aparte del de texto porque las
   * imagenes no estan en la allowlist de extensiones de la Skill: el modelo
   * no puede escribir binarios arbitrarios, solo pedir que se guarde una
   * imagen generada o descargada, y siempre bajo `assets/`.
   */
  async writeImage(
    workspaceId: string,
    fileName: string,
    data: Buffer,
  ): Promise<SkillWorkspaceResult<SkillWorkspaceFile>> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return entry;

    const limpio = sanitizeImageName(fileName);
    if (!limpio) {
      return this.fail(workspaceId, 'escritura', fileName, 'Nombre de imagen invalido. Usa solo letras, numeros y guiones.');
    }

    const relativePath = `assets/${limpio}`;
    if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES) {
      return this.fail(workspaceId, 'escritura', relativePath, `La imagen supera el limite de ${formatBytes(MAX_IMAGE_BYTES)}.`);
    }

    const resolved = await resolveInsideWorkspace(this.rootOf(entry.data), relativePath, { mustExist: false });
    if (!resolved.ok) return this.fail(workspaceId, 'escritura', relativePath, resolved.message);

    const presupuesto = await this.checkBudget(entry.data, relativePath, data.byteLength);
    if (presupuesto) return this.fail(workspaceId, 'escritura', relativePath, presupuesto);

    this.emitProgress({ workspaceId, operation: 'escritura', path: relativePath, status: 'en_curso' });
    try {
      await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
      const temporal = `${resolved.absolutePath}.parcial`;
      await fs.writeFile(temporal, data);
      await fs.rename(temporal, resolved.absolutePath);
    } catch (error) {
      return this.fail(workspaceId, 'escritura', relativePath, `No se pudo guardar la imagen: ${describeError(error)}`);
    }

    await this.touch(entry.data);
    const file: SkillWorkspaceFile = {
      path: relativePath,
      bytes: data.byteLength,
      updatedAt: new Date().toISOString(),
    };
    this.emitProgress({ workspaceId, operation: 'escritura', path: relativePath, status: 'completado', bytes: file.bytes });
    return { ok: true, data: file };
  }

  /** Raiz absoluta del workspace. Uso interno de main; nunca sale al renderer. */
  async resolveWorkspaceRoot(workspaceId: string): Promise<string | null> {
    const entry = await this.requireEntry(workspaceId);
    return entry.ok ? this.rootOf(entry.data) : null;
  }

  private async writeFileInternal(
    workspaceId: string,
    relativePath: string,
    content: string,
    fromSystem: boolean,
  ): Promise<SkillWorkspaceResult<SkillWorkspaceFile>> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return entry;

    const resolved = await resolveInsideWorkspace(this.rootOf(entry.data), relativePath, { mustExist: false });
    if (!resolved.ok) return this.fail(workspaceId, 'escritura', relativePath, resolved.message);

    if (!fromSystem && isProtected(entry.data, resolved.relativePath)) {
      return this.fail(
        workspaceId,
        'escritura',
        resolved.relativePath,
        `${resolved.relativePath} lo gestiona el sistema y no puede modificarse.`,
      );
    }

    if (!hasAllowedExtension(resolved.relativePath, entry.data.allowedExtensions)) {
      return this.fail(
        workspaceId,
        'escritura',
        resolved.relativePath,
        `Esta skill solo puede escribir archivos ${entry.data.allowedExtensions.join(', ')}.`,
      );
    }

    const bytes = Buffer.byteLength(content, 'utf-8');
    if (bytes > entry.data.maxFileBytes) {
      return this.fail(
        workspaceId,
        'escritura',
        resolved.relativePath,
        `El archivo supera el limite de ${formatBytes(entry.data.maxFileBytes)}.`,
      );
    }

    const budget = await this.checkBudget(entry.data, resolved.relativePath, bytes);
    if (budget) return this.fail(workspaceId, 'escritura', resolved.relativePath, budget);

    this.emitProgress({ workspaceId, operation: 'escritura', path: resolved.relativePath, status: 'en_curso' });

    try {
      await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
      // Escritura atomica: un fallo a mitad no deja un archivo truncado que
      // el panel mostraria como contenido valido.
      const temporal = `${resolved.absolutePath}.parcial`;
      await fs.writeFile(temporal, content, 'utf-8');
      await fs.rename(temporal, resolved.absolutePath);
    } catch (error) {
      return this.fail(workspaceId, 'escritura', resolved.relativePath, `No se pudo escribir: ${describeError(error)}`);
    }

    await this.touch(entry.data);
    const file: SkillWorkspaceFile = {
      path: resolved.relativePath,
      bytes,
      updatedAt: new Date().toISOString(),
    };
    this.emitProgress({ workspaceId, operation: 'escritura', path: file.path, status: 'completado', bytes });
    return { ok: true, data: file };
  }

  /**
   * Edicion por reemplazo exacto. Falla SIN modificar el archivo cuando el
   * fragmento no existe o aparece mas de una vez: una coincidencia ambigua
   * resuelta en silencio destruiria contenido que el usuario no pidio tocar.
   */
  async editFile(
    workspaceId: string,
    relativePath: string,
    search: string,
    replace: string,
    replaceAll = false,
  ): Promise<SkillWorkspaceResult<SkillWorkspaceFile>> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return entry;

    if (!search) return this.fail(workspaceId, 'edicion', relativePath, 'El fragmento a reemplazar esta vacio.');

    if (isProtected(entry.data, normalizeForComparison(relativePath))) {
      return this.fail(
        workspaceId,
        'edicion',
        relativePath,
        `${relativePath} lo gestiona el sistema y no puede modificarse.`,
      );
    }

    const resolved = await resolveInsideWorkspace(this.rootOf(entry.data), relativePath, { mustExist: true });
    if (!resolved.ok) return this.fail(workspaceId, 'edicion', relativePath, resolved.message);

    let original: string;
    try {
      original = await fs.readFile(resolved.absolutePath, 'utf-8');
    } catch (error) {
      return this.fail(workspaceId, 'edicion', resolved.relativePath, `No se pudo leer: ${describeError(error)}`);
    }

    const occurrences = countOccurrences(original, search);
    if (occurrences === 0) {
      // Un mensaje generico ("no existe, lee el archivo") produce reintentos a
      // ciegas: el modelo vuelve a adivinar y vuelve a fallar. El diagnostico
      // dice QUE hay realmente en el archivo, que es lo que permite corregir.
      return this.fail(workspaceId, 'edicion', resolved.relativePath, diagnoseMissingFragment(original, search));
    }
    if (occurrences > 1 && !replaceAll) {
      const lineas = occurrenceLines(original, search);
      return this.fail(
        workspaceId,
        'edicion',
        resolved.relativePath,
        `El fragmento aparece ${occurrences} veces (lineas ${lineas.join(', ')}). Amplia el contexto con la linea anterior o la siguiente para que sea unico, o pide reemplazar todas.`,
      );
    }

    const updated = replaceAll ? original.split(search).join(replace) : original.replace(search, replace);
    return this.writeFile(workspaceId, resolved.relativePath, updated);
  }

  async deleteFile(workspaceId: string, relativePath: string): Promise<SkillWorkspaceResult<true>> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return entry;

    const resolved = await resolveInsideWorkspace(this.rootOf(entry.data), relativePath, { mustExist: true });
    if (!resolved.ok) return this.fail(workspaceId, 'borrado', relativePath, resolved.message);

    if (isProtected(entry.data, resolved.relativePath)) {
      return this.fail(
        workspaceId,
        'borrado',
        resolved.relativePath,
        `${resolved.relativePath} lo gestiona el sistema y no puede eliminarse.`,
      );
    }

    try {
      await fs.rm(resolved.absolutePath, { force: true });
    } catch (error) {
      return this.fail(workspaceId, 'borrado', resolved.relativePath, `No se pudo borrar: ${describeError(error)}`);
    }

    await this.touch(entry.data);
    this.emitProgress({ workspaceId, operation: 'borrado', path: resolved.relativePath, status: 'completado' });
    return { ok: true, data: true };
  }

  /** Abre la carpeta del workspace en el explorador del sistema operativo. */
  async openFolder(workspaceId: string): Promise<SkillWorkspaceResult<true>> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return entry;

    const error = await shell.openPath(this.rootOf(entry.data));
    if (error) return { ok: false, error };
    return { ok: true, data: true };
  }

  /**
   * Ruta absoluta de un archivo del workspace. Solo para uso interno de main
   * (exportacion a PDF, protocolo local): nunca se expone al renderer.
   */
  async resolveAbsolutePath(workspaceId: string, relativePath: string): Promise<string | null> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return null;
    const resolved = await resolveInsideWorkspace(this.rootOf(entry.data), relativePath, { mustExist: true });
    return resolved.ok ? resolved.absolutePath : null;
  }

  async getWorkspace(workspaceId: string): Promise<SkillWorkspaceRecord | null> {
    await this.ensureLoaded();
    const entry = this.entries.get(workspaceId);
    return entry ? toRecord(entry) : null;
  }

  async deleteWorkspace(workspaceId: string): Promise<SkillWorkspaceResult<true>> {
    const entry = await this.requireEntry(workspaceId);
    if (!entry.ok) return entry;

    try {
      await fs.rm(this.rootOf(entry.data), { recursive: true, force: true });
    } catch (error) {
      return { ok: false, error: `No se pudo eliminar el espacio de trabajo: ${describeError(error)}` };
    }

    this.entries.delete(workspaceId);
    await this.persist();
    return { ok: true, data: true };
  }

  // -------------------------------------------------------------------

  private rootOf(entry: WorkspaceEntry): string {
    return path.join(this.baseDir, entry.rootFolder, entry.id);
  }

  private async requireEntry(workspaceId: string): Promise<SkillWorkspaceResult<WorkspaceEntry>> {
    await this.ensureLoaded();
    const entry = this.entries.get(String(workspaceId ?? '').trim());
    if (!entry) return { ok: false, error: 'El espacio de trabajo no existe o ya se cerro.' };
    return { ok: true, data: entry };
  }

  private async listFilesUnsafe(entry: WorkspaceEntry): Promise<SkillWorkspaceFile[]> {
    const root = this.rootOf(entry);
    const files: SkillWorkspaceFile[] = [];

    const walk = async (current: string, prefix: string): Promise<void> => {
      let items: import('node:fs').Dirent[];
      try {
        items = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const item of items) {
        if (item.name.endsWith('.parcial')) continue;
        const relative = prefix ? `${prefix}/${item.name}` : item.name;
        // No se siguen enlaces al listar: un enlace dentro del workspace
        // podria exponer el arbol externo al que apunta.
        if (item.isSymbolicLink()) continue;
        if (item.isDirectory()) {
          await walk(path.join(current, item.name), relative);
          continue;
        }
        if (!item.isFile()) continue;
        try {
          const stats = await fs.stat(path.join(current, item.name));
          files.push({ path: relative, bytes: stats.size, updatedAt: stats.mtime.toISOString() });
        } catch {
          // Un archivo que desaparece a mitad del listado no invalida el resto.
        }
      }
    };

    await walk(root, '');
    return files.sort((left, right) => left.path.localeCompare(right.path));
  }

  private async checkBudget(entry: WorkspaceEntry, relativePath: string, incomingBytes: number): Promise<string | null> {
    const files = await this.listFilesUnsafe(entry);
    const isNew = !files.some((file) => file.path === relativePath);
    if (isNew && files.length >= MAX_FILES_PER_WORKSPACE) {
      return `El espacio de trabajo alcanzo su limite de ${MAX_FILES_PER_WORKSPACE} archivos.`;
    }
    const currentBytes = files
      .filter((file) => file.path !== relativePath)
      .reduce((sum, file) => sum + file.bytes, 0);
    if (currentBytes + incomingBytes > entry.maxWorkspaceBytes) {
      return `El espacio de trabajo alcanzo su limite de ${formatBytes(entry.maxWorkspaceBytes)}.`;
    }
    return null;
  }

  private fail<T>(
    workspaceId: string,
    operation: SkillWorkspaceProgressEvent['operation'],
    filePath: string,
    message: string,
  ): SkillWorkspaceResult<T> {
    this.emitProgress({ workspaceId, operation, path: filePath, status: 'error', message });
    return { ok: false, error: message };
  }

  private emitProgress(event: SkillWorkspaceProgressEvent): void {
    this.emit('progreso', event);
  }

  private async touch(entry: WorkspaceEntry): Promise<void> {
    entry.updatedAt = new Date().toISOString();
    await this.persist();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.readFile(path.join(this.baseDir, INDEX_FILE), 'utf-8');
      const parsed = JSON.parse(raw) as WorkspaceEntry[];
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry?.id) this.entries.set(entry.id, entry);
        }
      }
    } catch {
      // Sin indice previo: es el primer arranque.
    }
  }

  private async persist(): Promise<void> {
    const snapshot = [...this.entries.values()];
    const pending = this.writeQueue.then(async () => {
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.writeFile(path.join(this.baseDir, INDEX_FILE), JSON.stringify(snapshot, null, 2), 'utf-8');
    });
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }
}

function toRecord(entry: WorkspaceEntry): SkillWorkspaceRecord {
  return {
    id: entry.id,
    skillId: entry.skillId,
    conversationId: entry.conversationId,
    title: entry.title,
    entryFile: entry.entryFile,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/**
 * Un archivo protegido lo escribe el sistema y el modelo no puede tocarlo.
 * La comparacion normaliza separadores y mayusculas porque el modelo puede
 * referirse al mismo archivo de varias formas.
 */
function isProtected(entry: WorkspaceEntry, relativePath: string): boolean {
  const target = normalizeForComparison(relativePath);
  return entry.protectedFiles.some((protectedPath) => normalizeForComparison(protectedPath) === target);
}

function normalizeForComparison(value: string): string {
  return String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '').trim().toLowerCase();
}

const NEWLINE = String.fromCharCode(10);

/**
 * Explica por que no se encontro el fragmento, con lo que hay de verdad en el
 * archivo. Sin esto, el modelo repetia la misma edicion una y otra vez.
 */
function diagnoseMissingFragment(original: string, search: string): string {
  const compacto = (valor: string) => valor.replace(/\s+/g, ' ').trim();
  const buscadoCompacto = compacto(search);

  // Caso frecuente: el fragmento ESTA, pero con otros espacios o saltos de
  // linea. Decirlo evita que el modelo cambie el contenido en vez del formato.
  if (buscadoCompacto && compacto(original).includes(buscadoCompacto)) {
    return 'El fragmento existe pero con otros espacios o saltos de linea. Vuelve a leer el archivo y copia el texto EXACTO, con su sangria y sus saltos.';
  }

  // Si la primera linea si aparece, se devuelve el contexto real de esa zona:
  // casi siempre el error esta en las lineas siguientes.
  const primeraLinea = search.split(NEWLINE).map((linea) => linea.trim()).find(Boolean) ?? '';
  if (primeraLinea.length >= 8) {
    const lineas = original.split(NEWLINE);
    const indice = lineas.findIndex((linea) => linea.includes(primeraLinea));
    if (indice !== -1) {
      const desde = Math.max(0, indice - 1);
      const contexto = lineas
        .slice(desde, Math.min(lineas.length, indice + 6))
        .map((linea, posicion) => `${desde + posicion + 1}: ${linea}`)
        .join(NEWLINE);
      return `El fragmento no coincide. Esto es lo que hay en el archivo alrededor de esa zona:${NEWLINE}${contexto}${NEWLINE}Copia el texto tal cual de aqui.`;
    }
  }

  return 'El fragmento no existe en el archivo. Llama a workspace_read_file y copia el texto exacto antes de volver a editar; no vuelvas a intentarlo adivinando.';
}

/** Lineas (1-indexadas) donde aparece el fragmento, para desambiguar. */
function occurrenceLines(original: string, search: string): number[] {
  const lineas: number[] = [];
  let desde = 0;
  for (;;) {
    const indice = original.indexOf(search, desde);
    if (indice === -1) break;
    lineas.push(original.slice(0, indice).split(NEWLINE).length);
    desde = indice + search.length;
    if (lineas.length >= 6) break;
  }
  return lineas;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Normaliza el nombre propuesto por el modelo: sin rutas, sin acentos y con
 * una extension de imagen conocida. Devuelve cadena vacia si no queda nada
 * utilizable, en vez de inventar un nombre.
 */
function sanitizeImageName(value: string): string {
  const base = String(value ?? '').split(/[\\/]/).pop() ?? '';
  const extension = path.extname(base).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return '';

  const nombre = slugify(base.slice(0, base.length - extension.length));
  return nombre ? `${nombre}${extension}` : '';
}

function slugify(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
