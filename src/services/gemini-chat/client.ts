import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY } from '../../config';
import { getApiKeyWithCache } from '../api-keys';

let genAI: GoogleGenerativeAI | null = null;
let currentApiKey: string | null = null;
let genAiClient: GoogleGenAI | null = null;
let currentGenAiKey: string | null = null;

export async function getGenAI(): Promise<GoogleGenerativeAI> {
  const dbApiKey = await getApiKeyWithCache('google');
  if (dbApiKey) {
    if (!genAI || currentApiKey !== dbApiKey) {
      genAI = new GoogleGenerativeAI(dbApiKey);
      currentApiKey = dbApiKey;
    }
    return genAI;
  }

  const envApiKey = GOOGLE_API_KEY || '';
  if (!genAI || currentApiKey !== envApiKey) {
    genAI = new GoogleGenerativeAI(envApiKey);
    currentApiKey = envApiKey;
  }
  return genAI;
}

/**
 * Cliente de `@google/genai`, obligatorio para el tool loop.
 *
 * El SDK legado manda las respuestas de herramienta con `role: "function"` y
 * Gemini 3 rechaza ese rol, asi que ningun turno con herramientas sobrevive el
 * segundo salto. `getGenAI` se conserva para los usos de un solo disparo.
 */
export async function getGenAiClient(): Promise<GoogleGenAI> {
  const apiKey = (await getApiKeyWithCache('google')) || GOOGLE_API_KEY || '';
  if (!genAiClient || currentGenAiKey !== apiKey) {
    genAiClient = new GoogleGenAI({ apiKey });
    currentGenAiKey = apiKey;
  }
  return genAiClient;
}

export function resetClient() {
  genAI = null;
  currentApiKey = null;
  genAiClient = null;
  currentGenAiKey = null;
}
