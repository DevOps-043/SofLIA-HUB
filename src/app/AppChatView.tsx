import { ChatUI } from '../adapters/desktop_ui/ChatUI';
import { ChatUnavailableState } from './ChatUnavailableState';
import type { ChatState } from './app-types';
import type { UserAISettings } from '../services/settings-service';

interface AppChatViewProps {
  avatarUrl?: string;
  canShareConversation: boolean;
  chat: ChatState;
  currentConversation: ChatState['conversations'][number] | null;
  externalPrompt: string | null;
  onExternalPromptProcessed: () => void;
  onMessagesChange: (messages: ChatState['currentMessages']) => void;
  onShareConversation?: () => void;
  userId?: string;
  userSettings: UserAISettings | null;
  onRetryConversations?: () => Promise<boolean>;
}

export function AppChatView(props: AppChatViewProps) {
  if (!props.userId) {
    return (
      <ChatUnavailableState onRetry={props.onRetryConversations} />
    );
  }

  return (
    <ChatUI
      messages={props.chat.currentMessages}
      onMessagesChange={props.onMessagesChange}
      externalPrompt={props.externalPrompt}
      onExternalPromptProcessed={props.onExternalPromptProcessed}
      personalization={props.userSettings ? {
        nickname: props.userSettings.nickname,
        occupation: props.userSettings.occupation,
        tone: props.userSettings.tone_style,
        instructions: props.userSettings.custom_instructions,
      } : undefined}
      userAvatar={props.avatarUrl}
      onShare={props.canShareConversation ? props.onShareConversation : undefined}
      canSendMessages={props.currentConversation?.can_edit !== false}
      readOnlyReason={props.currentConversation?.can_edit === false ? 'Esta conversacion fue compartida contigo en modo solo lectura.' : undefined}
    />
  );
}
