import type { Dispatch, SetStateAction } from 'react';

import type { ChatMessage } from '../../services/chat-service';
import type { ToolCallInfo } from '../../services/gemini-chat';
import type { UserTool } from '../../services/tools-service';
import type { ThinkingOption } from '../useModelSelector';
import { processChatMessage } from './process-message';

interface CreateProcessMessageInput {
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
  sofiaUserId?: string;
}

export function createProcessMessage(input: CreateProcessMessageInput) {
  return (
    text: string,
    images: string[],
    currentHistory: ChatMessage[],
    isRegeneration = false,
  ) => processChatMessage({ ...input, text, images, currentHistory, isRegeneration });
}
