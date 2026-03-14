import { useState, useCallback, useRef } from 'react';
import { sendMessageStream, optimizePrompt, type ToolCallInfo } from '../services/gemini-chat';
import { generateImage } from '../services/image-generation';
import { buildIrisContext, needsIrisData } from '../services/iris-data';
import type { ChatMessage } from '../services/chat-service';
import type { UserTool } from '../services/tools-service';
import type { LiveClient } from '../services/live-api';
import type { ThinkingOption } from './useModelSelector';
import { MODEL_OPTIONS } from './useModelSelector';

const PLACEHOLDER_TEXT = '...';

interface UseChatProcessorParams {
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  personalization?: {
    nickname?: string;
    occupation?: string;
    tone?: string;
    instructions?: string;
  };
  preferredPrimaryModel: string;
  thinkingMode: string;
  isImageGenMode: boolean;
  isPromptOptimizerMode: boolean;
  optimizerTarget: 'chatgpt' | 'claude' | 'gemini';
  activeTool: UserTool | null;
  isLiveActive: boolean;
  liveClientRef: React.MutableRefObject<LiveClient | null>;
}

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

  const showLoadingUI = isLoading || (messages.length > 0 && messages[messages.length - 1].role === 'model' && !messages[messages.length - 1].text && !(messages[messages.length - 1].images && messages[messages.length - 1].images!.length > 0));

  const processMessage = async (
    text: string,
    images: string[],
    currentHistory: ChatMessage[],
    isRegeneration: boolean = false
  ) => {
    setIsLoading(true);

    let updatedMessages = [...currentHistory];
    const aiMessageId = crypto.randomUUID();

    if (!isRegeneration) {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: text,
        timestamp: Date.now(),
        images: images.length > 0 ? [...images] : undefined,
      };
      const aiPlaceholder: ChatMessage = {
        id: aiMessageId,
        role: 'model',
        text: PLACEHOLDER_TEXT,
        timestamp: Date.now(),
      };
      updatedMessages = [...currentHistory, userMessage, aiPlaceholder];
      onMessagesChange(updatedMessages);
    } else {
      const aiPlaceholder: ChatMessage = {
        id: aiMessageId,
        role: 'model',
        text: PLACEHOLDER_TEXT,
        timestamp: Date.now(),
      };
      updatedMessages = [...currentHistory, aiPlaceholder];
      onMessagesChange(updatedMessages);
    }

    try {
      // Prompt Optimizer mode
      if (isPromptOptimizerMode) {
        const optimized = await optimizePrompt(text, optimizerTarget);
        onMessagesChange(
          updatedMessages.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: optimized } : msg
          )
        );
        return;
      }

      // Image Generation mode
      if (isImageGenMode) {
        const result = await generateImage(text);
        const resultImages = result.imageData ? [result.imageData] : undefined;
        onMessagesChange(
          updatedMessages.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: result.text, images: resultImages } : msg
          )
        );
        return;
      }

      // Normal chat (with optional attached images)
      const cleanHistory = updatedMessages
        .filter(m => m.id !== aiMessageId)
        .map(m => ({ role: m.role, text: m.text }));

      const activeModel = MODEL_OPTIONS.find(m => m.id === preferredPrimaryModel);
      const thinkingOption: ThinkingOption | undefined = activeModel?.thinkingOptions.find(o => o.id === thinkingMode);
      const irisContext = needsIrisData(text) ? await buildIrisContext() : undefined;

      const result = await sendMessageStream(text, cleanHistory, {
        model: preferredPrimaryModel,
        thinking: thinkingOption,
        personalization,
        images: images.length > 0 ? images : undefined,
        toolSystemPrompt: activeTool?.system_prompt,
        irisContext,
        onToolCall: (toolCall) => {
          setActiveToolCall(toolCall);
        },
      });

      let fullText = '';
      for await (const chunk of result.stream) {
        fullText += chunk;
        onMessagesChange(
          updatedMessages.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: fullText || PLACEHOLDER_TEXT } : msg
          )
        );
      }

      const sources = await result.sources;
      const genImages = result.generatedImages;

      if (genImages && genImages.length > 0 && !fullText.trim()) {
        fullText = 'Imagen generada:';
      }

      if ((sources && sources.length > 0) || (genImages && genImages.length > 0) || fullText) {
        onMessagesChange(
          updatedMessages.map(msg =>
            msg.id === aiMessageId ? {
              ...msg,
              text: fullText || PLACEHOLDER_TEXT,
              sources: sources || undefined,
              images: genImages?.length ? genImages : undefined
            } : msg
          )
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorText = error instanceof Error ? error.message : 'Error desconocido';
      onMessagesChange(
        updatedMessages.map(msg =>
          msg.id === aiMessageId
            ? { ...msg, text: `**Error**: ${errorText}` }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setActiveToolCall(null);
    }
  };

  const handleSend = useCallback(async (input: string, selectedImages: string[]) => {
    if (!input.trim() || showLoadingUI) return;

    // If Live API is active, send text through WebSocket
    if (isLiveActive && liveClientRef.current) {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: input.trim(),
        timestamp: Date.now(),
      };
      onMessagesChange([...messages, userMsg]);
      liveClientRef.current.sendText(input.trim());
      return;
    }

    const text = input.trim();
    const images = [...selectedImages];
    const history = [...messages];

    // Self-learn: Send message to AutoDev
    if ((window as unknown as Record<string, unknown>).autodev) {
      const autodev = (window as unknown as Record<string, unknown>).autodev as { logFeedback?: (text: string) => Promise<void> };
      autodev.logFeedback?.(text)?.catch(console.error);
    }

    await processMessage(text, images, history, false);
  }, [showLoadingUI, messages, onMessagesChange, preferredPrimaryModel, thinkingMode, personalization, isImageGenMode, isPromptOptimizerMode, optimizerTarget, activeTool, isLiveActive]);

  const handleRegenerate = async (index: number) => {
    if (showLoadingUI) return;

    const historyUpToNow = messages.slice(0, index);
    const lastUserMsgIndex = historyUpToNow.map(m => m.role).lastIndexOf('user');

    if (lastUserMsgIndex !== -1) {
      const userMsg = historyUpToNow[lastUserMsgIndex];
      const newHistory = messages.slice(0, lastUserMsgIndex + 1);

      const seen = new Set<string>();
      const dedupedHistory = newHistory.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      onMessagesChange(dedupedHistory);
      await processMessage(userMsg.text, userMsg.images || [], dedupedHistory, true);
    }
  };

  const handleCopy = (id: string, text: string) => {
    if (!text) return;

    const performCopy = async () => {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (err) {
          console.warn('Navigator clipboard failed, trying fallback', err);
        }
      }

      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        console.error('Fallback copy failed', err);
        return false;
      }
    };

    performCopy().then((success) => {
      if (success) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    });
  };

  const handleFeedback = (index: number, type: 'like' | 'dislike') => {
    const updated = messages.map((msg, i) => {
      if (i === index) {
        return {
          ...msg,
          feedback: msg.feedback === type ? undefined : type
        };
      }
      return msg;
    });
    onMessagesChange(updated);
  };

  return {
    isLoading,
    showLoadingUI,
    activeToolCall,
    copiedId,
    messagesRef,
    processMessage,
    handleSend,
    handleRegenerate,
    handleCopy,
    handleFeedback,
  };
}
