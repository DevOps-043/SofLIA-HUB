import type { ChatMessage } from '../../services/chat-service';
import type { ActiveSkillState } from '../../services/skills/active-skill';

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
  activeSkill: ActiveSkillState | null;
  /** Usuario SOFIA para la memoria unificada del chat (owner). */
  sofiaUserId?: string;
}
