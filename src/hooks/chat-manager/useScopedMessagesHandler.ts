import { useCallback } from 'react';
import {
  createConversation,
  generateTitleWithModel,
  PENDING_MODEL_TITLE,
  saveMessages,
  saveMessagesToCache,
  updateConversationTitle,
  type ChatMessage,
  type Conversation,
} from '../../services/chat-service';
import { hasActivePlaceholder, withoutActivePlaceholders } from './helpers';
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
      const newConv = await createConversation(userId!, PENDING_MODEL_TITLE, folderId || undefined, orgId);
      if (!newConv) return null;
      state.setConversations((prev) => {
        const next = [newConv, ...prev];
        state.conversationsRef.current = next;
        return next;
      });
      void applyModelGeneratedTitle(newConv.id, messages);
      if (state.scopeVersionRef.current === scopeVersion && !state.currentConvIdRef.current && state.currentFolderIdRef.current === folderId) {
        state.setCurrentConversationId(newConv.id);
        state.currentConvIdRef.current = newConv.id;
        localStorage.setItem(getCurrentChatStorageKey(userId!), newConv.id);
      }
      return newConv.id;
    };

    const applyModelGeneratedTitle = async (conversationId: string, messages: ChatMessage[]) => {
      if (!userId) return;
      const generatedTitle = await generateTitleWithModel(messages);
      const title = generatedTitle.trim();
      if (!title || title === PENDING_MODEL_TITLE) return;
      if (!state.conversationsRef.current.some((conversation) => conversation.id === conversationId)) return;

      state.setConversations((prev) => {
        const next = prev.map((conversation) => (
          conversation.id === conversationId ? { ...conversation, title } : conversation
        ));
        state.conversationsRef.current = next;
        return next;
      });
      await updateConversationTitle(userId, conversationId, title);
    };

    state.flushSaveRef.current = async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      state.saveTimerRef.current = null;
      await executeSave();
    };

    return (messages: ChatMessage[]) => {
      latestMessages = messages;
      // Para una conversación YA guardada basta con que sea la que se está viendo
      // (mismo id): así un turno que terminó mientras el usuario navegaba a otra
      // conversación y volvió, SÍ se pinta al regresar (no lo invalida el
      // scopeVersion). El scopeVersion se mantiene solo para chats nuevos aún sin
      // id, para no filtrar una respuesta tardía a otro chat nuevo distinto.
      const isActive = resolvedConvId
        ? state.currentConvIdRef.current === resolvedConvId
        : (state.scopeVersionRef.current === capturedScopeVersion && !state.currentConvIdRef.current);
      if (isActive) state.setCurrentMessages(messages);
      // Nunca cachear el placeholder "..." de un turno en curso (evita que un
      // turno interrumpido deje el chat bloqueado al recargar).
      if (resolvedConvId) saveMessagesToCache(resolvedConvId, getPersistableMessages(withoutActivePlaceholders(messages)));
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
