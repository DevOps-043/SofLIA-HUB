import { useCallback } from 'react';
import {
  createConversation,
  generateTitle,
  saveMessages,
  saveMessagesToCache,
  type ChatMessage,
  type Conversation,
} from '../../services/chat-service';
import { hasActivePlaceholder } from './helpers';
import type { ChatManagerState, ChatStorageKeyResolver, UseChatManagerOptions } from './types';

type ScopedMessagesDeps = UseChatManagerOptions & {
  getCurrentChatStorageKey: ChatStorageKeyResolver;
  state: ChatManagerState;
};

export function useScopedMessagesHandler({ getCurrentChatStorageKey, orgId, state, userId }: ScopedMessagesDeps) {
  const createScopedMessagesHandler = useCallback((capturedConvId: string | null, capturedFolderId: string | null) => {
    const capturedScopeVersion = state.scopeVersionRef.current;
    let resolvedConvId = capturedConvId;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let latestMessages: ChatMessage[] = [];
    let saving = false;
    let dirty = false;

    const executeSave = async () => {
      if (saving) { dirty = true; return; }
      if (hasActivePlaceholder(latestMessages)) { dirty = true; return; }
      saving = true;
      dirty = false;
      try {
        const validMessages = getPersistableMessages(latestMessages);
        if (!userId || validMessages.length === 0) return;
        if (!resolvedConvId) {
          resolvedConvId = await createMissingConversation(validMessages, capturedFolderId, capturedScopeVersion);
          if (!resolvedConvId) return;
        }
        await saveMessages(resolvedConvId, userId, validMessages);
        state.setConversations((prev) => markConversationUpdated(prev, resolvedConvId!));
      } finally {
        saving = false;
        if (dirty) { dirty = false; void executeSave(); }
      }
    };

    const createMissingConversation = async (messages: ChatMessage[], folderId: string | null, scopeVersion: number) => {
      const newConv = await createConversation(userId!, generateTitle(messages), folderId || undefined, orgId);
      if (!newConv) return null;
      state.setConversations((prev) => [newConv, ...prev]);
      if (state.scopeVersionRef.current === scopeVersion && !state.currentConvIdRef.current && state.currentFolderIdRef.current === folderId) {
        state.setCurrentConversationId(newConv.id);
        state.currentConvIdRef.current = newConv.id;
        localStorage.setItem(getCurrentChatStorageKey(userId!), newConv.id);
      }
      return newConv.id;
    };

    state.flushSaveRef.current = async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      state.saveTimerRef.current = null;
      await executeSave();
    };

    return (messages: ChatMessage[]) => {
      latestMessages = messages;
      const isActive = (state.scopeVersionRef.current === capturedScopeVersion && state.currentConvIdRef.current === resolvedConvId) ||
        (!resolvedConvId && !state.currentConvIdRef.current);
      if (isActive) state.setCurrentMessages(messages);
      if (resolvedConvId) saveMessagesToCache(resolvedConvId, getPersistableMessages(messages));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => executeSave(), 1000);
      state.saveTimerRef.current = timer;
    };
  }, [getCurrentChatStorageKey, orgId, state, userId]);

  const flushPendingSave = useCallback(async () => {
    if (state.saveTimerRef.current) {
      clearTimeout(state.saveTimerRef.current);
      state.saveTimerRef.current = null;
    }
    await state.flushSaveRef.current?.();
  }, [state]);

  return { createScopedMessagesHandler, flushPendingSave };
}

function getPersistableMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => (message.text && message.text.trim().length > 0) || (message.images && message.images.length > 0));
}

function markConversationUpdated(conversations: Conversation[], conversationId: string): Conversation[] {
  return conversations
    .map((item) => item.id === conversationId ? { ...item, updated_at: new Date().toISOString() } : item)
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
}
