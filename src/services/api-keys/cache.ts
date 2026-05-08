import { getApiKey } from './queries';
import type { ApiKeyProvider } from './types';

const CACHE_TTL = 5 * 60 * 1000;

let cachedApiKey: string | null = null;
let cacheTimestamp = 0;

export async function getApiKeyWithCache(provider: ApiKeyProvider = 'google'): Promise<string | null> {
  const now = Date.now();
  if (cachedApiKey && now - cacheTimestamp < CACHE_TTL) return cachedApiKey;

  cachedApiKey = await getApiKey(provider);
  cacheTimestamp = now;
  return cachedApiKey;
}

export function invalidateApiKeyCache(): void {
  cachedApiKey = null;
  cacheTimestamp = 0;
}
