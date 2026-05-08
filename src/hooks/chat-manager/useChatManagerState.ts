import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Conversation } from '../../services/chat-service';

export function useChatManagerState(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentConvIdRef = useRef<string | null>(null);
  const currentMessagesRef = useRef<ChatMessage[]>([]);
  const currentFolderIdRef = useRef<string | null>(null);
  const flushSaveRef = useRef<(() => Promise<void>) | null>(null);
  const scopeVersionRef = useRef(0);

  currentConvIdRef.current = currentConversationId;
  currentMessagesRef.current = currentMessages;

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

  return {
    activeMenuChatId,
    conversations,
    currentConversationId,
    currentConvIdRef,
    currentFolderIdRef,
    currentMessages,
    currentMessagesRef,
    editingChatTitle,
    flushSaveRef,
    loadingConversations,
    renamingChatId,
    saveTimerRef,
    scopeVersionRef,
    setActiveMenuChatId,
    setConversations,
    setCurrentConversationId,
    setCurrentMessages,
    setEditingChatTitle,
    setLoadingConversations,
    setRenamingChatId,
  };
}
