import { app, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserCredentialMetadata, BrowserCredentialSaveInput } from './types';

type StoredCredential = BrowserCredentialMetadata & { passwordEncrypted: string };
type VaultFile = { version: 1; credentials: StoredCredential[] };

const MAX_USERNAME_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 4_096;
const MAX_CREDENTIALS = 500;

export class BrowserCredentialVault {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath = path.join(app.getPath('userData'), 'integrated-browser', 'credentials.json')) {}

  async list(origin?: string): Promise<BrowserCredentialMetadata[]> {
    await this.writeQueue;
    const normalizedOrigin = origin ? normalizeCredentialOrigin(origin) : null;
    return (await this.read()).credentials
      .filter((item) => !normalizedOrigin || item.origin === normalizedOrigin)
      .map(toMetadata)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async save(origin: string, rawInput: BrowserCredentialSaveInput): Promise<BrowserCredentialMetadata> {
    const normalizedOrigin = normalizeCredentialOrigin(origin);
    const input = validateCredentialInput(rawInput);
    await this.assertSecureStorage();
    const encrypted = safeStorage.encryptString(input.password);
    let saved: StoredCredential | null = null;
    await this.enqueue(async () => {
      const vault = await this.read();
      const now = new Date().toISOString();
      const index = input.id
        ? vault.credentials.findIndex((item) => item.id === input.id && item.origin === normalizedOrigin)
        : vault.credentials.findIndex((item) => item.origin === normalizedOrigin && item.username === input.username);
      const current = index >= 0 ? vault.credentials[index] : null;
      if (!current && vault.credentials.length >= MAX_CREDENTIALS) {
        throw new Error('La boveda alcanzo el limite de credenciales guardadas.');
      }
      saved = {
        id: current?.id ?? randomUUID(),
        origin: normalizedOrigin,
        username: input.username,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        passwordEncrypted: encrypted.toString('base64'),
      };
      if (index >= 0) vault.credentials[index] = saved;
      else vault.credentials.push(saved);
      await this.write(vault);
    });
    if (!saved) throw new Error('No se pudo guardar la credencial.');
    return toMetadata(saved);
  }

  async resolveSecret(id: string, currentOrigin: string): Promise<{ metadata: BrowserCredentialMetadata; password: string }> {
    validateId(id);
    const origin = normalizeCredentialOrigin(currentOrigin);
    await this.assertSecureStorage();
    await this.writeQueue;
    const vault = await this.read();
    const stored = vault.credentials.find((item) => item.id === id && item.origin === origin);
    if (!stored) throw new Error('La credencial no pertenece al sitio actual.');
    const decrypted = safeStorage.decryptString(Buffer.from(stored.passwordEncrypted, 'base64'));
    return { metadata: toMetadata(stored), password: decrypted };
  }

  async remove(id: string, currentOrigin: string): Promise<boolean> {
    validateId(id);
    const origin = normalizeCredentialOrigin(currentOrigin);
    let removed = false;
    await this.enqueue(async () => {
      const vault = await this.read();
      const next = vault.credentials.filter((item) => item.id !== id || item.origin !== origin);
      removed = next.length !== vault.credentials.length;
      if (removed) await this.write({ version: 1, credentials: next });
    });
    return removed;
  }

  private async enqueue(operation: () => Promise<void>): Promise<void> {
    const pending = this.writeQueue.then(operation);
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }

  private async assertSecureStorage(): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('El almacenamiento seguro del sistema no esta disponible.');
    }
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
      throw new Error('El sistema no ofrece una boveda segura para contrasenas.');
    }
  }

  private async read(): Promise<VaultFile> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as Partial<VaultFile>;
      if (parsed.version !== 1 || !Array.isArray(parsed.credentials)) {
        throw new Error('El formato de la boveda de contrasenas no es valido.');
      }
      if (parsed.credentials.length > MAX_CREDENTIALS || !parsed.credentials.every(isStoredCredential)) {
        throw new Error('La boveda contiene una credencial invalida.');
      }
      return { version: 1, credentials: parsed.credentials };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, credentials: [] };
      console.error('[Navegador][Boveda] No se pudo leer la boveda:', safeError(error));
      throw new Error('La boveda de contrasenas esta danada o no se puede leer.');
    }
  }

  private async write(vault: VaultFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(vault, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, this.filePath);
  }
}

export function normalizeCredentialOrigin(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('El origen de la credencial no es valido.'); }
  const localHttp = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !localHttp) {
    throw new Error('Las contrasenas solo se guardan para HTTPS o localhost.');
  }
  return url.origin;
}

function validateCredentialInput(raw: BrowserCredentialSaveInput): BrowserCredentialSaveInput {
  if (!raw || typeof raw !== 'object') throw new Error('La credencial es invalida.');
  const username = typeof raw.username === 'string' ? raw.username.trim() : '';
  const password = typeof raw.password === 'string' ? raw.password : '';
  if (!username || username.length > MAX_USERNAME_LENGTH) throw new Error('El usuario de la credencial es invalido.');
  if (!password || password.length > MAX_PASSWORD_LENGTH) throw new Error('La contrasena es invalida.');
  if (raw.id !== undefined) validateId(raw.id);
  return { id: raw.id, username, password };
}

function validateId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[a-f\d-]{16,64}$/i.test(id)) throw new Error('Identificador de credencial invalido.');
}

function isStoredCredential(value: unknown): value is StoredCredential {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredCredential>;
  if (typeof item.id !== 'string' || !/^[a-f\d-]{16,64}$/i.test(item.id)) return false;
  if (typeof item.origin !== 'string' || typeof item.username !== 'string' || !item.username || item.username.length > MAX_USERNAME_LENGTH) return false;
  if (typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)) || typeof item.updatedAt !== 'string' || Number.isNaN(Date.parse(item.updatedAt))) return false;
  if (typeof item.passwordEncrypted !== 'string' || !item.passwordEncrypted || item.passwordEncrypted.length > 16_384) return false;
  try { return normalizeCredentialOrigin(item.origin) === item.origin; } catch { return false; }
}

function toMetadata(value: StoredCredential): BrowserCredentialMetadata {
  const { id, origin, username, createdAt, updatedAt } = value;
  return { id, origin, username, createdAt, updatedAt };
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/[\r\n\t]+/g, ' ').slice(0, 200);
}
