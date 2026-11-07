import { GoogleGenAI } from '@google/genai';
import { GOOGLE_API_KEY } from '../../config';
import { getApiKeyWithCache } from '../api-keys';

/** Credenciales de navegador independiente, con cliente efímero por operación. */
async function webKey(): Promise<string> {
  return (await getApiKeyWithCache('google')) || GOOGLE_API_KEY || '';
}

/** El SDK actual conserva el rol user en las respuestas de herramienta. */
export async function getGenAiClient(): Promise<GoogleGenAI> {
  return new GoogleGenAI({ apiKey: await webKey() });
}
