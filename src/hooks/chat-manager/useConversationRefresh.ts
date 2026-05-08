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
    const capturedScopeVersion = state.scopeVersionRef.current;
    state.setLoadingConversations(true);
    try {
      const convs = await loadConversations(userId, orgId, accessUserIds);
      state.setConversations(convs);
      if (!canHydrateActiveChat(state, capturedScopeVersion)) return convs;

      const lastChatId = localStorage.getItem(getCurrentChatStorageKey(userId));
      const found = lastChatId ? convs.find((item) => item.id === lastChatId) : null;
      if (!found) {
        if (lastChatId) localStorage.removeItem(getCurrentChatStorageKey(userId));
        clearActiveChat(state);
        return convs;
      }

      const msgs = await loadMessages(found.id, userId);
      if (!canHydrateActiveChat(state, capturedScopeVersion)) return convs;
      state.setCurrentConversationId(found.id);
      state.currentConvIdRef.current = found.id;
      state.setCurrentMessages(msgs);
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

function canHydrateActiveChat(state: ChatManagerState, capturedScopeVersion: number): boolean {
  return state.scopeVersionRef.current === capturedScopeVersion && !state.currentConvIdRef.current && state.currentMessagesRef.current.length === 0;
}

function clearActiveChat(state: ChatManagerState): void {
  state.setCurrentConversationId(null);
  state.currentConvIdRef.current = null;
  state.setCurrentMessages([]);
}
