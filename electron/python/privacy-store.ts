import fs, { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrivacyConfig } from '../../src/shared/python-tools';
import { PythonToolsError } from './tools-error';
export class PrivacyPersistenceError extends PythonToolsError {
  constructor(readonly uncertain: boolean, cause: unknown, readonly cleanupPending = false) { super('PRIVACY_WRITE_FAILED', cause); }
}

export function parsePrivacyConfig(value: unknown): PrivacyConfig {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== 1) throw new Error('PRIVACY_CONFIG_INVALID');
  const descriptor = Object.getOwnPropertyDescriptor(value, 'redactDocuments');
  if (!descriptor || typeof descriptor.value !== 'boolean') throw new Error('PRIVACY_CONFIG_INVALID');
  return { redactDocuments: descriptor.value };
}

/** Configuración de máquina. Se publica únicamente después de confirmar el rename. */
export class PythonPrivacyStore {
  private current: PrivacyConfig | null = null;
  private revision = 0;
  constructor(private readonly getPath: () => string, private readonly changed: () => void = () => {}) {}
  get(): PrivacyConfig {
    if (this.current) return { ...this.current };
    let fd: number | undefined; let found = false;
    try {
      const file = this.getPath(); const before = fs.lstatSync(file);
      found = true;
      if (!before.isFile() || before.isSymbolicLink() || before.size > 1024) throw new Error('PRIVACY_CONFIG_INVALID');
      fd = fs.openSync(file, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW | constants.O_NONBLOCK));
      const opened = fs.fstatSync(fd);
      if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size > 1024) throw new Error('PRIVACY_CONFIG_INVALID');
      const bytes = Buffer.alloc(1025); let total = 0;
      while (total < bytes.length) { const read = fs.readSync(fd, bytes, total, bytes.length - total, total); if (!read) break; total += read; }
      if (total > 1024 || total !== opened.size) throw new Error('PRIVACY_CONFIG_INVALID');
      this.current = parsePrivacyConfig(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, total))));
    } catch (error) {
      if (!found && (error as NodeJS.ErrnoException)?.code === 'ENOENT') this.current = { redactDocuments: false };
      else throw new PythonToolsError('No se pudo cargar la configuración de privacidad.', error);
    } finally { if (fd !== undefined) fs.closeSync(fd); }
    return { ...this.current };
  }
  set(value: unknown): PrivacyConfig {
    const next = parsePrivacyConfig(value); const previous = this.get(); const file = this.getPath();
    const temporary = path.join(path.dirname(file), `.privacy-${randomUUID()}.tmp`); let fd: number | undefined;
    let created = false; let committed = false; let renameAttempted = false;
    let failure: PrivacyPersistenceError | undefined;
    try {
      fd = fs.openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
      created = true;
      fs.writeFileSync(fd, JSON.stringify(next) + '\n', 'utf8'); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      renameAttempted = true; fs.renameSync(temporary, file);
      committed = true;
    } catch (error) {
      if (renameAttempted) { this.current = null; this.revision++; this.changed(); }
      failure = new PrivacyPersistenceError(renameAttempted, error);
    }
    finally {
      try { if (fd !== undefined) fs.closeSync(fd); if (created && !committed) fs.rmSync(temporary, { force: true }); }
      catch (error) { failure = new PrivacyPersistenceError(renameAttempted, error, true); }
    }
    if (failure) throw failure;
    this.current = next;
    if (previous.redactDocuments !== next.redactDocuments) { this.revision++; this.changed(); }
    return { ...next };
  }
  capture() {
    const config = this.get(); const revision = this.revision;
    return { config, assertCurrent: () => { if (revision !== this.revision) throw new Error('PRIVACY_CHANGED'); } };
  }
}
