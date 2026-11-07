import { ChatUI } from '../adapters/desktop_ui/ChatUI';
import { ChatUnavailableState } from './ChatUnavailableState';
import type { ChatState } from './app-types';
import type { UserAISettings } from '../services/settings-service';
import type { BrowserSelectionActionRequest } from '../services/integrated-browser-service';

interface AppChatViewProps {
  scopeKey?: string;
  floating?: boolean;
  readVisibleContext?: import('../services/floating-chat-context').FloatingContextReader;
  onBackToProject?: () => void;
  canWriteProjectChat?: boolean;
  compact?: boolean;
  browserOpen?: boolean;
  avatarUrl?: string;
  canShareConversation: boolean;
  chat: ChatState;
  currentConversation: ChatState['conversations'][number] | null;
  externalPrompt: string | null;
  externalSelection: BrowserSelectionActionRequest | null;
  onExternalSelectionProcessed: () => void;
  onExternalPromptProcessed: () => void;
  onMessagesChange: (messages: ChatState['currentMessages']) => void;
  onShareConversation?: () => void;
  userId?: string;
  userSettings: UserAISettings | null;
  onRetryConversations?: () => Promise<boolean>;
  onOpenBrowser?: () => void;
  onOpenMeetings?: () => void;
  onOpenLiveSessions?: () => void;
}

export function AppChatView(props: AppChatViewProps) {
  if (!props.userId) {
    return (
      <ChatUnavailableState onRetry={props.onRetryConversations} />
    );
  }

  return (
    <ChatUI
      key={props.scopeKey}
      floating={props.floating}
      readVisibleContext={props.readVisibleContext}
      onBackToProject={props.onBackToProject}
      compact={props.compact}
      conversationId={props.chat.currentConversationId}
      browserOpen={props.browserOpen ?? props.compact}
      messages={props.chat.currentMessages}
      onMessagesChange={props.onMessagesChange}
      externalPrompt={props.externalPrompt}
      externalSelection={props.externalSelection}
      onExternalSelectionProcessed={props.onExternalSelectionProcessed}
      onExternalPromptProcessed={props.onExternalPromptProcessed}
      personalization={props.userSettings ? {
        nickname: props.userSettings.nickname,
        occupation: props.userSettings.occupation,
        tone: props.userSettings.tone_style,
        instructions: props.userSettings.custom_instructions,
      } : undefined}
      userAvatar={props.avatarUrl}
      onShare={props.canShareConversation ? props.onShareConversation : undefined}
      canSendMessages={props.canWriteProjectChat !== false && props.currentConversation?.can_edit !== false}
      readOnlyReason={props.canWriteProjectChat === false ? 'Los chats de este proyecto son de sólo lectura con tu acceso actual.' : props.currentConversation?.can_edit === false ? 'Esta conversación fue compartida contigo en modo sólo lectura.' : undefined}
      onOpenBrowser={props.onOpenBrowser}
      onOpenMeetings={props.onOpenMeetings}
      onOpenLiveSessions={props.onOpenLiveSessions}
    />
  );
}
