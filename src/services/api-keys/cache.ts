import { invalidateApiKeyReads } from './session-scope';
import { getApiKey } from './queries';
import type { ApiKeyProvider } from './types';

/** Fachada compatible: no retiene claves entre solicitudes ni sesiones. */
export function getApiKeyWithCache(provider: ApiKeyProvider = 'google'): Promise<string | null> {
  return getApiKey(provider);
}

/** Revoca lecturas activas; no almacena credenciales. */
export function invalidateApiKeyCache(): void { invalidateApiKeyReads(); }
