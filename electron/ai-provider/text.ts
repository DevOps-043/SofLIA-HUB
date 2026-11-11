import type { ResponseInput } from 'openai/resources/responses/responses';
import { SOFLIA_DEFAULT_MODEL } from '../../src/shared/soflia-runtime-model';
import { getSessionOpenAIClient } from './session-client';

export interface SessionTextOptions {
  json?: boolean;
  signal?: AbortSignal;
  images?: string[];
  maxOutputTokens?: number;
  webSearch?: boolean;
}

/** Inferencia nativa de un turno, sin almacenamiento ni herramientas de acción. */
export async function generateSessionText(prompt: string, options: SessionTextOptions = {}): Promise<string> {
  if (!prompt.trim() || prompt.length > 120_000) throw new Error('Prompt de inferencia no válido.');
  if ((options.images?.length ?? 0) > 16 || options.images?.some(image => image.length > 16_000_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image))) throw new Error('Imagen de inferencia no válida.');
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000);
  signal.throwIfAborted();
  const client = await getSessionOpenAIClient();
  signal.throwIfAborted();
  const input: ResponseInput = [{ role: 'user', content: [
    { type: 'input_text', text: prompt },
    ...(options.images ?? []).map(image_url => ({ type: 'input_image' as const, image_url, detail: 'auto' as const })),
  ] }];
  const response = await client.responses.create({
    model: SOFLIA_DEFAULT_MODEL, input, store: false,
    max_output_tokens: options.maxOutputTokens ?? 8192, reasoning: { effort: 'low' },
    ...(options.json ? { text: { format: { type: 'json_object' as const } } } : {}),
    ...(options.webSearch ? { tools: [{ type: 'web_search' as const }] } : {}),
  }, { signal, maxRetries: 0 });
  signal.throwIfAborted();
  if (response.status && response.status !== 'completed') throw new Error('La inferencia no se completó.');
  if (typeof response.output_text !== 'string' || response.output_text.length > 200_000) throw new Error('Respuesta de inferencia no válida.');
  return response.output_text;
}
