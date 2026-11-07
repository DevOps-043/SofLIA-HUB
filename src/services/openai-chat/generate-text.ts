import { SOFLIA_DEFAULT_MODEL } from '../../shared/soflia-runtime-model';
import { getOpenAI } from './client';

interface TextGeneration {
  prompt: string;
  maxOutputTokens?: number;
  timeout?: { label: string; ms: number };
}

/** Utilidades de un turno: sin historial, herramientas ni credenciales en renderer. */
export async function generateAssistantText(input: TextGeneration): Promise<string> {
  const controller = new AbortController();
  const timeout = input.timeout ?? { label: 'Generación de texto', ms: 45_000 };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const generation = async () => {
    const client = await getOpenAI();
    controller.signal.throwIfAborted();
    const response = await client.responses.create({
      model: SOFLIA_DEFAULT_MODEL,
      input: input.prompt,
      max_output_tokens: input.maxOutputTokens ?? 4096,
      reasoning: { effort: 'low' },
      store: false,
    }, { signal: controller.signal, maxRetries: 0 });
    controller.signal.throwIfAborted();
    return response.output_text;
  };
  try {
    return await Promise.race([
      generation(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`${timeout.label} excedió el tiempo límite.`);
          error.name = 'TimeoutError';
          reject(error);
          controller.abort();
        }, timeout.ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
