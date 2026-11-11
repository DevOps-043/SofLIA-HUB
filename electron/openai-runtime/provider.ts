import OpenAI from 'openai';
import type { OpenAIProvider } from './types';

/** Sólo Responses al endpoint oficial; no se heredan base URL, organización o proyecto del entorno. */
export const nativeOpenAIProvider: OpenAIProvider = async (scope, body, signal, maxRetries) => {
  scope.authority.assert();
  const apiKey = await scope.authority.key(signal); scope.authority.assert();
  if (signal.aborted) throw new Error('Generación cancelada.');
  const client = new OpenAI({ apiKey, baseURL: 'https://api.openai.com/v1', organization: null, project: null, logLevel: 'off' });
  return await client.responses.create(body, { signal, maxRetries });
};
