import type { MutableRefObject } from 'react';

import type { ChatMessage } from '../../services/chat-service';
import type { UserTool } from '../../services/tools-service';
import type { LiveClient } from '../../services/live-api';

export interface UseChatProcessorParams {
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
  liveClientRef: MutableRefObject<LiveClient | null>;
}
