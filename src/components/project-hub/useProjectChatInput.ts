import { useRef, useState } from 'react';

interface UseProjectChatInputOptions {
  canEditFolder: boolean;
  onNewChat: () => void;
  onNewChatWithMessage?: (message: string) => void;
}

export function useProjectChatInput(options: UseProjectChatInputOptions) {
  const { canEditFolder, onNewChat, onNewChatWithMessage } = options;
  const [chatInput, setChatInput] = useState('');
  const chatInputRef = useRef<HTMLInputElement>(null);

  function submitChatInput(): void {
    if (!canEditFolder) return;
    const text = chatInput.trim();
    if (!text) return;

    setChatInput('');
    if (onNewChatWithMessage) {
      onNewChatWithMessage(text);
    } else {
      onNewChat();
    }
  }

  return { chatInput, chatInputRef, setChatInput, submitChatInput };
}
