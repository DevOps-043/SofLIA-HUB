import type { Response, ResponseCreateParamsNonStreaming, ResponseCreateParamsStreaming, ResponseStreamEvent } from 'openai/resources/responses/responses';
import { boundedJsonSnapshot, isJsonStringChoice, type JsonObject, type JsonValue } from './bounded-json';

export const OPENAI_RUNTIME_LIMITS = Object.freeze({ requestBytes: 32 * 1024 * 1024, eventBytes: 32 * 1024 * 1024, streamBytes: 64 * 1024 * 1024, requestMs: 15 * 60_000, idleMs: 60_000, physicalJobs: 4, retainedJobs: 8 });
export type NativeOpenAIRequest = ResponseCreateParamsNonStreaming | ResponseCreateParamsStreaming;
export type NativeOpenAIFailureCode = 'INVALID_PAYLOAD' | 'IPC_DENIED' | 'CANCELLED' | 'BUSY' | 'KEY_MISSING' | 'PROVIDER_FAILED';
export type NativeOpenAIReason = 'context_length' | 'invalid_key' | 'model_config' | 'safety' | 'timeout';
export interface NativeOpenAIFailure { success: false; code: NativeOpenAIFailureCode; error: string; status?: number; retryAfterMs?: number; reason?: NativeOpenAIReason }
export type NativeOpenAIReply<T> = ({ success: true } & T) | NativeOpenAIFailure;
export type NativeOpenAIRead = { kind: 'response'; response: Response; cursor: number } | { kind: 'event'; event: ResponseStreamEvent; cursor: number } | { kind: 'done'; cursor: number };
export interface OpenAIRuntimeApi {
  open(): Promise<NativeOpenAIReply<{ scopeId: string }>>;
  start(scopeId: string, requestId: string, body: NativeOpenAIRequest, maxRetries?: number): Promise<NativeOpenAIReply<{ requestId: string }>>;
  pull(scopeId: string, requestId: string, cursor: number): Promise<NativeOpenAIReply<NativeOpenAIRead>>;
  cancel(scopeId: string, requestId: string): Promise<NativeOpenAIReply<{ cancelled: boolean }>>;
}
export function openaiRuntimeId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new Error('Identificador de inferencia no válido.');
  return value;
}
export function openaiSnapshot(value: unknown, maxBytes = OPENAI_RUNTIME_LIMITS.requestBytes): JsonValue {
  return boundedJsonSnapshot(value, maxBytes, { depth: 32, nodes: 100000, keys: 500, array: 10000 });
}
export function objectValue(value: unknown): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value); }

const BODY_FIELDS = new Set(['model', 'instructions', 'input', 'max_output_tokens', 'stream', 'tools', 'tool_choice', 'reasoning', 'store']);
/** El contenido JSON sigue sujeto a validación semántica del proveedor; no concede capacidades locales. */
export function validateOpenAIRequest(value: unknown): NativeOpenAIRequest {
  const body = openaiSnapshot(value);
  if (!objectValue(body) || Object.keys(body).some(key => !BODY_FIELDS.has(key))
    || typeof body.model !== 'string' || !/^gpt-[a-zA-Z0-9.-]{1,120}$/.test(body.model)
    || !(typeof body.input === 'string' || Array.isArray(body.input))) throw new Error('Solicitud de inferencia no válida.');
  if (body.instructions !== undefined && body.instructions !== null && typeof body.instructions !== 'string') throw new Error('Instrucciones no válidas.');
  if (body.max_output_tokens !== undefined && (!Number.isInteger(body.max_output_tokens) || typeof body.max_output_tokens !== 'number' || body.max_output_tokens < 1 || body.max_output_tokens > 32768)) throw new Error('Presupuesto de salida no válido.');
  if (body.stream !== undefined && body.stream !== null && typeof body.stream !== 'boolean' || body.store !== undefined && body.store !== null && typeof body.store !== 'boolean') throw new Error('Opciones no válidas.');
  if (body.tool_choice !== undefined && !isJsonStringChoice(body.tool_choice, ['auto', 'none', 'required'])) throw new Error('Selección de herramientas no válida.');
  if (body.reasoning !== undefined && body.reasoning !== null && (!objectValue(body.reasoning) || Object.keys(body.reasoning).some(key => key !== 'effort') || !isJsonStringChoice(body.reasoning.effort, ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']))) throw new Error('Esfuerzo de razonamiento no válido.');
  if (body.tools !== undefined) {
    if (!Array.isArray(body.tools) || body.tools.length > 256) throw new Error('Herramientas no válidas.');
    for (const tool of body.tools) {
      if (!objectValue(tool) || !isJsonStringChoice(tool.type, ['function', 'web_search', 'file_search'])) throw new Error('Herramienta no permitida.');
      const fields = tool.type === 'function' ? ['type', 'name', 'description', 'parameters', 'strict'] : tool.type === 'file_search' ? ['type', 'vector_store_ids', 'max_num_results', 'ranking_options', 'filters'] : ['type', 'search_context_size', 'user_location', 'filters', 'external_web_access'];
      if (Object.keys(tool).some(key => !fields.includes(key))) throw new Error('Configuración de herramienta no permitida.');
    }
  }
  // La frontera fija campos/recursos/capacidades; el SDK define los items de contenido del proveedor.
  return body as unknown as NativeOpenAIRequest;
}

export function openaiFailure(code: NativeOpenAIFailureCode, status?: number, retryAfterMs?: number): NativeOpenAIFailure {
  return { success: false, code, error: code === 'CANCELLED' ? 'Generación cancelada.' : code === 'BUSY' ? 'Hay demasiadas generaciones en curso.' : code === 'KEY_MISSING' ? 'No hay una clave OpenAI disponible en el proceso nativo.' : code === 'IPC_DENIED' ? 'La fuente o sesión de inferencia ya no está autorizada.' : code === 'INVALID_PAYLOAD' ? 'La solicitud de inferencia no es válida.' : 'No se pudo completar la generación con el proveedor.',
    ...(status && Number.isInteger(status) && status >= 400 && status <= 599 ? { status } : {}),
    ...(retryAfterMs !== undefined && Number.isFinite(retryAfterMs) && retryAfterMs >= 0 ? { retryAfterMs: Math.min(45000, Math.ceil(retryAfterMs)) } : {}) };
}
