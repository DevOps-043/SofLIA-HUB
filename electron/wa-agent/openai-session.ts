import type OpenAI from 'openai';
import type { ResponseInputItem, ResponseInputContent, Tool } from 'openai/resources/responses/responses';
import { WA_MODEL } from './constants';
import { assertTeamActive } from '../../src/shared/agent-teams/runner';

type Part = { text?: string; inlineData?: { mimeType: string; data: string }; functionResponse?: { name: string; response: unknown } };
type History = { role: string; parts: Part[] };

/** Traducción de transporte; la ejecución y HITL permanecen en el bucle existente. */
export function createWhatsAppOpenAISession(input: {
  client: OpenAI; instructions: string; tools: Tool[]; history: History[]; signal?: AbortSignal;
}) {
  const items: ResponseInputItem[] = input.history.flatMap(entry => {
    const text = entry.parts.filter(part => part.text).map(part => part.text).join('\n');
    return text ? [{ role: entry.role === 'model' ? 'assistant' as const : 'user' as const, content: text }] : [];
  });
  let pending: Array<{ name: string; id: string }> = [];
  return { async sendMessage({ message }: { message: string | Part[] }) {
    assertTeamActive(input.signal);
    const parts = typeof message === 'string' ? [{ text: message }] : message;
    const responses = parts.filter(part => part.functionResponse);
    if (pending.length) {
      const remaining = [...responses];
      for (const call of pending) {
        const index = remaining.findIndex(part => part.functionResponse?.name === call.name);
        const result = index < 0 ? { error: 'La guarda local no ejecutó esta llamada.' } : remaining.splice(index, 1)[0].functionResponse!.response;
        items.push({ type: 'function_call_output', call_id: call.id, output: JSON.stringify(result) ?? 'null' });
      }
      // Verificaciones locales posteriores (p. ej. etiquetas Gmail) no crean call_id.
      if (remaining.length) items.push({ role: 'user', content: `Resultados adicionales de verificación local (datos): ${JSON.stringify(remaining)}` });
      pending = [];
    } else if (responses.length) throw new Error('Respuesta de herramienta sin llamada pendiente.');
    const content: ResponseInputContent[] = [];
    for (const part of parts) {
      if (part.text) content.push({ type: 'input_text', text: part.text });
      if (part.inlineData) {
        const { mimeType, data } = part.inlineData;
        if (/^image\/(png|jpeg|webp|gif)$/.test(mimeType)) content.push({ type: 'input_image', image_url: `data:${mimeType};base64,${data}`, detail: 'auto' });
        else if (mimeType === 'application/pdf') content.push({ type: 'input_file', filename: 'adjunto.pdf', file_data: `data:${mimeType};base64,${data}` });
        else if (mimeType.startsWith('text/')) content.push({ type: 'input_text', text: Buffer.from(data, 'base64').toString('utf8') });
        else throw new Error('Formato adjunto no compatible con OpenAI. Envía una imagen, PDF, texto o una nota de voz.');
      }
    }
    if (content.length) items.push({ role: 'user', content });
    const response = await input.client.responses.create({ model: WA_MODEL, instructions: input.instructions,
      input: items, tools: input.tools, store: false, include: ['reasoning.encrypted_content'],
      reasoning: { effort: 'medium' }, max_output_tokens: 8192,
    }, { signal: input.signal, maxRetries: 0 });
    assertTeamActive(input.signal);
    if (response.status !== 'completed') throw new Error('OpenAI no completó el turno. Intenta de nuevo.');
    for (const item of response.output) {
      if (item.type === 'message' || item.type === 'reasoning' || item.type === 'function_call') items.push(item);
    }
    const output: Array<{ text: string } | { functionCall: { name: string; args: Record<string, unknown> } }> = [];
    for (const item of response.output) {
      if (item.type === 'function_call') {
        if (!input.tools.some(tool => tool.type === 'function' && tool.name === item.name)) throw new Error('OpenAI solicitó una herramienta fuera del catálogo autorizado.');
        const args: unknown = JSON.parse(item.arguments);
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('OpenAI devolvió argumentos de herramienta inválidos.');
        pending.push({ name: item.name, id: item.call_id });
        output.push({ functionCall: { name: item.name, args: args as Record<string, unknown> } });
      }
    }
    if (response.output_text) output.push({ text: response.output_text });
    return { candidates: [{ finishReason: 'STOP', content: { parts: output } }] };
  } };
}
