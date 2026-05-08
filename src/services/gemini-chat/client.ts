import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY } from '../../config';
import { getApiKeyWithCache } from '../api-keys';

let genAI: GoogleGenerativeAI | null = null;
let currentApiKey: string | null = null;

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

export function resetClient() {
  genAI = null;
  currentApiKey = null;
}
