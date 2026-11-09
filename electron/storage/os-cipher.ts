import { safeStorage } from 'electron';

export interface OsCipher {
  available(): Promise<boolean>;
  encrypt(value: string): Promise<Buffer>;
  decrypt(value: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
}

/** Sin fallback plano; Linux debe ofrecer un llavero seguro. */
export const systemCipher: OsCipher = {
  available: async () => await safeStorage.isAsyncEncryptionAvailable()
    && (process.platform !== 'linux' || !['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend())),
  encrypt: value => safeStorage.encryptStringAsync(value),
  decrypt: value => safeStorage.decryptStringAsync(value),
};
