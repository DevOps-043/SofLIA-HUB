import { transcribeAudio } from '../ai-provider/transcription';
import type { ResponseInput } from 'openai/resources/responses/responses';
import { createProviderClient } from '../ai-provider/client';
import { SOFLIA_DEFAULT_MODEL } from '../../src/shared/soflia-runtime-model';
import { FLOW_ORCHESTRATOR_PROMPT, FLOW_RESPONSE_FALLBACK_PROMPT } from '../../src/prompts/flow';
import type { NativeFlowRequest } from '../../src/shared/native-flow';

const MAX_REPLY_CHARS = 200_000;
export async function generateFlow(key: string, request: NativeFlowRequest, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const client = createProviderClient(key);
  let text: string;
  if (request.kind === 'transcription') {
    text = JSON.stringify({ transcript: await transcribeAudio(client, Buffer.from(request.audio, 'base64'), request.mimeType, signal) });
  } else {
    const content: Exclude<ResponseInput[number], string> = {
      role: 'user', content: [
        { type: 'input_text', text: request.text },
        ...(request.image ? [{ type: 'input_image' as const, image_url: `data:image/png;base64,${request.image}`, detail: 'auto' as const }] : []),
      ],
    };
    const result = await client.responses.create({
      model: SOFLIA_DEFAULT_MODEL,
      instructions: request.kind === 'analysis' ? FLOW_ORCHESTRATOR_PROMPT : FLOW_RESPONSE_FALLBACK_PROMPT,
      input: [content], max_output_tokens: 16_384, store: false,
      ...(request.kind === 'analysis' ? { text: { format: { type: 'json_object' as const } } } : {}),
    }, { signal });
    text = result.output_text;
  }
  signal.throwIfAborted();
  if (typeof text !== 'string' || text.length > MAX_REPLY_CHARS) throw new Error('Respuesta no válida.');
  return text;
}
