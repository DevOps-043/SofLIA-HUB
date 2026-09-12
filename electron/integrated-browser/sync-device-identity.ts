import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { safeStorage } from 'electron';
import { assertSyncUuid, BrowserSyncError } from './sync-remote';

export interface BrowserSyncDeviceBinding { ownerId: string; sessionId: string; origin: string }
const queues = new Map<string, Promise<unknown>>();
function secure(): void {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw new BrowserSyncError('El almacén seguro del SO no está disponible.');
}
function failure(): BrowserSyncError { return new BrowserSyncError('No se pudo leer o guardar la identidad cifrada del dispositivo. Se conserva el archivo.'); }

/** ID aleatorio por sesión Auth. Persistir antes de registrar permite reintentos. */
export class BrowserSyncDeviceIdentity {
  constructor(private readonly destination: string) {}
  get(binding: BrowserSyncDeviceBinding): Promise<string | null> { const captured = { ...binding }; return this.atFile(() => this.read(captured)); }
  ensure(binding: BrowserSyncDeviceBinding, guard: () => void): Promise<string> {
    const captured = { ...binding };
    return this.atFile(async () => {
      guard(); secure();
      const previous = await this.read(captured);
      guard();
      if (previous) return previous;
      assertSyncUuid(captured.ownerId); assertSyncUuid(captured.sessionId);
      const id = randomUUID();
      const plaintext = JSON.stringify({ version: 1, scope: path.basename(path.dirname(this.destination)), ...captured, id });
      const encoded = JSON.stringify({ version: 1, protectedData: safeStorage.encryptString(plaintext).toString('base64') });
      const temporary = `${this.destination}.${randomUUID()}.tmp`;
      try {
        await fs.mkdir(path.dirname(this.destination), { recursive: true });
        const file = await fs.open(temporary, 'wx', 0o600);
        try { await file.writeFile(encoded, 'utf8'); await file.sync(); } finally { await file.close(); }
        guard(); await fs.rename(temporary, this.destination);
        return id;
      } catch { throw failure(); }
      finally { await fs.unlink(temporary).catch(() => undefined); }
    });
  }
  private atFile<T>(operation: () => Promise<T>): Promise<T> {
    const pending = (queues.get(this.destination) ?? Promise.resolve()).catch(() => undefined).then(operation);
    queues.set(this.destination, pending);
    void pending.finally(() => { if (queues.get(this.destination) === pending) queues.delete(this.destination); }).catch(() => undefined);
    return pending;
  }
  private async read(binding: BrowserSyncDeviceBinding): Promise<string | null> {
    secure();
    let file;
    try {
      file = await fs.open(this.destination, 'r');
      const buffer = Buffer.alloc(16_385); let size = 0;
      while (size < buffer.length) { const part = await file.read(buffer, size, buffer.length - size, null); if (!part.bytesRead) break; size += part.bytesRead; }
      if (size > 16_384) throw failure();
      const envelope = JSON.parse(buffer.subarray(0, size).toString('utf8')) as { version: number; protectedData: string };
      if (!envelope || Object.keys(envelope).sort().join(',') !== 'protectedData,version' || envelope.version !== 1 || typeof envelope.protectedData !== 'string') throw failure();
      const encrypted = Buffer.from(envelope.protectedData, 'base64');
      if (!encrypted.length || encrypted.toString('base64') !== envelope.protectedData) throw failure();
      const value = JSON.parse(safeStorage.decryptString(encrypted)) as BrowserSyncDeviceBinding & { version: number; scope: string; id: string };
      if (!value || Object.keys(value).sort().join(',') !== 'id,origin,ownerId,scope,sessionId,version' || value.version !== 1 || value.scope !== path.basename(path.dirname(this.destination))) throw failure();
      assertSyncUuid(value.id); assertSyncUuid(value.ownerId); assertSyncUuid(value.sessionId);
      if (typeof value.origin !== 'string') throw failure();
      return value.ownerId === binding.ownerId && value.sessionId === binding.sessionId && value.origin === binding.origin ? value.id : null;
    } catch (error) { if (!file && (error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw failure(); }
    finally { await file?.close(); }
  }
}
