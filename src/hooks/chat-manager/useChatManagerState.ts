import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Conversation } from '../../services/chat-service';

export function useChatManagerState(userId: string | undefined, orgId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentConvIdRef = useRef<string | null>(null);
  const currentMessagesRef = useRef<ChatMessage[]>([]);
  const currentFolderIdRef = useRef<string | null>(null);
  const flushSaveRef = useRef<(() => Promise<void>) | null>(null);
  const scopeVersionRef = useRef(0);

  conversationsRef.current = conversations;
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

  // Al cambiar de organizacion: invalidar respuestas async en vuelo y limpiar el chat activo
  // (pertenece a la org anterior). La recarga de conversaciones la dispara useAppBootstrap.
  const didMountOrgRef = useRef(false);
  useEffect(() => {
    if (!didMountOrgRef.current) {
      didMountOrgRef.current = true;
      return;
    }
    scopeVersionRef.current += 1;
    setConversations([]);
    setCurrentConversationId(null);
    currentConvIdRef.current = null;
    setCurrentMessages([]);
    currentFolderIdRef.current = null;
    setActiveMenuChatId(null);
  }, [orgId]);

  return {
    activeMenuChatId,
    conversations,
    conversationsRef,
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
