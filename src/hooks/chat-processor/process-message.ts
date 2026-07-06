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
}

export async function processChatMessage(input: ProcessChatMessageInput) {
  const { text, images, currentHistory, isRegeneration, onMessagesChange } = input;
  input.setIsLoading(true);
  const aiMessageId = crypto.randomUUID();
  const aiPlaceholder = createAiPlaceholder(aiMessageId);
  const updatedMessages = isRegeneration
    ? [...currentHistory, aiPlaceholder]
    : [...currentHistory, createUserMessage(text, images), aiPlaceholder];

  onMessagesChange(updatedMessages);

  try {
    if (input.isPromptOptimizerMode) {
      const optimized = await optimizePrompt(text, input.optimizerTarget);
      updateAiMessage(updatedMessages, aiMessageId, { text: optimized }, onMessagesChange);
      return;
    }

    if (input.isImageGenMode) {
      const result = await generateImage(text);
      updateAiMessage(updatedMessages, aiMessageId, {
        text: result.text,
        images: result.imageData ? [result.imageData] : undefined,
      }, onMessagesChange);
      return;
    }

    const cleanHistory = updatedMessages
      .filter((message) => message.id !== aiMessageId)
      .map((message) => ({ role: message.role, text: message.text }));
    const irisContext = needsIrisData(text) ? await buildIrisContext() : undefined;
    // Memoria unificada: inyecta lo que SofLIA sabe/aprendio del usuario.
    const memoryContext = await fetchChatMemoryContext(input.sofiaUserId, text);
    const result = await sendMessageStream(text, cleanHistory, {
      model: input.preferredPrimaryModel,
      thinking: input.thinkingOption,
      personalization: input.personalization,
      images: images.length > 0 ? images : undefined,
      toolSystemPrompt: input.activeTool?.system_prompt,
      irisContext,
      memoryContext: memoryContext || undefined,
      onToolCall: (toolCall) => input.setActiveToolCall(toolCall),
    });

    let fullText = '';
    for await (const chunk of result.stream) {
      fullText += chunk;
      updateAiMessage(updatedMessages, aiMessageId, { text: fullText || PLACEHOLDER_TEXT }, onMessagesChange);
    }

    // Registra el turno para que SofLIA aprenda (resumen + skills autonomos).
    recordChatTurn(input.sofiaUserId, text, fullText);

    const sources = await result.sources;
    const genImages = result.generatedImages;
    if (genImages?.length && !fullText.trim()) fullText = 'Imagen generada:';
    if ((sources && sources.length > 0) || (genImages && genImages.length > 0) || fullText) {
      updateAiMessage(updatedMessages, aiMessageId, {
        text: fullText || PLACEHOLDER_TEXT,
        sources: sources || undefined,
        images: genImages?.length ? genImages : undefined,
      }, onMessagesChange);
    }
  } catch (error) {
    console.error('Chat error:', error);
    updateAiMessage(updatedMessages, aiMessageId, { text: getPublicAiErrorMessage(error) }, onMessagesChange);
  } finally {
    input.setIsLoading(false);
    input.setActiveToolCall(null);
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
