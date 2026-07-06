import { useCallback } from 'react';
import { loadConversations, loadMessages } from '../../services/chat-service';
import { areConversationListsEqual, areMessageListsEqual, hasActivePlaceholder } from './helpers';
import type { ChatManagerState, ChatStorageKeyResolver, UseChatManagerOptions } from './types';

type ConversationRefreshDeps = UseChatManagerOptions & {
  getCurrentChatStorageKey: ChatStorageKeyResolver;
  state: ChatManagerState;
};

export function useConversationRefresh({ accessUserIds, getCurrentChatStorageKey, orgId, state, userId }: ConversationRefreshDeps) {
  const refreshCurrentConversationMessages = useCallback(
    async (conversationId: string, capturedScopeVersion: number = state.scopeVersionRef.current) => {
      if (!userId) return;
      const refreshedMessages = await loadMessages(conversationId, userId);
      if (
        state.scopeVersionRef.current !== capturedScopeVersion ||
        state.currentConvIdRef.current !== conversationId ||
        hasActivePlaceholder(state.currentMessagesRef.current)
      ) return;
      state.setCurrentMessages((prev) => (areMessageListsEqual(prev, refreshedMessages) ? prev : refreshedMessages));
    },
    [state, userId],
  );

  const loadInitialConversations = useCallback(async () => {
    if (!userId) return [];
    state.setLoadingConversations(true);
    try {
      const convs = await loadConversations(userId, orgId, accessUserIds);
      state.setConversations(convs);
      
      // Siempre iniciar con una nueva conversación vacía al iniciar sesión
      clearActiveChat(state);
      localStorage.removeItem(getCurrentChatStorageKey(userId));
      return convs;
    } finally {
      state.setLoadingConversations(false);
    }
  }, [accessUserIds, getCurrentChatStorageKey, orgId, state, userId]);

  const refreshConversationsFromRemote = useCallback(async () => {
    if (!userId) return;
    const capturedScopeVersion = state.scopeVersionRef.current;
    const convs = await loadConversations(userId, orgId, accessUserIds);
    if (state.scopeVersionRef.current !== capturedScopeVersion) return;
    state.setConversations((prev) => (areConversationListsEqual(prev, convs) ? prev : convs));

    const activeConversationId = state.currentConvIdRef.current;
    if (!activeConversationId) return;
    if (!convs.some((conversation) => conversation.id === activeConversationId)) {
      clearActiveChat(state);
      localStorage.removeItem(getCurrentChatStorageKey(userId));
      return;
    }
    if (!hasActivePlaceholder(state.currentMessagesRef.current)) {
      await refreshCurrentConversationMessages(activeConversationId, capturedScopeVersion);
    }
  }, [accessUserIds, getCurrentChatStorageKey, orgId, refreshCurrentConversationMessages, state, userId]);

  return { loadInitialConversations, refreshConversationsFromRemote, refreshCurrentConversationMessages };
}

function clearActiveChat(state: ChatManagerState): void {
  state.setCurrentConversationId(null);
  state.currentConvIdRef.current = null;
  state.setCurrentMessages([]);
}
