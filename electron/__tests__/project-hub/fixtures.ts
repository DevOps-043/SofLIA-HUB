import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { vi } from 'vitest';
import type { OsCipher } from '../../storage/os-cipher';

export const WORKSPACE_ID = '12345678-1234-4123-8123-123456789012';
export const workspace = (name = 'Espacio ficticio') => ({ id: WORKSPACE_ID, name, slug: 'prueba', role: 'owner' });
export const credentials = (suffix = 'original') => ({
  refreshToken: `renovacion-ficticia-${suffix}`, workspaces: [workspace()],
});
export const tokenPair = (suffix = 'original') => ({
  access_token: `acceso-ficticio-${suffix}`, refresh_token: `renovacion-ficticia-${suffix}`, expires_in: 3600,
});
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

/** AEAD real de prueba; DPAPI se verifica aparte en procesos Electron. */
export function testCipher(): OsCipher {
  const key = randomBytes(32);
  return {
    available: vi.fn(async () => true),
    encrypt: vi.fn(async text => {
      const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    }),
    decrypt: vi.fn(async bytes => {
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(-16));
      return { result: Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString('utf8'), shouldReEncrypt: false };
    }),
  };
}
