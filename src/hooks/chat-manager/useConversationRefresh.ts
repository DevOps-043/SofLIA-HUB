import { useCallback, useLayoutEffect, useRef } from 'react';
import { loadConversations, loadMessages } from '../../services/chat-service';
import { buildLocalConversationList } from '../../services/chat/builders';
import { areConversationListsEqual, areMessageListsEqual, hasActivePlaceholder } from './helpers';
import type { ChatManagerState, ChatStorageKeyResolver, UseChatManagerOptions } from './types';

type ConversationRefreshDeps = UseChatManagerOptions & {
  getCurrentChatStorageKey: ChatStorageKeyResolver;
  state: ChatManagerState;
};

export function useConversationRefresh({ accessUserIds, getCurrentChatStorageKey, orgId, state, userId }: ConversationRefreshDeps) {
  const initialLoad = useRef(0);
  useLayoutEffect(() => { ++initialLoad.current; }, [userId, orgId]);
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
    const ticket = ++initialLoad.current;
    const version = state.scopeVersionRef.current;
    const local = buildLocalConversationList(userId, orgId);
    if (local.length) state.setConversations(local);
    state.setLoadingConversations(true);
    try {
      const convs = await loadConversations(userId, orgId, accessUserIds);
      if (version !== state.scopeVersionRef.current) return [];
      state.setConversations(convs);
      
      // Siempre iniciar con una nueva conversación vacía al iniciar sesión
      if (!state.currentConvIdRef.current && !state.currentMessagesRef.current.length) {
        localStorage.removeItem(getCurrentChatStorageKey(userId));
      }
      return convs;
    } finally {
      // Navegar invalida el resultado, pero no debe dejar el historial cargando.
      if (ticket === initialLoad.current) state.setLoadingConversations(false);
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
  state.scopeVersionRef.current += 1;
  const scopeId = crypto.randomUUID();
  state.chatScopeIdRef.current = scopeId;
  state.setChatScopeId(scopeId);
  state.setCurrentConversationId(null);
  state.currentConvIdRef.current = null;
  state.setCurrentMessages([]);
}
