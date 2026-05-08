import type { AuthState, ChatState, FolderState } from './app-types';
import type { UserAISettings } from '../services/settings-service';

interface UseAppDerivedDataOptions {
  auth: AuthState;
  chat: ChatState;
  folder: FolderState;
  userSettings: UserAISettings | null;
}

export function useAppDerivedData({ auth, chat, folder, userSettings }: UseAppDerivedDataOptions) {
  const { sofiaContext, user } = auth;
  const displayName = sofiaContext?.user?.full_name || user?.user_metadata?.first_name || user?.email || 'Usuario';
  const initials = displayName.charAt(0).toUpperCase();
  const currentFolder = folder.folders.find((item) => item.id === folder.currentFolderId);
  const currentConversation = chat.currentConversationId
    ? chat.conversations.find((conversation) => conversation.id === chat.currentConversationId) || null
    : null;
  const movingChat = folder.movingChatId
    ? chat.conversations.find((conversation) => conversation.id === folder.movingChatId)
    : null;
  const avatarUrl =
    sofiaContext?.user?.avatar_url ||
    (sofiaContext?.user as any)?.profile_picture_url ||
    user?.user_metadata?.avatar_url ||
    (user?.user_metadata as any)?.profile_picture_url ||
    (userSettings as any)?.profile_picture_url;

  return { avatarUrl, currentConversation, currentFolder, displayName, initials, movingChat };
}
