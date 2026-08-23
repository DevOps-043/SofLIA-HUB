import { useState, useCallback, useRef } from 'react';

import type { ChatMessage } from '../services/chat-service';
import type { ToolCallInfo } from '../services/gemini-chat';
import { MODEL_OPTIONS, type ThinkingOption } from './useModelSelector';
import { copyTextWithFallback } from './chat-processor/clipboard';
import { createProcessMessage } from './chat-processor/create-process-message';
import { dedupeMessageList, shouldShowLoadingUi } from './chat-processor/message-utils';
import type { UseChatProcessorParams } from './chat-processor/types';

export function useChatProcessor({
  messages,
  onMessagesChange,
  personalization,
  preferredPrimaryModel,
  thinkingMode,
  isImageGenMode,
  isPromptOptimizerMode,
  optimizerTarget,
  activeSkill,
  memorySessionScope,
  sofiaUserId,
}: UseChatProcessorParams) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState<ToolCallInfo | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // Controlador de cancelación del turno en curso (botón Stop).
  const abortRef = useRef<AbortController | null>(null);
  // Token de generación: solo la más reciente puede escribir en el chat. Al
  // editar/regenerar/enviar se incrementa y la generación anterior queda superada.
  const genTokenRef = useRef(0);

  const showLoadingUI = shouldShowLoadingUi(messages);
  const activeModel = MODEL_OPTIONS.find((model) => model.id === preferredPrimaryModel);
  const thinkingOption: ThinkingOption | undefined = activeModel?.thinkingOptions.find((option) => option.id === thinkingMode);

  const processMessage = createProcessMessage({
    onMessagesChange,
    setIsLoading,
    setActiveToolCall,
    preferredPrimaryModel,
    thinkingOption,
    personalization,
    isPromptOptimizerMode,
    optimizerTarget,
    isImageGenMode,
    activeSkill,
    memorySessionScope,
    sofiaUserId,
  });

  // Ejecuta un turno bajo un AbortController fresco para poder cancelarlo.
  // Aborta cualquier generación previa y la marca superada (token), para poder
  // editar/regenerar mientras otra genera sin que la vieja pise a la nueva.
  const runWithAbort = useCallback(async (
    text: string,
    images: string[],
    history: ChatMessage[],
    isRegeneration: boolean,
    selectionContext?: string,
  ) => {
    abortRef.current?.abort();
    const token = ++genTokenRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await processMessage(text, images, history, isRegeneration, controller.signal, () => genTokenRef.current === token, selectionContext);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [processMessage]);

  // Detiene TODO lo que SofLIA esté ejecutando: el stream/loop de texto y
  // cualquier tarea de Computer Use / Desktop Agent en curso.
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    const desktopAgent = (window as unknown as { desktopAgent?: { abort?: () => Promise<unknown> } }).desktopAgent;
    void desktopAgent?.abort?.();
  }, []);

  const handleSend = useCallback(async (input: string, selectedImages: string[], selectionContext?: string) => {
    if (!input.trim() || showLoadingUI) return;

    const text = input.trim();
    const autodev = (window as unknown as { autodev?: { logFeedback?: (text: string) => Promise<void> } }).autodev;
    autodev?.logFeedback?.(text)?.catch(console.error);
    await runWithAbort(text, [...selectedImages], [...messages], false, selectionContext);
  }, [showLoadingUI, messages, runWithAbort]);

  const handleRegenerate = async (messageId: string) => {
    // Se permite durante una generación: runWithAbort aborta la anterior.
    const targetIndex = messages.findIndex((message) => message.id === messageId);
    if (targetIndex === -1) return;

    const historyUpToNow = messages.slice(0, targetIndex);
    const lastUserMsgIndex = historyUpToNow.map((message) => message.role).lastIndexOf('user');
    if (lastUserMsgIndex === -1) return;

    const userMsg = historyUpToNow[lastUserMsgIndex];
    const dedupedHistory = dedupeMessageList(messages.slice(0, lastUserMsgIndex + 1));
    onMessagesChange(dedupedHistory);
    await runWithAbort(userMsg.text, userMsg.images || [], dedupedHistory, true);
  };

  const handleEditMessage = async (messageId: string, nextText: string, nextImages: string[] = []) => {
    // Se permite durante una generación: runWithAbort aborta la anterior.
    const userMessageIndex = messages.findIndex((message) => message.id === messageId && message.role === 'user');
    if (userMessageIndex === -1) return;

    const history = dedupeMessageList(messages.slice(0, userMessageIndex));
    onMessagesChange(history);
    await runWithAbort(nextText.trim(), nextImages, history, false);
  };

  const handleCopy = (id: string, text: string) => {
    if (!text) return;
    copyTextWithFallback(text).then((success) => {
      if (!success) return;
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleFeedback = (messageId: string, type: 'like' | 'dislike') => {
    onMessagesChange(messages.map((message) => (
      message.id === messageId
        ? { ...message, feedback: message.feedback === type ? undefined : type }
        : message
    )));
  };

  return { isLoading, showLoadingUI, activeToolCall, copiedId, messagesRef, processMessage, handleSend, handleRegenerate, handleEditMessage, handleCopy, handleFeedback, stopGeneration };
}
