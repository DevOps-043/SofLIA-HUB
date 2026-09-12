import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { safeStorage } from 'electron';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import type { BrowserSyncCategory } from './platform-types';

const SYNC_CATEGORIES = new Set<BrowserSyncCategory>(['bookmarks', 'groups', 'tabs', 'settings']);
const FORBIDDEN_KEYS = /^(password|passwords|passkey|passkeys|cookie|cookies|token|tokens|payment|payments|autofill|formValue|secret|secrets)$/i;
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const keyQueues = new Map<string, Promise<unknown>>();

function withKeyLock<T>(destination: string, operation: () => Promise<T>): Promise<T> {
  const pending = (keyQueues.get(destination) ?? Promise.resolve()).catch(() => undefined).then(operation);
  keyQueues.set(destination, pending);
  void pending.finally(() => { if (keyQueues.get(destination) === pending) keyQueues.delete(destination); }).catch(() => undefined);
  return pending;
}

type SyncKeyFile = { version: 1; protectedKey: string };

export interface BrowserSyncEnvelope {
  version: 1;
  algorithm: 'aes-256-gcm';
  category: BrowserSyncCategory;
  nonce: string;
  ciphertext: string;
  authTag: string;
}

/** Cifrado E2E local. La clave sólo persiste protegida por la bóveda del SO. */
export class BrowserSyncCrypto {
  constructor(private readonly location: string | (() => string) = () => browserProfilePath('sync-key.json')) {}

  async hasKey(): Promise<boolean> { const destination = this.filePath; await this.assertSafeStorage(); await keyQueues.get(destination); return (await this.readKey(destination)) !== null; }

  /** Exclusivo de main tras consentimiento y destino nativo; nunca exponer por IPC. */
  async exportRecoveryCode(): Promise<string> { return encodeRecoveryCode(await this.requireKey()); }

  async initialize(guard: () => void = () => undefined): Promise<{ recoveryCode: string | null }> {
    const destination = this.filePath;
    await this.assertSafeStorage();
    return withKeyLock(destination, async () => {
      guard();
      if (await this.readKey(destination)) return { recoveryCode: null };
      guard();
      const key = randomBytes(32);
      await this.writeKey(key, destination, guard);
      return { recoveryCode: encodeRecoveryCode(key) };
    });
  }

  async restore(recoveryCode: string, guard: () => void = () => undefined): Promise<void> {
    const destination = this.filePath;
    await this.assertSafeStorage();
    const key = decodeRecoveryCode(recoveryCode);
    await withKeyLock(destination, async () => {
      guard();
      const existing = await this.readKey(destination);
      guard();
      if (existing && !existing.equals(key)) throw new Error('Ya existe una clave diferente. Desconecta el dispositivo antes de recuperarlo.');
      if (!existing) await this.writeKey(key, destination, guard);
    });
  }

  async encrypt(raw: unknown): Promise<BrowserSyncEnvelope> {
    const input = normalizeBrowserSyncInput(raw);
    const plaintext = Buffer.from(JSON.stringify(input.payload), 'utf8');
    if (plaintext.byteLength > MAX_PAYLOAD_BYTES) throw new Error('El payload de sincronización supera el límite de 2 MB.');
    const key = await this.requireKey();
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(`soflia-sync:v1:${input.category}`, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      version: 1,
      algorithm: 'aes-256-gcm',
      category: input.category,
      nonce: nonce.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  async decrypt(raw: unknown): Promise<unknown> {
    const envelope = validateBrowserSyncEnvelope(raw);
    const decipher = createDecipheriv('aes-256-gcm', await this.requireKey(), Buffer.from(envelope.nonce, 'base64'));
    decipher.setAAD(Buffer.from(`soflia-sync:v1:${envelope.category}`, 'utf8'));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8'));
    } catch (error) {
      const wrapped = new Error('El envelope de sincronización no supera autenticación.');
      Object.defineProperty(wrapped, 'cause', { value: error });
      throw wrapped;
    }
    return normalizeBrowserSyncInput({ category: envelope.category, payload: parsed }).payload;
  }

  private get filePath(): string { return resolveStoreLocation(this.location); }

  private async requireKey(): Promise<Buffer> {
    const destination = this.filePath;
    await this.assertSafeStorage();
    await keyQueues.get(destination);
    const key = await this.readKey(destination);
    if (!key) throw new Error('La sincronización no tiene una clave local válida.');
    return key;
  }

  private async readKey(destination: string): Promise<Buffer | null> {
    let file;
    try {
      file = await fs.open(destination, 'r');
      const buffer = Buffer.alloc(8193); let size = 0;
      while (size < buffer.length) { const part = await file.read(buffer, size, buffer.length - size, null); if (!part.bytesRead) break; size += part.bytesRead; }
      if (size > 8192) throw new Error('Formato inválido.');
      const parsed = JSON.parse(buffer.subarray(0, size).toString('utf8')) as Partial<SyncKeyFile>;
      if (!parsed || Object.keys(parsed).sort().join(',') !== 'protectedKey,version' || parsed.version !== 1 || typeof parsed.protectedKey !== 'string') throw new Error('Formato inválido.');
      const protectedKey = Buffer.from(parsed.protectedKey, 'base64');
      if (!protectedKey.length || protectedKey.toString('base64') !== parsed.protectedKey) throw new Error('Formato inválido.');
      const plaintext = safeStorage.decryptString(protectedKey);
      const key = Buffer.from(plaintext, 'base64');
      if (key.byteLength !== 32 || key.toString('base64') !== plaintext) throw new Error('Clave inválida.');
      return key;
    } catch (error) {
      if (!file && (error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      const wrapped = new Error('La clave local de sincronización está dañada.');
      Object.defineProperty(wrapped, 'cause', { value: error });
      throw wrapped;
    } finally { await file?.close(); }
  }

  private async writeKey(key: Buffer, destination: string, guard: () => void): Promise<void> {
    const temporary = `${destination}.${randomUUID()}.tmp`;
    const file: SyncKeyFile = { version: 1, protectedKey: safeStorage.encryptString(key.toString('base64')).toString('base64') };
    await fs.mkdir(path.dirname(destination), { recursive: true });
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(file), 'utf8'); await handle.sync(); } finally { await handle.close(); }
      guard();
      await fs.rename(temporary, destination);
    } finally {
      await fs.unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
    }
  }

  private async assertSafeStorage(): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('La bóveda segura del sistema no está disponible.');
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') throw new Error('El sistema no ofrece una bóveda segura para sync.');
  }
}

export type BrowserSyncRecord = Record<string, string | number | boolean | null | string[]>;
export type BrowserSyncPayload = BrowserSyncRecord | BrowserSyncRecord[];

/** Contrato único para cifrado y reconciliación; devuelve una copia saneada. */
export function normalizeBrowserSyncInput(raw: unknown): { category: BrowserSyncCategory; payload: BrowserSyncPayload } {
  if (!raw || typeof raw !== 'object') throw new Error('El payload de sincronización es inválido.');
  const value = raw as { category?: unknown; payload?: unknown };
  if (!SYNC_CATEGORIES.has(value.category as BrowserSyncCategory)) throw new Error('La categoría no puede sincronizarse.');
  assertNoSecrets(value.payload);
  const category = value.category as BrowserSyncCategory;
  const payload = validateCategoryPayload(category, value.payload) as BrowserSyncPayload;
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PAYLOAD_BYTES) throw new Error('El payload de sincronización supera el límite de 2 MB.');
  return { category, payload };
}

/** Esquemas cerrados: ningún objeto arbitrario del navegador entra al cifrado. */
function validateCategoryPayload(category: BrowserSyncCategory, raw: unknown): unknown {
  const fields: Record<BrowserSyncCategory, string[]> = {
    bookmarks: ['id', 'url', 'title', 'folderId', 'tags', 'position', 'createdAt', 'updatedAt'],
    tabs: ['id', 'url', 'title', 'groupId', 'pinned', 'position'],
    groups: ['id', 'name', 'color', 'position', 'collapsed'],
    settings: ['theme', 'tabLayout'],
  };
  const validate = (entry: unknown): Record<string, unknown> => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('El registro de sincronización es inválido.');
    if (Object.getPrototypeOf(entry) !== Object.prototype && Object.getPrototypeOf(entry) !== null) throw new Error('El registro de sincronización es inválido.');
    const record = entry as Record<string, unknown>;
    if (Object.keys(record).some((key) => !fields[category].includes(key))) throw new Error('El registro contiene campos no soportados para sincronización.');
    if (category !== 'settings' && (typeof record.id !== 'string' || !record.id || record.id.length > 100)) throw new Error('El registro necesita un identificador válido.');
    if ((category === 'bookmarks' || category === 'tabs') && typeof record.url !== 'string') throw new Error('El registro necesita una URL válida.');
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === 'url') {
        let url: URL;
        try { url = new URL(String(value)); } catch { throw new Error('La URL no puede sincronizarse.'); }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('La URL no puede sincronizarse.');
        // Queries y fragmentos pueden portar sesiones: nunca se transmiten.
        url.search = ''; url.hash = '';
        result[key] = url.href;
      } else if (key === 'position') {
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 10_000) throw new Error('La posición es inválida.');
        result[key] = value;
      } else if (key === 'pinned' || key === 'collapsed') {
        if (typeof value !== 'boolean') throw new Error('La preferencia es inválida.');
        result[key] = value;
      } else if (key === 'tags') {
        if (!Array.isArray(value) || value.length > 20 || value.some((tag) => typeof tag !== 'string' || tag.length > 80)) throw new Error('Las etiquetas son inválidas.');
        result[key] = [...value];
      } else if ((key === 'folderId' || key === 'groupId') && value === null) {
        result[key] = null;
      } else {
        if (typeof value !== 'string' || value.length > 500) throw new Error('El texto del registro es inválido.');
        if (key === 'theme' && !['light', 'dark', 'system'].includes(value)) throw new Error('El tema es inválido.');
        if (key === 'tabLayout' && !['horizontal', 'vertical'].includes(value)) throw new Error('La disposición es inválida.');
        result[key] = value;
      }
    }
    return result;
  };
  if (category === 'settings') return validate(raw);
  if (!Array.isArray(raw) || raw.length > 10_000) throw new Error('La categoría necesita una lista dentro de la cuota.');
  const rows = raw.map(validate);
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('Hay identificadores duplicados.');
  return rows;
}

export function validateBrowserSyncEnvelope(raw: unknown): BrowserSyncEnvelope {
  if (!raw || typeof raw !== 'object') throw new Error('El envelope de sincronización es inválido.');
  const value = raw as Partial<BrowserSyncEnvelope>;
  if (Object.keys(value).sort().join(',') !== 'algorithm,authTag,category,ciphertext,nonce,version'
    || value.version !== 1 || value.algorithm !== 'aes-256-gcm' || !SYNC_CATEGORIES.has(value.category as BrowserSyncCategory)
    || !isBase64(value.nonce, 12) || !isBase64(value.authTag, 16) || typeof value.ciphertext !== 'string'
    || value.ciphertext.length > MAX_PAYLOAD_BYTES * 2
    || Buffer.from(value.ciphertext, 'base64').toString('base64') !== value.ciphertext
    || Buffer.from(value.ciphertext, 'base64').byteLength > MAX_PAYLOAD_BYTES) throw new Error('El envelope de sincronización es inválido.');
  return value as BrowserSyncEnvelope;
}

function assertNoSecrets(value: unknown, depth = 0): void {
  if (depth > 20) throw new Error('El payload de sincronización es demasiado profundo.');
  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new Error('El payload de sincronización supera la cuota.');
    value.forEach((entry) => assertNoSecrets(entry, depth + 1));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`La categoría secreta “${key}” no puede sincronizarse.`);
    assertNoSecrets(entry, depth + 1);
  }
}

function encodeRecoveryCode(key: Buffer): string {
  const encoded = key.toString('base64url');
  const checksum = createHash('sha256').update(key).digest('hex').slice(0, 10);
  return `SL1-${encoded}-${checksum}`;
}

function decodeRecoveryCode(raw: string): Buffer {
  const match = /^SL1-([A-Za-z0-9_-]{43})-([a-f0-9]{10})$/.exec(raw.trim());
  if (!match) throw new Error('El código de recuperación es inválido.');
  const key = Buffer.from(match[1], 'base64url');
  if (key.byteLength !== 32 || createHash('sha256').update(key).digest('hex').slice(0, 10) !== match[2]) throw new Error('El código de recuperación no supera la verificación.');
  return key;
}

function isBase64(raw: unknown, bytes: number): boolean {
  if (typeof raw !== 'string' || raw.length > bytes * 2) return false;
  try { const decoded = Buffer.from(raw, 'base64'); return decoded.byteLength === bytes && decoded.toString('base64') === raw; } catch { return false; }
}
