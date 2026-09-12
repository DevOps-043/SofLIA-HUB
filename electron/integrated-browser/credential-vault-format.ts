import { safeStorage } from 'electron';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { BrowserCredentialError } from './credential-errors';

export const MAX_CREDENTIAL_VAULT_PLAINTEXT_BYTES = 12 * 1024 * 1024;
export const MAX_CREDENTIAL_VAULT_FILE_BYTES = 17 * 1024 * 1024;
const ALGORITHM = 'aes-256-gcm';

/** No equivale a autenticación del titular ni a cifrado entre dispositivos. */
export function assertCredentialSecureStorage(): void {
  if (!safeStorage.isEncryptionAvailable()) throw new BrowserCredentialError('El almacenamiento seguro del sistema no está disponible.');
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    throw new BrowserCredentialError('El sistema no ofrece una bóveda segura para contraseñas.');
  }
}

export function sealCredentialVault(plaintext: string, scope: string): string {
  assertCredentialSecureStorage();
  const data = Buffer.from(plaintext, 'utf8');
  const key = randomBytes(32);
  try {
    if (data.length > MAX_CREDENTIAL_VAULT_PLAINTEXT_BYTES) throw new Error('límite');
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(associatedData(scope));
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    return JSON.stringify({
      version: 2, algorithm: ALGORITHM,
      protectedKey: safeStorage.encryptString(key.toString('base64')).toString('base64'),
      iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    });
  } catch {
    throw new BrowserCredentialError('No se pudo proteger la bóveda. Se conserva el archivo anterior.');
  } finally { key.fill(0); data.fill(0); }
}

export function openCredentialVault(raw: unknown, scope: string): string {
  assertCredentialSecureStorage();
  let key: Buffer | undefined;
  let plaintext: Buffer | undefined;
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('formato');
    const value = raw as Record<string, unknown>;
    const fields = ['version', 'algorithm', 'protectedKey', 'iv', 'tag', 'ciphertext'];
    if (Object.keys(value).length !== fields.length || Object.keys(value).some((field) => !fields.includes(field))
      || value.version !== 2 || value.algorithm !== ALGORITHM) throw new Error('formato');
    const wrappedKey = base64(value.protectedKey, 8_192);
    const iv = base64(value.iv, 16);
    const tag = base64(value.tag, 24);
    const ciphertext = base64(value.ciphertext, Math.ceil(MAX_CREDENTIAL_VAULT_PLAINTEXT_BYTES / 3) * 4);
    key = base64(safeStorage.decryptString(wrappedKey), 44);
    if (key.length !== 32 || iv.length !== 12 || tag.length !== 16) throw new Error('longitud');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(associatedData(scope));
    decipher.setAuthTag(tag);
    // No devolver ningún byte antes de autenticar la totalidad de la instantánea.
    const pending = decipher.update(ciphertext);
    try { plaintext = Buffer.concat([pending, decipher.final()]); }
    finally { pending.fill(0); }
    return plaintext.toString('utf8');
  } catch {
    throw new BrowserCredentialError('No se pudo autenticar la bóveda de este perfil. No se modificó el archivo.');
  } finally { key?.fill(0); plaintext?.fill(0); }
}

function associatedData(scope: string): Buffer {
  return Buffer.from(JSON.stringify(['PulseHub', 'credential-vault', 2, ALGORITHM, scope]), 'utf8');
}

function base64(raw: unknown, maxLength: number): Buffer {
  if (typeof raw !== 'string' || !raw.length || raw.length > maxLength) throw new Error('longitud');
  const data = Buffer.from(raw, 'base64');
  if (data.toString('base64') !== raw) throw new Error('base64');
  return data;
}
