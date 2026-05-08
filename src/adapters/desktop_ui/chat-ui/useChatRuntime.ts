import { useEffect, useRef } from 'react';
import { useChatProcessor } from '../../../hooks/useChatProcessor';
import { useLiveApi } from '../../../hooks/useLiveApi';
import { useModelSelector } from '../../../hooks/useModelSelector';
import type { ChatUIProps, ProcessMessageHandler } from './types';
import type { useChatUIState } from './useChatUIState';

export function useChatRuntime(
  props: ChatUIProps,
  state: ReturnType<typeof useChatUIState>,
) {
  const messagesRef = useRef(props.messages);
  const processMessageRef = useRef<ProcessMessageHandler | null>(null);
  const externalPromptProcessedRef = useRef<(() => void) | undefined>(props.onExternalPromptProcessed);
  const lastProcessedExternalPromptRef = useRef<string | null>(null);
  messagesRef.current = props.messages;

  const model = useModelSelector();
  const liveApi = useLiveApi({ messagesRef, onMessagesChange: props.onMessagesChange });
  const chat = useChatProcessor({
    messages: props.messages,
    onMessagesChange: props.onMessagesChange,
    personalization: props.personalization,
    preferredPrimaryModel: model.preferredPrimaryModel,
    thinkingMode: model.thinkingMode,
    isImageGenMode: state.modes.imageGen,
    isPromptOptimizerMode: state.modes.promptOptimizer,
    optimizerTarget: state.modes.optimizerTarget,
    activeTool: state.toolModals.activeTool,
    isLiveActive: liveApi.isLiveActive,
    liveClientRef: liveApi.liveClientRef,
  });
  processMessageRef.current = chat.processMessage;
  externalPromptProcessedRef.current = props.onExternalPromptProcessed;

  useEffect(() => {
    if (!props.externalPrompt) {
      lastProcessedExternalPromptRef.current = null;
      return;
    }
    if (lastProcessedExternalPromptRef.current === props.externalPrompt) return;
    lastProcessedExternalPromptRef.current = props.externalPrompt;
    externalPromptProcessedRef.current?.();
    if (props.canSendMessages !== false) {
      processMessageRef.current?.(props.externalPrompt, [], messagesRef.current, false);
    }
  }, [props.canSendMessages, props.externalPrompt]);

  return { model, liveApi, chat, messagesRef };
}
