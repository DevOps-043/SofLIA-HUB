import type { ChatMessage } from '../../../services/chat-service';

export type OptimizerTarget = 'chatgpt' | 'claude' | 'gemini';

export type ProcessMessageHandler = (
  text: string,
  images: string[],
  currentHistory: ChatMessage[],
  isRegeneration?: boolean,
) => Promise<void>;

export interface ConfirmationModalState {
  toolName: string;
  description: string;
  resolve: (confirmed: boolean) => void;
}

export interface ChatUIProps {
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  personalization?: {
    nickname?: string;
    occupation?: string;
    tone?: string;
    instructions?: string;
  };
  userAvatar?: string | null;
  externalPrompt?: string | null;
  onExternalPromptProcessed?: () => void;
  onShare?: () => void;
  canSendMessages?: boolean;
  readOnlyReason?: string | null;
}
