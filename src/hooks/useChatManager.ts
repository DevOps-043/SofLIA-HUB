import { useCallback } from 'react';
import { useChatActions } from './chat-manager/useChatActions';
import { useChatManagerState } from './chat-manager/useChatManagerState';
import { useChatRefreshEffects } from './chat-manager/useChatRefreshEffects';
import { useConversationRefresh } from './chat-manager/useConversationRefresh';
import { useScopedMessagesHandler } from './chat-manager/useScopedMessagesHandler';
import type { UseChatManagerOptions } from './chat-manager/types';

export function useChatManager({ userId, orgId, accessUserIds }: UseChatManagerOptions) {
  const state = useChatManagerState(userId);
  const getCurrentChatStorageKey = useCallback((scopeUserId: string) => `lia_current_chat_id_${scopeUserId}`, []);
  const refresh = useConversationRefresh({ accessUserIds, getCurrentChatStorageKey, orgId, state, userId });
  const scoped = useScopedMessagesHandler({ accessUserIds, getCurrentChatStorageKey, orgId, state, userId });
  const actions = useChatActions({
    accessUserIds,
    flushPendingSave: scoped.flushPendingSave,
    getCurrentChatStorageKey,
    orgId,
    refreshConversationsFromRemote: refresh.refreshConversationsFromRemote,
    state,
    userId,
  });

  useChatRefreshEffects({
    currentConversationId: state.currentConversationId,
    currentConvIdRef: state.currentConvIdRef,
    currentMessagesRef: state.currentMessagesRef,
    refreshConversationsFromRemote: refresh.refreshConversationsFromRemote,
    refreshCurrentConversationMessages: refresh.refreshCurrentConversationMessages,
    userId,
  });

  const getScopedMessagesHandler = useCallback((currentFolderId: string | null) => {
    state.currentFolderIdRef.current = currentFolderId;
    return scoped.createScopedMessagesHandler(state.currentConversationId, currentFolderId);
  }, [scoped, state]);

  return {
    activeMenuChatId: state.activeMenuChatId,
    conversations: state.conversations,
    createScopedMessagesHandler: scoped.createScopedMessagesHandler,
    currentConversationId: state.currentConversationId,
    currentFolderIdRef: state.currentFolderIdRef,
    currentMessages: state.currentMessages,
    editingChatTitle: state.editingChatTitle,
    flushPendingSave: scoped.flushPendingSave,
    getScopedMessagesHandler,
    loadingConversations: state.loadingConversations,
    renamingChatId: state.renamingChatId,
    setActiveMenuChatId: state.setActiveMenuChatId,
    setConversations: state.setConversations,
    setEditingChatTitle: state.setEditingChatTitle,
    setRenamingChatId: state.setRenamingChatId,
    loadInitialConversations: refresh.loadInitialConversations,
    ...actions,
  };
}
