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
  activeTool,
  isLiveActive,
  liveClientRef,
}: UseChatProcessorParams) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState<ToolCallInfo | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const showLoadingUI = shouldShowLoadingUi(isLoading, messages);
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
    activeTool,
  });

  const handleSend = useCallback(async (input: string, selectedImages: string[]) => {
    if (!input.trim() || showLoadingUI) return;

    if (isLiveActive && liveClientRef.current) {
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: input.trim(), timestamp: Date.now() };
      onMessagesChange([...messages, userMsg]);
      liveClientRef.current.sendText(input.trim());
      return;
    }

    const text = input.trim();
    const autodev = (window as unknown as { autodev?: { logFeedback?: (text: string) => Promise<void> } }).autodev;
    autodev?.logFeedback?.(text)?.catch(console.error);
    await processMessage(text, [...selectedImages], [...messages], false);
  }, [showLoadingUI, messages, onMessagesChange, processMessage, isLiveActive, liveClientRef]);

  const handleRegenerate = async (messageId: string) => {
    if (showLoadingUI) return;
    const targetIndex = messages.findIndex((message) => message.id === messageId);
    if (targetIndex === -1) return;

    const historyUpToNow = messages.slice(0, targetIndex);
    const lastUserMsgIndex = historyUpToNow.map((message) => message.role).lastIndexOf('user');
    if (lastUserMsgIndex === -1) return;

    const userMsg = historyUpToNow[lastUserMsgIndex];
    const dedupedHistory = dedupeMessageList(messages.slice(0, lastUserMsgIndex + 1));
    onMessagesChange(dedupedHistory);
    await processMessage(userMsg.text, userMsg.images || [], dedupedHistory, true);
  };

  const handleEditMessage = async (messageId: string, nextText: string, nextImages: string[] = []) => {
    if (showLoadingUI) return;
    const userMessageIndex = messages.findIndex((message) => message.id === messageId && message.role === 'user');
    if (userMessageIndex === -1) return;

    const history = dedupeMessageList(messages.slice(0, userMessageIndex));
    onMessagesChange(history);
    await processMessage(nextText.trim(), nextImages, history, false);
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

  return { isLoading, showLoadingUI, activeToolCall, copiedId, messagesRef, processMessage, handleSend, handleRegenerate, handleEditMessage, handleCopy, handleFeedback };
}
