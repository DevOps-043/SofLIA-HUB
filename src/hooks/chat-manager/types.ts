import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ChatMessage, Conversation } from '../../services/chat-service';

export interface UseChatManagerOptions {
  userId: string | undefined;
  orgId?: string;
  accessUserIds?: string[];
}

export type ChatManagerState = {
  activeMenuChatId: string | null;
  conversations: Conversation[];
  conversationsRef: MutableRefObject<Conversation[]>;
  currentConversationId: string | null;
  currentConvIdRef: MutableRefObject<string | null>;
  currentFolderIdRef: MutableRefObject<string | null>;
  currentMessages: ChatMessage[];
  currentMessagesRef: MutableRefObject<ChatMessage[]>;
  editingChatTitle: string;
  flushSaveRef: MutableRefObject<(() => Promise<void>) | null>;
  loadingConversations: boolean;
  renamingChatId: string | null;
  saveTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  scopeVersionRef: MutableRefObject<number>;
  setActiveMenuChatId: Dispatch<SetStateAction<string | null>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setCurrentConversationId: Dispatch<SetStateAction<string | null>>;
  setCurrentMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setEditingChatTitle: Dispatch<SetStateAction<string>>;
  setLoadingConversations: Dispatch<SetStateAction<boolean>>;
  setRenamingChatId: Dispatch<SetStateAction<string | null>>;
};

export type ChatStorageKeyResolver = (scopeUserId: string) => string;
