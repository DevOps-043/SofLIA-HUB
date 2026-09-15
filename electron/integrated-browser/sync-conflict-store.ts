import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import { normalizeBrowserSyncInput } from './sync-crypto';
import { assertSyncRecoveryAvailable } from './sync-recovery-guard';
import type { BrowserSyncCategory } from './platform-types';
import { normalizeBrowserSyncMergeInput, reconcileBrowserSync, type BrowserSyncMergeInput, type BrowserSyncConflictChoice, type BrowserSyncMergeResult } from './sync-conflicts';

interface PendingReview { input: BrowserSyncMergeInput; choices: BrowserSyncConflictChoice[] }
interface Journal { version: 1; scope: string; reviews: PendingReview[] }
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = 28 * 1024 * 1024;
const queues = new Map<string, Promise<unknown>>();

function lock<T>(destination: string, operation: () => Promise<T>): Promise<T> {
  const pending = (queues.get(destination) ?? Promise.resolve()).catch(() => undefined).then(operation);
  queues.set(destination, pending);
  void pending.finally(() => { if (queues.get(destination) === pending) queues.delete(destination); }).catch(() => undefined);
  return pending;
}
function assertStorage(): void {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
    throw new Error('El almacenamiento seguro del sistema no está disponible para los conflictos.');
  }
}
function scopeFor(destination: string): string { return JSON.stringify([path.basename(path.dirname(destination)), path.basename(destination)]); }
function failure(): Error { return new Error('No se pudo leer o guardar la revisión cifrada de sincronización. Se conserva el archivo anterior.'); }

/** Diario local, no transportable: una revisión pendiente por categoría y perfil. */
export class BrowserSyncConflictStore {
  constructor(private readonly location: string | (() => string) = () => browserProfilePath('sync-conflicts.json')) {}

  list(): Promise<BrowserSyncMergeResult[]> {
    const destination = resolveStoreLocation(this.location);
    return lock(destination, async () => (await this.read(destination)).reviews.map((review) => reconcileBrowserSync(review.input, review.choices)));
  }

  prepare(raw: unknown, assertCurrent: () => void): Promise<BrowserSyncMergeResult> {
    const destination = resolveStoreLocation(this.location);
    // Capturar copias antes de ceder al caller o a otra operación de perfil.
    const input = normalizeBrowserSyncMergeInput(raw);
    const result = reconcileBrowserSync(input);
    return lock(destination, async () => {
      assertCurrent();
      const journal = await this.read(destination);
      const existing = journal.reviews.find((review) => review.input.category === input.category);
      if (existing) {
        const previous = reconcileBrowserSync(existing.input, existing.choices);
        assertCurrent();
        if (previous.reviewId !== result.reviewId) throw new Error('Ya existe una revisión pendiente para esta categoría. No se sobrescribió.');
        return previous;
      }
      journal.reviews.push({ input, choices: [] });
      await this.write(destination, journal, assertCurrent);
      return result;
    });
  }

  resolve(reviewId: string, rawChoices: readonly BrowserSyncConflictChoice[], assertCurrent: () => void): Promise<BrowserSyncMergeResult> {
    const destination = resolveStoreLocation(this.location);
    // Sólo elecciones local/remoto; nunca código ni valores arbitrarios del renderer.
    if (!Array.isArray(rawChoices) || rawChoices.length > 100_000) throw new Error('Las decisiones de sincronización son inválidas.');
    const choices = rawChoices.map((choice) => ({ ...choice }));
    return lock(destination, async () => {
      assertCurrent();
      const journal = await this.read(destination);
      const review = journal.reviews.find((entry) => reconcileBrowserSync(entry.input).reviewId === reviewId);
      if (!review) throw new Error('La revisión de sincronización ya no está disponible.');
      // La selección es completa: desmarcar vuelve a dejar el conflicto pendiente.
      const result = reconcileBrowserSync(review.input, choices);
      review.choices = choices;
      await this.write(destination, journal, assertCurrent);
      return result;
    });
  }

  /** Una edición local invalida las elecciones del contenido anterior, sin publicar datos. */
  refreshLocal(reviewId: string, raw: unknown, assertCurrent: () => void): Promise<BrowserSyncMergeResult> {
    const destination = resolveStoreLocation(this.location);
    const input = normalizeBrowserSyncMergeInput(raw);
    const next = reconcileBrowserSync(input);
    return lock(destination, async () => {
      assertCurrent();
      const journal = await this.read(destination);
      const index = journal.reviews.findIndex((review) => review.input.category === input.category);
      if (index < 0) throw new Error('La revisión pendiente no está disponible.');
      const previous = reconcileBrowserSync(journal.reviews[index].input, journal.reviews[index].choices);
      // Permite repetir tras guardar el diario y fallar el checkpoint, sin aceptar otra revisión.
      if (previous.reviewId === next.reviewId) return previous;
      if (previous.reviewId !== reviewId) throw new Error('La revisión cambió; no se reemplazaron sus decisiones.');
      journal.reviews[index] = { input, choices: [] };
      await this.write(destination, journal, assertCurrent);
      return next;
    });
  }

  /** Nueva base tras un CAS fallido; una decisión pendiente nunca se descarta. */
  rebase(reviewId: string, remote: { category: BrowserSyncCategory; revision: number; payload: unknown }, assertCurrent: () => void, appliedLocal?: unknown): Promise<BrowserSyncMergeResult> {
    const destination = resolveStoreLocation(this.location);
    const { category, payload } = normalizeBrowserSyncInput(remote);
    const revision = remote.revision;
    return lock(destination, async () => {
      assertCurrent();
      const journal = await this.read(destination);
      const index = journal.reviews.findIndex((entry) => reconcileBrowserSync(entry.input).reviewId === reviewId);
      if (index < 0) throw new Error('La revisión de sincronización ya no está disponible.');
      const previous = journal.reviews[index];
      const resolved = reconcileBrowserSync(previous.input, previous.choices);
      if (resolved.status !== 'ready' || !resolved.payload) throw new Error('Resuelve los conflictos pendientes antes de actualizar su base.');
      if (category !== previous.input.category) throw new Error('La categoría no corresponde a la revisión pendiente.');
      const input = normalizeBrowserSyncMergeInput({
        category, baseRevision: previous.input.remoteRevision, remoteRevision: revision,
        base: previous.input.remote, local: appliedLocal ?? resolved.payload, remote: payload,
      });
      const result = reconcileBrowserSync(input);
      journal.reviews[index] = { input, choices: [] };
      await this.write(destination, journal, assertCurrent);
      return result;
    });
  }

  /** Invocar sólo tras confirmar el commit remoto y el adaptador local (tarea 7.3). */
  acknowledge(reviewId: string, committedRevision: number, assertCurrent: () => void): Promise<void> {
    const destination = resolveStoreLocation(this.location);
    return lock(destination, async () => {
      assertCurrent();
      const journal = await this.read(destination);
      const index = journal.reviews.findIndex((entry) => reconcileBrowserSync(entry.input).reviewId === reviewId);
      if (index < 0) throw new Error('La revisión de sincronización ya no está disponible.');
      const review = journal.reviews[index];
      if (reconcileBrowserSync(review.input, review.choices).status !== 'ready'
        || !Number.isSafeInteger(committedRevision) || committedRevision !== review.input.remoteRevision + 1) {
        throw new Error('No se puede retirar una revisión pendiente o sin commit confirmado.');
      }
      journal.reviews.splice(index, 1);
      await this.write(destination, journal, assertCurrent);
    });
  }

  async flush(): Promise<void> { await queues.get(resolveStoreLocation(this.location)); }

  private async read(destination: string): Promise<Journal> {
    assertStorage();
    assertSyncRecoveryAvailable(path.dirname(destination));
    const scope = scopeFor(destination);
    let file;
    try {
      const expected = await fs.lstat(destination);
      if (!expected.isFile() || expected.isSymbolicLink() || expected.size > MAX_FILE_BYTES) throw failure();
      file = await fs.open(destination, 'r');
      const stat = await file.stat();
      if (!stat.isFile() || stat.ino !== expected.ino || stat.size > MAX_FILE_BYTES) throw failure();
      // Acotar también si un proceso externo hace crecer el archivo tras stat.
      const buffer = Buffer.alloc(stat.size + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > stat.size) throw failure();
      const encoded: unknown = JSON.parse(buffer.subarray(0, length).toString('utf8'));
      if (!encoded || typeof encoded !== 'object' || Array.isArray(encoded)) throw failure();
      const envelope = encoded as { version?: unknown; protectedData?: unknown };
      if (Object.keys(envelope).length !== 2 || envelope.version !== 1 || typeof envelope.protectedData !== 'string') throw failure();
      const protectedData = Buffer.from(envelope.protectedData, 'base64');
      if (!protectedData.length || protectedData.toString('base64') !== envelope.protectedData) throw failure();
      const plaintext = safeStorage.decryptString(protectedData);
      if (Buffer.byteLength(plaintext, 'utf8') > MAX_PLAINTEXT_BYTES) throw failure();
      const parsed = validateSyncConflictJournal(JSON.parse(plaintext), destination);
      assertSyncRecoveryAvailable(path.dirname(destination)); return parsed;
    } catch (error) {
      if (!file && (error as NodeJS.ErrnoException).code === 'ENOENT') { assertSyncRecoveryAvailable(path.dirname(destination)); return { version: 1, scope, reviews: [] }; }
      throw failure();
    } finally { await file?.close(); }
  }

  private async write(destination: string, journal: Journal, assertCurrent: () => void): Promise<void> {
    assertStorage();
    const plaintext = JSON.stringify(journal);
    if (Buffer.byteLength(plaintext, 'utf8') > MAX_PLAINTEXT_BYTES) throw new Error('El diario de conflictos supera la cuota local.');
    let encoded: string;
    try { encoded = JSON.stringify({ version: 1, protectedData: safeStorage.encryptString(plaintext).toString('base64') }); }
    catch { throw failure(); }
    if (Buffer.byteLength(encoded, 'utf8') > MAX_FILE_BYTES) throw new Error('El diario de conflictos supera la cuota local.');
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      assertCurrent();
      assertSyncRecoveryAvailable(path.dirname(destination));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const file = await fs.open(temporary, 'wx', 0o600);
      try { await file.writeFile(encoded, 'utf8'); await file.sync(); } finally { await file.close(); }
      assertCurrent();
      assertSyncRecoveryAvailable(path.dirname(destination));
      await fs.rename(temporary, destination);
    } catch (error) {
      // No incluir valores, rutas ni errores nativos en el contrato hacia UI.
      if (error instanceof Error && error.message === 'El contexto de sincronización cambió.') throw error;
      throw failure();
    } finally { await fs.unlink(temporary).catch(() => undefined); }
  }
}
export function validateSyncConflictJournal(raw: unknown, destination: string): Journal {
  const parsed = raw as Journal;
  if (!parsed || Object.keys(parsed).sort().join(',') !== 'reviews,scope,version' || parsed.version !== 1
    || parsed.scope !== scopeFor(destination) || !Array.isArray(parsed.reviews) || parsed.reviews.length > 4) throw failure();
  const categories = new Set<string>();
  for (const review of parsed.reviews) {
    if (!review || Object.keys(review).sort().join(',') !== 'choices,input' || !Array.isArray(review.choices)) throw failure();
    review.input = normalizeBrowserSyncMergeInput(review.input); reconcileBrowserSync(review.input, review.choices);
    if (categories.has(review.input.category)) throw failure(); categories.add(review.input.category);
  }
  return parsed;
}
