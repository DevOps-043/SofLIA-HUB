import type { GenerateContentResponse, SendMessageParameters } from '@google/genai';
import type { JsonObject } from '../../shared/bounded-json';
import { jsonObject } from '../../shared/grounded-generation';
import type { GeminiMediaResolution, NativeGeminiConversationApi, NativeGeminiReply, NativeGeminiRequest, NativeGeminiSend } from '../../shared/native-gemini-conversation';
import { observeApiKeySession } from '../api-keys/session-scope';
import { getGenAiClient } from './client';
import type { GeminiChatConfig } from './model-config';

declare global { interface Window { geminiConversation?: NativeGeminiConversationApi } }
interface ConversationSetup {
  model: string;
  config: GeminiChatConfig;
  history: Array<{ role: string; parts: Array<{ text: string }> }>;
}
interface Conversation {
  sendMessage(input: SendMessageParameters): Promise<Pick<GenerateContentResponse, 'text' | 'candidates' | 'promptFeedback'>>;
}

export function hasNativeGeminiConversation(): boolean {
  return typeof window !== 'undefined' && Boolean(window.geminiConversation || window.appRuntime || window.ipcRenderer);
}
function abortError(): DOMException { return new DOMException('La conversación fue cancelada o cambió de sesión.', 'AbortError'); }
function success(reply: NativeGeminiReply): asserts reply is Extract<NativeGeminiReply, { success: true }> {
  if (!jsonObject(reply)) throw new Error('Respuesta de conversación no válida.');
  if (reply.success === true) return;
  if (reply.code === 'REVOKED') throw abortError();
  if (reply.code === 'TIMEOUT') throw new Error('La conversación excedió su plazo de respuesta.');
  const status = typeof reply.status === 'number' && [400, 401, 403, 404, 429, 500, 503].includes(reply.status) ? reply.status : undefined;
  throw Object.assign(new Error('No se pudo completar la conversación en la aplicación.'), { status });
}
async function whileActive<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(abortError());
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
  try { return await Promise.race([pending, cancelled]); }
  finally { signal.removeEventListener('abort', abort); }
}
function turnId(reply: NativeGeminiReply): string | undefined {
  return reply?.success === true && 'turnId' in reply && typeof reply.turnId === 'string' && /^[a-f0-9-]{36}$/.test(reply.turnId) ? reply.turnId : undefined;
}

export async function withGeminiConversation<T>(
  setup: ConversationSetup,
  signal: AbortSignal | undefined,
  work: (chat: Conversation, signal?: AbortSignal) => Promise<T>,
): Promise<T> {
  if (signal?.aborted) throw abortError();
  if (!hasNativeGeminiConversation()) {
    const ai = await getGenAiClient();
    if (signal?.aborted) throw abortError();
    return work(ai.chats.create(setup), signal);
  }
  const api = window.geminiConversation;
  if (typeof api?.request !== 'function') throw new Error('La conversación Gemini requiere su puente nativo.');
  const scope = observeApiKeySession();
  const current = signal ? AbortSignal.any([signal, scope.signal]) : scope.signal;
  const assertCurrent = () => { if (current.aborted || window.geminiConversation !== api) throw abortError(); };
  const requestNative = async (request: NativeGeminiRequest) => {
    try { return await api.request(request); }
    catch { throw new Error('No se pudo comunicar con el puente de conversación.'); }
  };
  let id: string | undefined;
  let closed = false;
  const close = (activeId: string) => {
    if (closed) return;
    closed = true;
    void requestNative({ operation: 'close', turnId: activeId }).catch(() => undefined);
  };
  const onAbort = () => { if (id) close(id); };
  current.addEventListener('abort', onAbort, { once: true });
  try {
    assertCurrent();
    const opening = requestNative({ operation: 'open', model: setup.model, config: setup.config as JsonObject, history: setup.history });
    void opening.then(reply => {
      const lateId = turnId(reply);
      if (current.aborted && lateId) close(lateId);
    }, () => undefined);
    const opened = await whileActive(opening, current);
    success(opened);
    id = turnId(opened);
    if (!id) throw new Error('Identificador de conversación no válido.');
    const activeId = id;
    assertCurrent();
    const chat: Conversation = { sendMessage: async input => {
      assertCurrent();
      const request: NativeGeminiSend = { operation: 'send', turnId: activeId, message: input.message as NativeGeminiSend['message'] };
      if (input.config?.mediaResolution) request.mediaResolution = input.config.mediaResolution as GeminiMediaResolution;
      if (input.config?.tools?.length === 0) request.disableTools = true;
      const reply = await whileActive(requestNative(request), current);
      assertCurrent();
      success(reply);
      if (!('response' in reply) || !jsonObject(reply.response)) throw new Error('Respuesta de conversación no válida.');
      return reply.response as unknown as Pick<GenerateContentResponse, 'text' | 'candidates' | 'promptFeedback'>;
    } };
    const result = await work(chat, current);
    assertCurrent();
    return result;
  } finally {
    current.removeEventListener('abort', onAbort);
    scope.dispose();
    if (id) close(id);
  }
}
