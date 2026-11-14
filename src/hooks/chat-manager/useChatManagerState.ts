import { useLayoutEffect, useRef, useState } from 'react';
import type { ChatMessage, Conversation } from '../../services/chat-service';

export function useChatManagerState(userId: string | undefined, orgId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [chatScopeId, setChatScopeId] = useState<string>(() => crypto.randomUUID());
  const chatScopeIdRef = useRef<string>(chatScopeId);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const currentConvIdRef = useRef<string | null>(null);
  const currentMessagesRef = useRef<ChatMessage[]>([]);
  const currentFolderIdRef = useRef<string | null>(null);
  const scopeVersionRef = useRef(0);

  useLayoutEffect(() => {
    conversationsRef.current = conversations;
    currentConvIdRef.current = currentConversationId;
    currentMessagesRef.current = currentMessages;
    chatScopeIdRef.current = chatScopeId;
  }, [conversations, currentConversationId, currentMessages, chatScopeId]);

  const identity = JSON.stringify([userId, orgId]);
  const previousIdentity = useRef(identity);
  useLayoutEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    scopeVersionRef.current += 1;
    const nextScope = crypto.randomUUID();
    chatScopeIdRef.current = nextScope;
    setChatScopeId(nextScope);
    setConversations([]);
    conversationsRef.current = [];
    setCurrentConversationId(null);
    currentConvIdRef.current = null;
    setCurrentMessages([]);
    currentMessagesRef.current = [];
    currentFolderIdRef.current = null;
    setRenamingChatId(null);
    setEditingChatTitle('');
    setActiveMenuChatId(null);
    setLoadingConversations(false);
  }, [identity]);

  return {
    activeMenuChatId,
    chatScopeId,
    chatScopeIdRef,
    setChatScopeId,
    conversations,
    conversationsRef,
    currentConversationId,
    currentConvIdRef,
    currentFolderIdRef,
    currentMessages,
    currentMessagesRef,
    editingChatTitle,
    loadingConversations,
    renamingChatId,
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
