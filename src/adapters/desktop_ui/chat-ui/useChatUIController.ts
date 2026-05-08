import { useEffect } from 'react';
import type { UIEvent } from 'react';
import { setConfirmationHandler } from '../../../services/computer-use-service';
import type { ChatUIProps } from './types';
import { useChatFileHandlers } from './useChatFileHandlers';
import { useChatRuntime } from './useChatRuntime';
import { useChatTools } from './useChatTools';
import { useChatUIState } from './useChatUIState';
import { useDictation } from './useDictation';

export function useChatUIController(props: ChatUIProps) {
  const canSendMessages = props.canSendMessages ?? true;
  const normalizedProps = { ...props, canSendMessages };
  const state = useChatUIState();
  const runtime = useChatRuntime(normalizedProps, state);
  const files = useChatFileHandlers(canSendMessages, state.images.setSelected);
  const dictation = useDictation(state.input.set);
  const tools = useChatTools(canSendMessages, state, runtime);
  const setConfirmationModal = state.confirmation.setModal;

  useEffect(() => {
    setConfirmationHandler((toolName: string, description: string) => new Promise<boolean>((resolve) => {
      setConfirmationModal({ toolName, description, resolve });
    }));
    return () => setConfirmationHandler(null);
  }, [setConfirmationModal]);

  useEffect(() => {
    state.refs.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [normalizedProps.messages, state.refs.messagesEndRef]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const currentScrollTop = event.currentTarget.scrollTop;
    const delta = currentScrollTop - state.refs.lastScrollTopRef.current;
    if (currentScrollTop < 50) {
      state.header.setShow(true);
      state.header.setSticky(false);
    } else {
      state.header.setSticky(true);
      if (delta > 8) state.header.setShow(true);
      else if (delta < -8) state.header.setShow(false);
    }
    state.refs.lastScrollTopRef.current = currentScrollTop;
  };

  const onSendClick = async () => {
    if (!canSendMessages || !state.input.value.trim() || runtime.chat.showLoadingUI) return;
    const text = state.input.value.trim();
    const images = [...state.images.selected];
    state.input.set('');
    state.images.setSelected(() => []);
    await runtime.chat.handleSend(text, images);
  };

  return {
    props: normalizedProps,
    state,
    runtime,
    files,
    dictation,
    tools,
    refs: state.refs,
    handleScroll,
    onSendClick,
  };
}

export type ChatUIController = ReturnType<typeof useChatUIController>;
