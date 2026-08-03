export type ModelProvider = 'google' | 'openai';

/**
 * El catalogo mezcla dos proveedores. Los IDs de OpenAI del catalogo empiezan
 * por `gpt-` (gpt-5.6-terra, gpt-5.6-luna); todo lo demas sigue por el pipeline
 * de Gemini. Se resuelve por prefijo para no tener que mantener una lista
 * paralela cada vez que se agrega un modelo.
 */
export function resolveModelProvider(modelId?: string): ModelProvider {
  return isOpenAIModel(modelId) ? 'openai' : 'google';
}

export function isOpenAIModel(modelId?: string): boolean {
  const normalized = modelId?.trim().toLowerCase() || '';
  return normalized.startsWith('gpt-');
}
