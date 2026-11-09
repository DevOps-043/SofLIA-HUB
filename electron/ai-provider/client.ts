import OpenAI from 'openai';

/** Cliente efímero al endpoint oficial bajo una credencial ya autorizada. */
export function createProviderClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: 'https://api.openai.com/v1', organization: null,
    project: null, maxRetries: 0, logLevel: 'off' });
}
