import type { Response, ResponseCreateParamsNonStreaming, ResponseCreateParamsStreaming, ResponseStreamEvent } from 'openai/resources/responses/responses';
import { objectValue, openaiFailure, openaiRuntimeId, openaiSnapshot, validateOpenAIRequest, type NativeOpenAIFailure, type NativeOpenAIRequest, type OpenAIRuntimeApi } from '../../shared/openai-runtime';

declare global { interface Window { openaiRuntime?: OpenAIRuntimeApi } }
interface Options { signal?: AbortSignal | null; maxRetries?: number }
export interface NativeResponses {
  create(body: ResponseCreateParamsStreaming, options?: Options): Promise<AsyncIterable<ResponseStreamEvent>>;
  create(body: ResponseCreateParamsNonStreaming, options?: Options): Promise<Response>;
}
function aborted(): Error { const error = new Error('Generación cancelada.'); error.name = 'AbortError'; return error; }
export function nativeFailure(value: NativeOpenAIFailure): Error {
  const safe = openaiFailure(value.code, value.status, value.retryAfterMs);
  const reason = value.reason === 'context_length' ? 'context length exceeded. ' : value.reason === 'invalid_key' ? 'OPENAI_API_KEY_MISSING. ' : value.reason === 'model_config' ? 'unsupported reasoning.effort. ' : value.reason === 'safety' ? 'safety. ' : value.reason === 'timeout' ? 'timeout. ' : '';
  const error = new Error(reason + (safe.code === 'KEY_MISSING' ? 'OPENAI_API_KEY_MISSING. ' : '') + safe.error + (safe.status ? ` HTTP ${safe.status}.` : ''));
  if (safe.code === 'CANCELLED' || safe.code === 'IPC_DENIED') error.name = 'AbortError';
  return Object.assign(error, { code: safe.code, status: safe.status, retryAfterMs: safe.retryAfterMs });
}
function checkReply(value: unknown): asserts value is { success: true } {
  if (!objectValue(value) || value.success !== true) {
    if (objectValue(value) && typeof value.code === 'string' && ['INVALID_PAYLOAD', 'IPC_DENIED', 'CANCELLED', 'BUSY', 'KEY_MISSING', 'PROVIDER_FAILED'].includes(value.code)) throw nativeFailure(value as unknown as NativeOpenAIFailure);
    throw new Error('Respuesta de inferencia nativa no válida.');
  }
}
function wait<T>(pending: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return pending;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(aborted());
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    void pending.then(value => { signal.removeEventListener('abort', onAbort); resolve(value); }, error => { signal.removeEventListener('abort', onAbort); reject(error); });
  });
}

/** Puerto Responses utilizado por chat/workers: ninguna clave o cliente HTTP en renderer. */
export async function openNativeResponses(): Promise<{ responses: NativeResponses }> {
  const bridge = typeof window === 'undefined' ? undefined : window.openaiRuntime;
  if (!bridge) throw new Error('La inferencia OpenAI requiere el puente nativo.');
  const api: OpenAIRuntimeApi = bridge;
  const opened = await api.open(); checkReply(opened);
  const scopeId = openaiRuntimeId(opened.scopeId);
  async function create(body: ResponseCreateParamsStreaming, options?: Options): Promise<AsyncIterable<ResponseStreamEvent>>;
  async function create(body: ResponseCreateParamsNonStreaming, options?: Options): Promise<Response>;
  async function create(body: NativeOpenAIRequest, options: Options = {}): Promise<Response | AsyncIterable<ResponseStreamEvent>> {
    if (options.signal?.aborted) throw aborted();
    const input = validateOpenAIRequest(body), id = crypto.randomUUID();
    let cancelled = false, finished = false;
    const cancel = () => {
      cancelled = true;
      void api!.cancel(scopeId, id).catch(() => undefined);
    };
    options.signal?.addEventListener('abort', cancel, { once: true });
    const finish = () => { if (finished) return; finished = true; options.signal?.removeEventListener('abort', cancel); cancel(); };
    let cursor = 0;
    const pull = async () => {
      if (cancelled || options.signal?.aborted) throw aborted();
      const reply = await wait(api!.pull(scopeId, id, cursor), options.signal);
      if (cancelled || options.signal?.aborted) throw aborted();
      checkReply(reply);
      if (!['response', 'event', 'done'].includes(reply.kind) || reply.cursor !== cursor + 1) throw new Error('Secuencia de inferencia no válida.');
      cursor = reply.cursor; return reply;
    };
    try {
      // Incluso si se cancela esperando admisión, retirar el trabajo al resolver start.
      const starting = api.start(scopeId, id, input, options.maxRetries);
      void starting.then(() => { if (cancelled) void api.cancel(scopeId, id).catch(() => undefined); }, () => undefined);
      const admitted = await wait(starting, options.signal); checkReply(admitted);
      if (cancelled || options.signal?.aborted) throw aborted();
      if (input.stream === true) {
        const iterator = (async function* () {
          try {
            for (;;) {
              const reply = await pull();
              if (reply.kind === 'done') return;
              if (reply.kind !== 'event') throw new Error('Evento de inferencia no válido.');
              const snapshot = openaiSnapshot(reply.event);
              if (!objectValue(snapshot) || typeof snapshot.type !== 'string') throw new Error('Evento de inferencia no válido.');
              yield snapshot as unknown as ResponseStreamEvent;
            }
          } finally { finish(); }
        })();
        return { [Symbol.asyncIterator]: () => ({
          next: () => iterator.next(),
          return: async () => { finish(); return iterator.return(undefined); },
          throw: async error => { finish(); return iterator.throw(error); },
        }) };
      }
      const reply = await pull();
      if (reply.kind !== 'response') throw new Error('Respuesta de inferencia no válida.');
      const snapshot = openaiSnapshot(reply.response);
      if (!objectValue(snapshot) || typeof snapshot.output_text !== 'string') throw new Error('Respuesta de inferencia no válida.');
      finish(); return snapshot as unknown as Response;
    } catch (error) { finish(); throw error; }
  }
  return { responses: { create } };
}
