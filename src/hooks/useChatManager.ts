import { useState, useCallback, useEffect, useRef } from 'react';
import {
  loadConversations,
  loadMessages,
  createConversation,
  saveMessages,
  saveMessagesToCache,
  deleteConversation,
  generateTitle,
  updateConversationTitle,
  type Conversation,
  type ChatMessage,
} from '../services/chat-service';

interface UseChatManagerOptions {
  userId: string | undefined;
  orgId?: string;
  accessUserIds?: string[];
}

function hasActivePlaceholder(messages: ChatMessage[]): boolean {
  return messages.some((message) => {
    if (message.role !== 'model') return false;
    const text = message.text?.trim() || '';
    const hasImages = Boolean(message.images && message.images.length > 0);
    return !hasImages && (!text || text === '...');
  });
}

function areConversationListsEqual(left: Conversation[], right: Conversation[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((conversation, index) => {
    const other = right[index];
    return (
      conversation.id === other?.id &&
      conversation.title === other?.title &&
      conversation.folder_id === other?.folder_id &&
      conversation.updated_at === other?.updated_at &&
      conversation.is_shared === other?.is_shared &&
      conversation.share_permission === other?.share_permission &&
      conversation.can_edit === other?.can_edit &&
      conversation.can_share === other?.can_share
    );
  });
}

function areMessageListsEqual(left: ChatMessage[], right: ChatMessage[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((message, index) => {
    const other = right[index];
    return (
      message.id === other?.id &&
      message.role === other?.role &&
      message.text === other?.text &&
      message.timestamp === other?.timestamp &&
      JSON.stringify(message.sources || []) === JSON.stringify(other?.sources || []) &&
      JSON.stringify(message.images || []) === JSON.stringify(other?.images || []) &&
      message.feedback === other?.feedback
    );
  });
}

export function useChatManager({ userId, orgId, accessUserIds }: UseChatManagerOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentConvIdRef = useRef<string | null>(null);
  currentConvIdRef.current = currentConversationId;
  const currentMessagesRef = useRef<ChatMessage[]>([]);
  currentMessagesRef.current = currentMessages;
  const currentFolderIdRef = useRef<string | null>(null);
  const flushSaveRef = useRef<(() => Promise<void>) | null>(null);
  const scopeVersionRef = useRef(0);

  const getCurrentChatStorageKey = useCallback(
    (scopeUserId: string) => `lia_current_chat_id_${scopeUserId}`,
    [],
  );

  useEffect(() => {
    if (userId) return;

    scopeVersionRef.current += 1;
    setConversations([]);
    setCurrentConversationId(null);
    currentConvIdRef.current = null;
    setCurrentMessages([]);
    currentFolderIdRef.current = null;
    setRenamingChatId(null);
    setEditingChatTitle('');
    setActiveMenuChatId(null);
    setLoadingConversations(false);
  }, [userId]);

  const loadInitialConversations = useCallback(async () => {
    if (!userId) return [];
    const capturedScopeVersion = scopeVersionRef.current;
    setLoadingConversations(true);
    try {
      const convs = await loadConversations(userId, orgId, accessUserIds);
      setConversations(convs);

      const canHydrateActiveChat = () =>
        scopeVersionRef.current === capturedScopeVersion &&
        !currentConvIdRef.current &&
        currentMessagesRef.current.length === 0;

      if (!canHydrateActiveChat()) {
        return convs;
      }

      const lastChatId = localStorage.getItem(getCurrentChatStorageKey(userId));
      if (lastChatId) {
        const found = convs.find((c) => c.id === lastChatId);
        if (found) {
          const msgs = await loadMessages(found.id, userId);

          if (!canHydrateActiveChat()) {
            return convs;
          }

          setCurrentConversationId(found.id);
          currentConvIdRef.current = found.id;
          setCurrentMessages(msgs);
          return convs;
        }

        localStorage.removeItem(getCurrentChatStorageKey(userId));
      }

      if (!canHydrateActiveChat()) {
        return convs;
      }

      setCurrentConversationId(null);
      currentConvIdRef.current = null;
      setCurrentMessages([]);
      return convs;
    } finally {
      setLoadingConversations(false);
    }
  }, [accessUserIds, getCurrentChatStorageKey, orgId, userId]);

  const refreshConversationsFromRemote = useCallback(async () => {
    if (!userId) return;

    const capturedScopeVersion = scopeVersionRef.current;
    const convs = await loadConversations(userId, orgId, accessUserIds);

    if (scopeVersionRef.current !== capturedScopeVersion) {
      return;
    }

    setConversations((prev) => (areConversationListsEqual(prev, convs) ? prev : convs));

    const activeConversationId = currentConvIdRef.current;
    if (!activeConversationId) {
      return;
    }

    const stillExists = convs.some((conversation) => conversation.id === activeConversationId);
    if (!stillExists) {
      setCurrentConversationId(null);
      currentConvIdRef.current = null;
      setCurrentMessages([]);
      localStorage.removeItem(getCurrentChatStorageKey(userId));
      return;
    }

    if (hasActivePlaceholder(currentMessagesRef.current)) {
      return;
    }

    const refreshedMessages = await loadMessages(activeConversationId, userId);
    if (
      scopeVersionRef.current !== capturedScopeVersion ||
      currentConvIdRef.current !== activeConversationId ||
      hasActivePlaceholder(currentMessagesRef.current)
    ) {
      return;
    }

    setCurrentMessages((prev) => (areMessageListsEqual(prev, refreshedMessages) ? prev : refreshedMessages));
  }, [accessUserIds, getCurrentChatStorageKey, orgId, userId]);

  useEffect(() => {
    if (!userId) return;

    const refreshSafely = () => {
      void refreshConversationsFromRemote().catch((error) => {
        console.warn('[useChatManager] refreshConversationsFromRemote FAILED:', error);
      });
    };

    const intervalId = window.setInterval(refreshSafely, 15000);
    const handleFocus = () => refreshSafely();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSafely();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshConversationsFromRemote, userId]);

  const createScopedMessagesHandler = useCallback(
    (capturedConvId: string | null, capturedFolderId: string | null) => {
      const capturedScopeVersion = scopeVersionRef.current;
      let resolvedConvId = capturedConvId;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let latestMessages: ChatMessage[] = [];
      let saving = false;
      let dirty = false;

      const executeSave = async () => {
        if (saving) { dirty = true; return; }

        if (hasActivePlaceholder(latestMessages)) {
          dirty = true;
          return;
        }

        saving = true;
        dirty = false;

        try {
          if (!userId) return;

          const validMessages = latestMessages.filter(
            (m) => (m.text && m.text.trim().length > 0) || (m.images && m.images.length > 0),
          );
          if (validMessages.length === 0) return;

          if (!resolvedConvId) {
            const title = generateTitle(validMessages);
            const newConv = await createConversation(
              userId,
              title,
              capturedFolderId || undefined,
              orgId,
            );
            if (!newConv) return;

            resolvedConvId = newConv.id;
            setConversations((prev) => [newConv, ...prev]);

            if (
              scopeVersionRef.current === capturedScopeVersion &&
              !currentConvIdRef.current &&
              currentFolderIdRef.current === capturedFolderId
            ) {
              setCurrentConversationId(resolvedConvId);
              currentConvIdRef.current = resolvedConvId;
              localStorage.setItem(getCurrentChatStorageKey(userId), resolvedConvId);
            }
          }

          await saveMessages(resolvedConvId, userId, validMessages);

          setConversations((prev) =>
            prev
              .map((c) =>
                c.id === resolvedConvId
                  ? { ...c, updated_at: new Date().toISOString() }
                  : c,
              )
              .sort(
                (a, b) =>
                  new Date(b.updated_at).getTime() -
                  new Date(a.updated_at).getTime(),
              ),
          );
        } finally {
          saving = false;
          if (dirty) {
            dirty = false;
            executeSave();
          }
        }
      };

      flushSaveRef.current = async () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
          saveTimerRef.current = null;
        }
        await executeSave();
      };

      return (messages: ChatMessage[]) => {
        latestMessages = messages;

        const isActive =
          (scopeVersionRef.current === capturedScopeVersion && currentConvIdRef.current === resolvedConvId) ||
          (!resolvedConvId && !currentConvIdRef.current);
        if (isActive) {
          setCurrentMessages(messages);
        }

        if (resolvedConvId) {
          const valid = messages.filter(
            (m) => (m.text && m.text.trim().length > 0) || (m.images && m.images.length > 0),
          );
          saveMessagesToCache(resolvedConvId, valid);
        }

        if (timer) clearTimeout(timer);
        timer = setTimeout(() => executeSave(), 1000);
        saveTimerRef.current = timer;
      };
    },
    [getCurrentChatStorageKey, orgId, userId],
  );

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await flushSaveRef.current?.();
  }, []);

  const handleNewChat = useCallback(async (folderId?: string | null) => {
    if (!userId) return folderId ?? null;
    await flushPendingSave();
    scopeVersionRef.current += 1;
    setCurrentConversationId(null);
    currentConvIdRef.current = null;
    setCurrentMessages([]);
    const folder = folderId ?? null;
    currentFolderIdRef.current = folder;
    localStorage.removeItem(getCurrentChatStorageKey(userId));
    return folder;
  }, [flushPendingSave, getCurrentChatStorageKey, userId]);

  const handleSelectConversation = useCallback(
    async (convId: string) => {
      if (!userId) return false;
      if (convId === currentConvIdRef.current) return false;

      await flushPendingSave();
      scopeVersionRef.current += 1;
      const msgs = await loadMessages(convId, userId);
      setCurrentConversationId(convId);
      currentConvIdRef.current = convId;
      setCurrentMessages(msgs);
      localStorage.setItem(getCurrentChatStorageKey(userId), convId);
      return true;
    },
    [flushPendingSave, getCurrentChatStorageKey, userId],
  );

  const handleDeleteConversation = useCallback(
    async (convId: string) => {
      if (!userId) return false;
      const conversation = conversations.find((item) => item.id === convId);
      if (!conversation?.can_share) return false;
      await flushPendingSave();
      scopeVersionRef.current += 1;
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (convId === currentConvIdRef.current) {
        setCurrentConversationId(null);
        currentConvIdRef.current = null;
        setCurrentMessages([]);
        localStorage.removeItem(getCurrentChatStorageKey(userId));
      }
      const success = await deleteConversation(userId, convId);
      return success;
    },
    [conversations, flushPendingSave, getCurrentChatStorageKey, userId],
  );

  const handleRenameChat = useCallback(async () => {
    const newTitle = editingChatTitle.trim();
    const targetChatId = renamingChatId;
    if (!userId || !targetChatId || !newTitle) {
      setRenamingChatId(null);
      return;
    }
    const conversation = conversations.find((item) => item.id === targetChatId);
    if (!conversation?.can_edit) {
      setRenamingChatId(null);
      return;
    }
    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetChatId ? { ...c, title: newTitle } : c,
      ),
    );
    setRenamingChatId(null);
    void updateConversationTitle(userId, targetChatId, newTitle);
  }, [conversations, renamingChatId, editingChatTitle, userId]);

  const handleRenameChatFromHub = useCallback(async (chatId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!userId || !trimmed) return;
    const conversation = conversations.find((item) => item.id === chatId);
    if (!conversation?.can_edit) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: trimmed } : c)),
    );
    void updateConversationTitle(userId, chatId, trimmed);
  }, [conversations, userId]);

  const getScopedMessagesHandler = useCallback((currentFolderId: string | null) => {
    currentFolderIdRef.current = currentFolderId;
    return createScopedMessagesHandler(currentConversationId, currentFolderId);
  }, [createScopedMessagesHandler, currentConversationId]);

  return {
    conversations,
    setConversations,
    currentConversationId,
    currentMessages,
    loadingConversations,
    renamingChatId,
    setRenamingChatId,
    editingChatTitle,
    setEditingChatTitle,
    activeMenuChatId,
    setActiveMenuChatId,
    loadInitialConversations,
    createScopedMessagesHandler,
    flushPendingSave,
    handleNewChat,
    handleSelectConversation,
    handleDeleteConversation,
    handleRenameChat,
    handleRenameChatFromHub,
    getScopedMessagesHandler,
    currentFolderIdRef,
  };
}
