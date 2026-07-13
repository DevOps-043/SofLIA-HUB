import { useCallback } from 'react';
import { deleteConversation, loadMessages, updateConversationTitle, toggleConversationPin } from '../../services/chat-service';
import { withoutActivePlaceholders } from './helpers';
import type { ChatManagerState, ChatStorageKeyResolver, UseChatManagerOptions } from './types';

type ChatActionsDeps = UseChatManagerOptions & {
  flushPendingSave: () => Promise<void>;
  getCurrentChatStorageKey: ChatStorageKeyResolver;
  refreshConversationsFromRemote: () => Promise<void>;
  state: ChatManagerState;
};

export function useChatActions({ flushPendingSave, getCurrentChatStorageKey, refreshConversationsFromRemote, state, userId }: ChatActionsDeps) {
  const handleNewChat = useCallback(async (folderId?: string | null) => {
    if (!userId) return folderId ?? null;
    await flushPendingSave();
    state.scopeVersionRef.current += 1;
    state.setCurrentConversationId(null);
    state.currentConvIdRef.current = null;
    state.setCurrentMessages([]);
    state.currentFolderIdRef.current = folderId ?? null;
    localStorage.removeItem(getCurrentChatStorageKey(userId));
    return folderId ?? null;
  }, [flushPendingSave, getCurrentChatStorageKey, state, userId]);

  const handleSelectConversation = useCallback(async (convId: string) => {
    if (!userId) return false;
    if (convId === state.currentConvIdRef.current) {
      await flushPendingSave();
      await refreshConversationsFromRemote();
      return true;
    }
    await flushPendingSave();
    state.scopeVersionRef.current += 1;
    const msgs = withoutActivePlaceholders(await loadMessages(convId, userId));
    state.setCurrentConversationId(convId);
    state.currentConvIdRef.current = convId;
    state.setCurrentMessages(msgs);
    localStorage.setItem(getCurrentChatStorageKey(userId), convId);
    return true;
  }, [flushPendingSave, getCurrentChatStorageKey, refreshConversationsFromRemote, state, userId]);

  const handleDeleteConversation = useCallback(async (convId: string) => {
    if (!userId) return false;
    const conversation = state.conversations.find((item) => item.id === convId);
    if (!conversation?.can_share) return false;
    await flushPendingSave();
    state.scopeVersionRef.current += 1;
    state.setConversations((prev) => prev.filter((item) => item.id !== convId));
    if (convId === state.currentConvIdRef.current) {
      state.setCurrentConversationId(null);
      state.currentConvIdRef.current = null;
      state.setCurrentMessages([]);
      localStorage.removeItem(getCurrentChatStorageKey(userId));
    }
    return deleteConversation(userId, convId);
  }, [flushPendingSave, getCurrentChatStorageKey, state, userId]);

  const handleRenameChat = useCallback(async () => {
    const newTitle = state.editingChatTitle.trim();
    const targetChatId = state.renamingChatId;
    if (!userId || !targetChatId || !newTitle) return state.setRenamingChatId(null);
    const conversation = state.conversations.find((item) => item.id === targetChatId);
    if (!conversation?.can_edit) return state.setRenamingChatId(null);
    state.setConversations((prev) => prev.map((item) => item.id === targetChatId ? { ...item, title: newTitle } : item));
    state.setRenamingChatId(null);
    void updateConversationTitle(userId, targetChatId, newTitle);
  }, [state, userId]);

  const handleRenameChatFromHub = useCallback(async (chatId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!userId || !trimmed) return;
    const conversation = state.conversations.find((item) => item.id === chatId);
    if (!conversation?.can_edit) return;
    state.setConversations((prev) => prev.map((item) => (item.id === chatId ? { ...item, title: trimmed } : item)));
    void updateConversationTitle(userId, chatId, trimmed);
  }, [state, userId]);

  const handleTogglePinChat = useCallback(async (convId: string, isPinned: boolean) => {
    if (!userId) return;
    state.setConversations((prev) =>
      prev.map((item) => (item.id === convId ? { ...item, is_pinned: isPinned } : item))
    );
    void toggleConversationPin(userId, convId, isPinned);
  }, [state, userId]);

  return { handleDeleteConversation, handleNewChat, handleRenameChat, handleRenameChatFromHub, handleSelectConversation, handleTogglePinChat };
}
