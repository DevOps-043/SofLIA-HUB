import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY } from '../../config';
import { getApiKeyWithCache } from '../api-keys';

export async function getGenAI(): Promise<GoogleGenerativeAI> {
  const dbApiKey = await getApiKeyWithCache('google');
  const key = dbApiKey || GOOGLE_API_KEY || '';
  return new GoogleGenerativeAI(key);
}
