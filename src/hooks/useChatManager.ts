import { useState, useCallback, useRef } from 'react';
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
}

export function useChatManager({ userId }: UseChatManagerOptions) {
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
  const currentFolderIdRef = useRef<string | null>(null);
  const flushSaveRef = useRef<(() => Promise<void>) | null>(null);

  const loadInitialConversations = useCallback(async () => {
    if (!userId) return [];
    setLoadingConversations(true);
    const convs = await loadConversations(userId);
    setConversations(convs);

    const lastChatId = localStorage.getItem('lia_current_chat_id');
    if (lastChatId) {
      const found = convs.find((c) => c.id === lastChatId);
      if (found) {
        const msgs = await loadMessages(found.id);
        setCurrentConversationId(found.id);
        setCurrentMessages(msgs);
      }
    }
    setLoadingConversations(false);
    return convs;
  }, [userId]);

  const createScopedMessagesHandler = useCallback(
    (capturedConvId: string | null, capturedFolderId: string | null) => {
      let resolvedConvId = capturedConvId;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let latestMessages: ChatMessage[] = [];
      let saving = false;
      let dirty = false;

      const executeSave = async () => {
        if (saving) { dirty = true; return; }

        const hasActivePlaceholder = latestMessages.some(
          (m) => m.role === 'model' && (!m.text || m.text.trim().length === 0) && (!m.images || m.images.length === 0),
        );
        if (hasActivePlaceholder) {
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
            );
            if (!newConv) return;

            resolvedConvId = newConv.id;
            setConversations((prev) => [newConv, ...prev]);

            if (
              !currentConvIdRef.current &&
              currentFolderIdRef.current === capturedFolderId
            ) {
              setCurrentConversationId(resolvedConvId);
              currentConvIdRef.current = resolvedConvId;
              localStorage.setItem('lia_current_chat_id', resolvedConvId);
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
          currentConvIdRef.current === resolvedConvId ||
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
    [userId],
  );

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    flushSaveRef.current?.();
  }, []);

  const handleNewChat = useCallback((folderId?: string | null) => {
    flushPendingSave();
    setCurrentConversationId(null);
    currentConvIdRef.current = null;
    setCurrentMessages([]);
    const folder = folderId ?? null;
    currentFolderIdRef.current = folder;
    localStorage.removeItem('lia_current_chat_id');
    return folder;
  }, [flushPendingSave]);

  const handleSelectConversation = useCallback(
    async (convId: string) => {
      if (convId === currentConvIdRef.current) return false;

      flushPendingSave();
      const msgs = await loadMessages(convId);
      setCurrentConversationId(convId);
      currentConvIdRef.current = convId;
      setCurrentMessages(msgs);
      localStorage.setItem('lia_current_chat_id', convId);
      return true;
    },
    [flushPendingSave],
  );

  const handleDeleteConversation = useCallback(
    async (convId: string) => {
      const success = await deleteConversation(convId);
      if (success) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (convId === currentConvIdRef.current) {
          setCurrentConversationId(null);
          currentConvIdRef.current = null;
          setCurrentMessages([]);
          localStorage.removeItem('lia_current_chat_id');
        }
      }
      return success;
    },
    [],
  );

  const handleRenameChat = useCallback(async () => {
    const newTitle = editingChatTitle.trim();
    if (!renamingChatId || !newTitle) {
      setRenamingChatId(null);
      return;
    }
    await updateConversationTitle(renamingChatId, newTitle);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === renamingChatId ? { ...c, title: newTitle } : c,
      ),
    );
    setRenamingChatId(null);
  }, [renamingChatId, editingChatTitle]);

  const handleRenameChatFromHub = useCallback(async (chatId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await updateConversationTitle(chatId, trimmed);
    setConversations((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: trimmed } : c)),
    );
  }, []);

  const getScopedMessagesHandler = (currentFolderId: string | null) => {
    currentFolderIdRef.current = currentFolderId;
    return createScopedMessagesHandler(currentConversationId, currentFolderId);
  };

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
