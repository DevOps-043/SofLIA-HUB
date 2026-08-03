import type { Dispatch, SetStateAction } from 'react';

import type { ChatMessage } from '../../services/chat-service';
import { getPublicAiErrorMessage, sendMessageStream, optimizePrompt, type ToolCallInfo } from '../../services/gemini-chat';
import { generateImage } from '../../services/image-generation';
import { buildIrisContext, needsIrisData } from '../../services/iris-data';
import { fetchChatMemoryContext, recordChatTurn } from '../../services/memory-bridge';
import type { UserTool } from '../../services/tools-service';
import type { ThinkingOption } from '../useModelSelector';
import { createAiPlaceholder, createUserMessage, PLACEHOLDER_TEXT } from './message-utils';

interface ProcessChatMessageInput {
  text: string;
  images: string[];
  currentHistory: ChatMessage[];
  isRegeneration: boolean;
  onMessagesChange: (messages: ChatMessage[]) => void;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setActiveToolCall: Dispatch<SetStateAction<ToolCallInfo | null>>;
  preferredPrimaryModel: string;
  thinkingOption?: ThinkingOption;
  personalization?: { nickname?: string; occupation?: string; tone?: string; instructions?: string };
  isPromptOptimizerMode: boolean;
  optimizerTarget: 'chatgpt' | 'claude' | 'gemini';
  isImageGenMode: boolean;
  activeTool: UserTool | null;
  /** Usuario SOFIA para la memoria unificada (owner de la memoria del chat). */
  sofiaUserId?: string;
  /** Señal para cancelar la generación con el botón Stop. */
  signal?: AbortSignal;
  /**
   * ¿Sigue siendo esta la generación vigente? Si una edición/regeneración/envío
   * la superó, devuelve false y este turno deja de escribir (evita que una
   * respuesta tardía pise a la nueva). Por defecto siempre vigente.
   */
  isCurrent?: () => boolean;
}

export async function processChatMessage(input: ProcessChatMessageInput) {
  const { text, images, currentHistory, isRegeneration, onMessagesChange } = input;
  const genId = crypto.randomUUID().slice(0, 8);
  const log = (message: string) => console.log(`[SofLIA-Gen ${genId}] ${message}`);
  input.setIsLoading(true);
  const aiMessageId = crypto.randomUUID();
  const aiPlaceholder = createAiPlaceholder(aiMessageId);
  const updatedMessages = isRegeneration
    ? [...currentHistory, aiPlaceholder]
    : [...currentHistory, createUserMessage(text, images), aiPlaceholder];

  onMessagesChange(updatedMessages);

  const isCurrent = input.isCurrent ?? (() => true);

  // El placeholder "..." DEBE resolverse siempre (éxito, vacío, error, stop o
  // timeout). Si no, un turno que termina sin texto deja un "..." pegado que
  // bloquea la conversación de forma permanente (la carga es por-placeholder).
  // Si este turno fue superado (edición/regeneración), no escribe nada.
  let settled = false;
  const settle = (patch: Partial<ChatMessage>) => {
    settled = true;
    if (!isCurrent()) return;
    updateAiMessage(updatedMessages, aiMessageId, patch, onMessagesChange);
  };

  log(`inicio (modelo=${input.preferredPrimaryModel}, historial=${currentHistory.length})`);
  try {
    if (input.isPromptOptimizerMode) {
      const optimized = await optimizePrompt(text, input.optimizerTarget);
      settle({ text: optimized });
      return;
    }

    if (input.isImageGenMode) {
      const result = await generateImage(text);
      settle({ text: result.text, images: result.imageData ? [result.imageData] : undefined });
      return;
    }

    const cleanHistory = updatedMessages
      .filter((message) => message.id !== aiMessageId)
      .map((message) => ({ role: message.role, text: message.text }));
    // El armado de contexto (IRIS/memoria) va por IPC/red: se acota con timeout
    // y degrada a sin-contexto para que un servicio colgado no congele el turno.
    const irisContext = needsIrisData(text)
      ? await withTimeoutFallback(buildIrisContext(), CONTEXT_TIMEOUT_MS, undefined)
      : undefined;
    // Memoria unificada: inyecta lo que Pulse sabe/aprendio del usuario.
    const memoryContext = await withTimeoutFallback(fetchChatMemoryContext(input.sofiaUserId, text), CONTEXT_TIMEOUT_MS, '');
    log('contexto listo → llamando al modelo');
    const result = await sendMessageStream(text, cleanHistory, {
      model: input.preferredPrimaryModel,
      thinking: input.thinkingOption,
      personalization: input.personalization,
      images: images.length > 0 ? images : undefined,
      toolSystemPrompt: input.activeTool?.system_prompt,
      irisContext,
      memoryContext: memoryContext || undefined,
      userId: input.sofiaUserId,
      onToolCall: (toolCall) => { log(`herramienta: ${toolCall.name}`); input.setActiveToolCall(toolCall); },
      signal: input.signal,
    });
    log('modelo respondió → leyendo stream');

    let fullText = '';
    for await (const chunk of result.stream) {
      if (input.signal?.aborted) break;
      // Superado por una edición/regeneración: abandonar sin escribir.
      if (!isCurrent()) { log('superado por otra generación → abandono'); return; }
      fullText += chunk;
      updateAiMessage(updatedMessages, aiMessageId, { text: fullText || PLACEHOLDER_TEXT }, onMessagesChange);
    }

    if (input.signal?.aborted) {
      // Cancelado por el usuario: resolver el placeholder (nunca dejar "...").
      log('cancelado por el usuario');
      settle({ text: fullText.trim() || '⏹️ Detenido.' });
      return;
    }

    // Registra el turno para que Pulse aprenda (resumen + skills autonomos).
    recordChatTurn(input.sofiaUserId, text, fullText);

    const sources = await result.sources;
    const genImages = result.generatedImages;
    if (genImages?.length && !fullText.trim()) fullText = 'Imagen generada:';
    settle({
      text: fullText.trim() || 'No obtuve una respuesta. Intenta de nuevo.',
      sources: sources && sources.length > 0 ? sources : undefined,
      images: genImages?.length ? genImages : undefined,
    });
    log(`completado (${fullText.length} chars, ${sources?.length || 0} fuentes)`);
  } catch (error) {
    console.error(`[SofLIA-Gen ${genId}] error:`, error);
    settle({ text: getPublicAiErrorMessage(error) });
  } finally {
    // Garantía final: si por CUALQUIER camino no se resolvió, quitar el "..."
    // (salvo que este turno haya sido superado por otra generación).
    if (!settled && isCurrent()) {
      log('turno no resuelto → aplicando mensaje de seguridad');
      updateAiMessage(updatedMessages, aiMessageId, { text: 'No pude completar la respuesta. Intenta de nuevo.' }, onMessagesChange);
    }
    input.setIsLoading(false);
    input.setActiveToolCall(null);
  }
}

const CONTEXT_TIMEOUT_MS = 15_000;

/**
 * Espera una promesa pero devuelve `fallback` si tarda más de `timeoutMs`, para
 * que un servicio de contexto colgado (IPC/red) nunca deje el chat en "...".
 */
async function withTimeoutFallback<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function updateAiMessage(
  messages: ChatMessage[],
  aiMessageId: string,
  patch: Partial<ChatMessage>,
  onMessagesChange: (messages: ChatMessage[]) => void,
) {
  onMessagesChange(messages.map((message) => (
    message.id === aiMessageId ? { ...message, ...patch } : message
  )));
}
