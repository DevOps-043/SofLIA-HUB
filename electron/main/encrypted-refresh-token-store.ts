import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface EncryptedRefreshTokenStore {
  save(refreshToken: string): boolean;
  read(): string | null;
  clear(): void;
  hasStored(): boolean;
}

/**
 * Custodia mínima para refresh tokens del proceso main.
 *
 * Cada consumidor conserva un archivo distinto para impedir que credenciales
 * de proyectos Supabase diferentes se sustituyan entre sí. Nunca hay fallback
 * a texto plano: sin `safeStorage`, la sesión solo vive en memoria.
 */
export function createEncryptedRefreshTokenStore(input: {
  fileName: string;
  logScope: string;
}): EncryptedRefreshTokenStore {
  const getTokenPath = () => path.join(app.getPath('userData'), input.fileName);

  return {
    save(refreshToken: string): boolean {
      const token = String(refreshToken || '').trim();
      if (!token) return false;

      if (!safeStorage.isEncryptionAvailable()) {
        console.warn(`[${input.logScope}] El sistema no ofrece cifrado seguro: la sesion no se persistira.`);
        return false;
      }

      try {
        fs.writeFileSync(getTokenPath(), safeStorage.encryptString(token), { mode: 0o600 });
        console.log(`[${input.logScope}] Sesion guardada de forma cifrada.`);
        return true;
      } catch (error) {
        console.error(`[${input.logScope}] No se pudo guardar la sesion:`, describe(error));
        return false;
      }
    },

    read(): string | null {
      const tokenPath = getTokenPath();
      if (!fs.existsSync(tokenPath)) return null;

      try {
        const data = fs.readFileSync(tokenPath);
        if (!safeStorage.isEncryptionAvailable()) {
          console.warn(`[${input.logScope}] Hay sesion guardada pero el sistema ya no ofrece descifrado.`);
          return null;
        }
        const token = safeStorage.decryptString(data).trim();
        return token || null;
      } catch (error) {
        console.warn(`[${input.logScope}] La sesion guardada no se pudo leer; se descarta.`);
        void error;
        return null;
      }
    },

    clear(): void {
      const tokenPath = getTokenPath();
      try {
        if (fs.existsSync(tokenPath)) {
          fs.unlinkSync(tokenPath);
          console.log(`[${input.logScope}] Sesion borrada del disco.`);
        }
      } catch (error) {
        console.error(`[${input.logScope}] No se pudo borrar la sesion:`, describe(error));
      }
    },

    hasStored(): boolean {
      return fs.existsSync(getTokenPath());
    },
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
