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
  const latestState = useRef(state);
  useLayoutEffect(() => { latestState.current = state; });
  const generation = useRef(0);
  const initialLoad = useRef(0);
  useLayoutEffect(() => {
    const revision = ++generation.current;
    return () => { generation.current = revision + 1; };
  }, [orgId, userId]);
  const pendingMessages = useRef(new Map<string, Promise<void>>());
  const pendingConversations = useRef(new Map<string, Promise<void>>());
  const refreshCurrentConversationMessages = useCallback(
    (conversationId: string, capturedScopeVersion: number = latestState.current.scopeVersionRef.current) => {
      const state = latestState.current;
      const revision = generation.current;
      const key = JSON.stringify([userId, orgId, revision, capturedScopeVersion, conversationId]);
      return joinRequest(pendingMessages.current, key, async () => {
        if (!userId) return;
        const refreshedMessages = await loadMessages(conversationId, userId);
        if (
          generation.current !== revision || state.scopeVersionRef.current !== capturedScopeVersion ||
          state.currentConvIdRef.current !== conversationId ||
          hasActivePlaceholder(state.currentMessagesRef.current)
        ) return;
        state.setCurrentMessages((prev) => (areMessageListsEqual(prev, refreshedMessages) ? prev : refreshedMessages));
      });
    },
    [orgId, userId],
  );

  const loadInitialConversations = useCallback(async () => {
    const state = latestState.current;
    if (!userId) return [];
    const revision = generation.current;
    const ticket = ++initialLoad.current;
    const version = state.scopeVersionRef.current;
    const local = buildLocalConversationList(userId, orgId);
    if (local.length) state.setConversations(local);
    state.setLoadingConversations(true);
    try {
      const convs = await loadConversations(userId, orgId, accessUserIds);
      if (
        generation.current !== revision || ticket !== initialLoad.current ||
        version !== state.scopeVersionRef.current
      ) return [];
      state.setConversations(convs);

      // Siempre iniciar con una nueva conversación vacía al iniciar sesión
      if (!state.currentConvIdRef.current && !state.currentMessagesRef.current.length) {
        localStorage.removeItem(getCurrentChatStorageKey(userId));
      }
      return convs;
    } finally {
      // Navegar invalida el resultado, pero no debe dejar el historial cargando.
      if (generation.current === revision && ticket === initialLoad.current) {
        state.setLoadingConversations(false);
      }
    }
  }, [accessUserIds, getCurrentChatStorageKey, orgId, userId]);

  const refreshConversationsFromRemote = useCallback(() => {
    const state = latestState.current;
    const revision = generation.current;
    const key = JSON.stringify([userId, orgId, revision, state.scopeVersionRef.current]);
    return joinRequest(pendingConversations.current, key, async () => {
      if (!userId) return;
      const capturedScopeVersion = state.scopeVersionRef.current;
      const convs = await loadConversations(userId, orgId, accessUserIds);
      if (generation.current !== revision || state.scopeVersionRef.current !== capturedScopeVersion) return;
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
    });
  }, [accessUserIds, getCurrentChatStorageKey, orgId, refreshCurrentConversationMessages, userId]);

  return { loadInitialConversations, refreshConversationsFromRemote, refreshCurrentConversationMessages };
}

function joinRequest(pending: Map<string, Promise<void>>, key: string, task: () => Promise<void>): Promise<void> {
  const active = pending.get(key);
  if (active) return active;
  const promise = task().finally(() => { if (pending.get(key) === promise) pending.delete(key); });
  pending.set(key, promise);
  return promise;
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
