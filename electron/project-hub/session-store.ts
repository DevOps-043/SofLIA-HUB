import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { systemCipher, type OsCipher } from '../storage/os-cipher';
import { readPrivateFile, replacePrivateFile } from '../storage/private-files';
import {
  MAX_PROJECT_HUB_CIPHER_BYTES, MAX_PROJECT_HUB_SESSION_BYTES, projectHubStoredCredentials, projectHubStoredPayload,
} from './session-contract';
import type { ProjectHubSession } from './types';

export type StoredProjectHubSession = Pick<ProjectHubSession, 'refreshToken' | 'workspaces'>;
const MAGIC = Buffer.from('SOFLIA-PROJECT-HUB-1\n');
interface StoreOptions { root?: () => string; cipher?: OsCipher; replace?: typeof replacePrivateFile }

/** Legado global conservado: no contiene un propietario verificable. */
export class ProjectHubSessionStore {
  private readonly root: () => string;
  private readonly cipher: OsCipher;
  private readonly replace: typeof replacePrivateFile;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(options: StoreOptions = {}) {
    this.root = options.root ?? (() => app.getPath('userData'));
    this.cipher = options.cipher ?? systemCipher;
    this.replace = options.replace ?? replacePrivateFile;
  }

  load(owner: string, assert: () => void): Promise<StoredProjectHubSession | null> {
    const file = this.file(owner);
    return this.run(async () => {
      assert();
      const directory = await this.directory(file); assert();
      if (!directory) return null;
      const bytes = await readPrivateFile(file, MAX_PROJECT_HUB_CIPHER_BYTES); assert();
      if (!bytes) return null;
      await this.available(assert);
      if (!bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Formato de sesión Project Hub inválido.');
      const decoded = await this.cipher.decrypt(bytes.subarray(MAGIC.length)); assert();
      if (Buffer.byteLength(decoded.result, 'utf8') > MAX_PROJECT_HUB_SESSION_BYTES) throw new Error('Sesión Project Hub excesiva.');
      const payload = projectHubStoredPayload.parse(JSON.parse(decoded.result));
      if (payload.userId !== owner) throw new Error('Propietario de sesión Project Hub inválido.');
      if (decoded.shouldReEncrypt) await this.write(file, payload, assert);
      assert(); return { refreshToken: payload.refreshToken, workspaces: payload.workspaces };
    });
  }

  save(owner: string, session: StoredProjectHubSession, assert: () => void): Promise<void> {
    const payload = projectHubStoredPayload.parse({ ...projectHubStoredCredentials.parse(session), version: 1, userId: owner });
    const file = this.file(owner);
    return this.run(async () => { await this.available(assert); await this.write(file, payload, assert); });
  }

  /** Se encola al empezar logout, antes de esperar revocación remota. */
  clear(owner: string): Promise<void> {
    const file = this.file(owner);
    return this.run(async () => { if (await this.directory(file)) await fs.rm(file, { force: true }); });
  }

  private file(owner: string): string {
    if (!owner || owner.length > 256) throw new Error('Propietario de sesión Project Hub inválido.');
    return path.join(this.root(), 'project-hub-sessions', createHash('sha256').update(owner).digest('hex') + '.bin');
  }
  private async available(assert: () => void): Promise<void> {
    assert(); const available = await this.cipher.available(); assert();
    if (!available) throw new Error('Custodia del SO no disponible para Project Hub.');
  }
  private async directory(file: string): Promise<boolean> {
    try {
      const stat = await fs.lstat(path.dirname(file));
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Directorio de custodia Project Hub inválido.');
      return true;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  private async write(file: string, payload: unknown, assert: () => void): Promise<void> {
    assert(); const text = JSON.stringify(payload);
    if (Buffer.byteLength(text, 'utf8') > MAX_PROJECT_HUB_SESSION_BYTES) throw new Error('Sesión Project Hub excesiva.');
    const encoded = await this.cipher.encrypt(text); assert();
    await this.replace(file, Buffer.concat([MAGIC, encoded]), assert, MAX_PROJECT_HUB_CIPHER_BYTES); assert();
  }
  private run<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation); this.queue = task.catch(() => undefined); return task;
  }
}

