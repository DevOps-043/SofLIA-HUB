import type { Dispatch, SetStateAction } from 'react';

import type { ChatMessage } from '../../services/chat-service';
import type { ToolCallInfo } from '../../services/gemini-chat';
import type { ActiveSkillState } from '../../services/skills/active-skill';
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
  activeSkill: ActiveSkillState | null;
  memorySessionScope: string;
  sofiaUserId?: string;
}

export function createProcessMessage(input: CreateProcessMessageInput) {
  return (
    text: string,
    images: string[],
    currentHistory: ChatMessage[],
    isRegeneration = false,
    signal?: AbortSignal,
    isCurrent?: () => boolean,
    selectionContext?: string,
  ) => processChatMessage({ ...input, text, images, currentHistory, isRegeneration, signal, isCurrent, selectionContext });
}
