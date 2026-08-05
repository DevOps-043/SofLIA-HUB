import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../../config';
import { getApiKeyWithCache } from '../api-keys';

let client: OpenAI | null = null;
let currentApiKey: string | null = null;

/**
 * Misma politica que el cliente de Gemini: la llave del usuario guardada en
 * base manda sobre la del .env, y el cliente se recrea solo si la llave cambio.
 *
 * `dangerouslyAllowBrowser` es necesario porque el pipeline de chat vive en el
 * renderer de Electron (igual que el de Gemini). No es un navegador publico: la
 * llave nunca sale de la maquina del usuario.
 */
export async function getOpenAI(): Promise<OpenAI> {
  const dbApiKey = await getApiKeyWithCache('openai');
  const apiKey = dbApiKey || OPENAI_API_KEY || '';
  if (!apiKey.trim()) {
    throw new Error('OPENAI_API_KEY_MISSING');
  }
  if (!client || currentApiKey !== apiKey) {
    client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    currentApiKey = apiKey;
  }
  return client;
}

export function resetOpenAIClient(): void {
  client = null;
  currentApiKey = null;
}
