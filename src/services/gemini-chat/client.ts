import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY } from '../../config';
import { getApiKeyWithCache } from '../api-keys';

/**
 * Dos clientes conviven durante la migracion del chat a `@google/genai`.
 *
 * La ruta conversacional usa el cliente nuevo: es el unico que tipa
 * `videoMetadata`, `mediaResolution` y la API de archivos que necesita la
 * entrada de video y audio. Las utilidades de un solo disparo (titulo de
 * conversacion, flow, generacion de imagen, panel de escritura) siguen sobre el
 * cliente anterior hasta su cambio de limpieza; migrarlas aqui multiplicaba la
 * superficie de regresion sin beneficio funcional.
 *
 * Ambos comparten resolucion de llave y reinicio para que un cambio de clave en
 * Configuracion no deje uno de los dos apuntando a la credencial vieja.
 */

let genAI: GoogleGenerativeAI | null = null;
let genAiClient: GoogleGenAI | null = null;
let currentApiKey: string | null = null;
let currentGenAiApiKey: string | null = null;

async function resolveApiKey(): Promise<string> {
  const dbApiKey = await getApiKeyWithCache('google');
  if (dbApiKey) return dbApiKey;
  return GOOGLE_API_KEY || '';
}

export async function getGenAI(): Promise<GoogleGenerativeAI> {
  const apiKey = await resolveApiKey();
  if (!genAI || currentApiKey !== apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    currentApiKey = apiKey;
  }
  return genAI;
}

/** Cliente de la ruta conversacional y de todo lo multimodal. */
export async function getGenAiClient(): Promise<GoogleGenAI> {
  const apiKey = await resolveApiKey();
  if (!genAiClient || currentGenAiApiKey !== apiKey) {
    genAiClient = new GoogleGenAI({ apiKey });
    currentGenAiApiKey = apiKey;
  }
  return genAiClient;
}

export function resetClient() {
  genAI = null;
  genAiClient = null;
  currentApiKey = null;
  currentGenAiApiKey = null;
}
