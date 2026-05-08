import type { ApiKeyProvider } from './types';

export async function validateApiKey(apiKey: string, provider: ApiKeyProvider = 'google'): Promise<boolean> {
  if (!apiKey || apiKey.length < 10) return false;

  try {
    if (provider !== 'google') return false;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    return response.ok;
  } catch {
    return false;
  }
}
