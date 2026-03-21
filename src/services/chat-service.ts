import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  folder_id?: string;
  org_id?: string;
  is_pinned?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: Array<{ uri: string; title: string; snippet?: string }>;
  images?: string[];
  feedback?: 'like' | 'dislike';
}

interface PendingChatState {
  conversationUpserts: Record<string, Conversation>;
  messageSnapshots: Record<string, ChatMessage[]>;
  deletedConversationIds: string[];
}

const CONVERSATIONS_CACHE_KEY = 'lia_conversations';
const MESSAGE_CACHE_PREFIX = 'lia_messages_';
const PENDING_CHAT_STATE_PREFIX = 'lia_pending_chat_state_';
const ACTIVE_MODEL_PLACEHOLDER = '...';
const MAX_CONVERSATIONS = 500;

const saveSequenceByConversation = new Map<string, number>();
const saveChainByConversation = new Map<string, Promise<void>>();

function getConversationCacheKey(userId: string): string {
  return `${CONVERSATIONS_CACHE_KEY}_${userId}`;
}

function getMessageCacheKey(conversationId: string): string {
  return `${MESSAGE_CACHE_PREFIX}${conversationId}`;
}

function getPendingChatStateKey(userId: string): string {
  return `${PENDING_CHAT_STATE_PREFIX}${userId}`;
}

function emptyPendingChatState(): PendingChatState {
  return {
    conversationUpserts: {},
    messageSnapshots: {},
    deletedConversationIds: [],
  };
}

function normalizeConversation(raw: any): Conversation {
  return {
    id: raw.id,
    user_id: raw.user_id,
    title: raw.title || 'Nueva conversacion',
    folder_id: raw.folder_id ?? undefined,
    org_id: raw.org_id ?? undefined,
    is_pinned: raw.is_pinned ?? undefined,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function dedupeConversations(conversations: Conversation[]): Conversation[] {
  const byId = new Map<string, Conversation>();

  for (const conversation of conversations) {
    if (!conversation?.id) continue;

    const normalizedConversation = normalizeConversation(conversation);
    const existing = byId.get(normalizedConversation.id);
    if (!existing) {
      byId.set(normalizedConversation.id, normalizedConversation);
      continue;
    }

    const existingUpdated = new Date(existing.updated_at || existing.created_at || 0).getTime();
    const nextUpdated = new Date(normalizedConversation.updated_at || normalizedConversation.created_at || 0).getTime();
    if (nextUpdated >= existingUpdated) {
      byId.set(normalizedConversation.id, normalizedConversation);
    }
  }

  return Array.from(byId.values())
    .sort(
      (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime(),
    )
    .slice(0, MAX_CONVERSATIONS);
}

function isPersistableMessage(raw: Partial<ChatMessage> & { id?: string | null }): boolean {
  const id = raw.id?.trim();
  if (!id) return false;

  const text = typeof raw.text === 'string' ? raw.text : '';
  const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];
  const isPlaceholderModelMessage =
    raw.role === 'model' &&
    text.trim() === ACTIVE_MODEL_PLACEHOLDER &&
    images.length === 0;

  if (isPlaceholderModelMessage) {
    return false;
  }

  return Boolean(text.trim() || images.length > 0);
}

function normalizeMessage(raw: Partial<ChatMessage> & { id?: string | null }): ChatMessage | null {
  if (!isPersistableMessage(raw)) {
    return null;
  }

  const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : undefined;
  const sources = Array.isArray(raw.sources) ? raw.sources.filter((source) => source?.uri) : undefined;

  return {
    id: raw.id!.trim(),
    role: raw.role === 'user' ? 'user' : 'model',
    text: typeof raw.text === 'string' ? raw.text : '',
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
    sources: sources && sources.length > 0 ? sources : undefined,
    images: images && images.length > 0 ? images : undefined,
    feedback: raw.feedback === 'like' || raw.feedback === 'dislike' ? raw.feedback : undefined,
  };
}

function dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const rawMessage of messages) {
    const message = normalizeMessage(rawMessage);
    if (!message) continue;

    const existing = byId.get(message.id);
    if (!existing) {
      byId.set(message.id, message);
      continue;
    }

    const existingScore = `${existing.text || ''}|${existing.images?.length || 0}|${existing.sources?.length || 0}`.length;
    const nextScore = `${message.text || ''}|${message.images?.length || 0}|${message.sources?.length || 0}`.length;
    byId.set(message.id, nextScore >= existingScore ? message : existing);
  }

  return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function loadConversationsFromCache(userId: string): Conversation[] {
  try {
    const cached = localStorage.getItem(getConversationCacheKey(userId));
    return cached ? dedupeConversations(JSON.parse(cached)) : [];
  } catch {
    return [];
  }
}

function saveConversationsToCache(userId: string, conversations: Conversation[]): void {
  try {
    localStorage.setItem(getConversationCacheKey(userId), JSON.stringify(dedupeConversations(conversations)));
  } catch {}
}

function updateConversationCache(userId: string, updater: (conversations: Conversation[]) => Conversation[]): void {
  const currentConversations = loadConversationsFromCache(userId);
  saveConversationsToCache(userId, updater(currentConversations));
}

function loadMessagesFromCache(conversationId: string): ChatMessage[] {
  try {
    const cached = localStorage.getItem(getMessageCacheKey(conversationId));
    return cached ? dedupeMessages(JSON.parse(cached)) : [];
  } catch {
    return [];
  }
}

export function saveMessagesToCache(conversationId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(getMessageCacheKey(conversationId), JSON.stringify(dedupeMessages(messages)));
  } catch {}
}

function readPendingChatState(userId: string): PendingChatState {
  try {
    const raw = localStorage.getItem(getPendingChatStateKey(userId));
    if (!raw) return emptyPendingChatState();

    const parsed = JSON.parse(raw);
    const state: PendingChatState = emptyPendingChatState();

    for (const conversation of Object.values(parsed?.conversationUpserts || {})) {
      const normalizedConversation = normalizeConversation(conversation);
      state.conversationUpserts[normalizedConversation.id] = normalizedConversation;
    }

    for (const [conversationId, messages] of Object.entries(parsed?.messageSnapshots || {})) {
      state.messageSnapshots[conversationId] = dedupeMessages((messages || []) as ChatMessage[]);
    }

    state.deletedConversationIds = Array.from(
      new Set((parsed?.deletedConversationIds || []).filter((id: unknown) => typeof id === 'string')),
    );

    return state;
  } catch {
    return emptyPendingChatState();
  }
}

function writePendingChatState(userId: string, state: PendingChatState): void {
  try {
    const hasEntries =
      Object.keys(state.conversationUpserts).length > 0 ||
      Object.keys(state.messageSnapshots).length > 0 ||
      state.deletedConversationIds.length > 0;

    if (!hasEntries) {
      localStorage.removeItem(getPendingChatStateKey(userId));
      return;
    }

    localStorage.setItem(getPendingChatStateKey(userId), JSON.stringify(state));
  } catch {}
}

function updatePendingChatState(userId: string, updater: (state: PendingChatState) => PendingChatState): PendingChatState {
  const nextState = updater(readPendingChatState(userId));
  writePendingChatState(userId, nextState);
  return nextState;
}

function queueConversationUpsert(userId: string, conversation: Conversation): void {
  updatePendingChatState(userId, (state) => ({
    ...state,
    conversationUpserts: {
      ...state.conversationUpserts,
      [conversation.id]: normalizeConversation(conversation),
    },
    deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversation.id),
  }));
}

function queueMessageSnapshot(userId: string, conversationId: string, messages: ChatMessage[]): void {
  updatePendingChatState(userId, (state) => ({
    ...state,
    messageSnapshots: {
      ...state.messageSnapshots,
      [conversationId]: dedupeMessages(messages),
    },
    deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversationId),
  }));
}

function queueConversationDelete(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => {
    const nextConversationUpserts = { ...state.conversationUpserts };
    const nextMessageSnapshots = { ...state.messageSnapshots };

    delete nextConversationUpserts[conversationId];
    delete nextMessageSnapshots[conversationId];

    return {
      conversationUpserts: nextConversationUpserts,
      messageSnapshots: nextMessageSnapshots,
      deletedConversationIds: Array.from(new Set([...state.deletedConversationIds, conversationId])),
    };
  });
}

function clearPendingConversationUpsert(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => {
    const nextConversationUpserts = { ...state.conversationUpserts };
    delete nextConversationUpserts[conversationId];

    return {
      ...state,
      conversationUpserts: nextConversationUpserts,
    };
  });
}

function clearPendingMessageSnapshot(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => {
    const nextMessageSnapshots = { ...state.messageSnapshots };
    delete nextMessageSnapshots[conversationId];

    return {
      ...state,
      messageSnapshots: nextMessageSnapshots,
    };
  });
}

function clearPendingConversationDelete(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => ({
    ...state,
    deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversationId),
  }));
}

function getPendingConversationUpserts(userId: string): Conversation[] {
  return dedupeConversations(Object.values(readPendingChatState(userId).conversationUpserts));
}

function getPendingMessageSnapshot(userId: string, conversationId: string): ChatMessage[] {
  return dedupeMessages(readPendingChatState(userId).messageSnapshots[conversationId] || []);
}

function getDeletedConversationIds(userId: string): Set<string> {
  return new Set(readPendingChatState(userId).deletedConversationIds);
}

function saveConversationToCache(userId: string, conversation: Conversation) {
  updateConversationCache(userId, (conversations) => {
    const next = conversations.filter((item) => item.id !== conversation.id);
    next.unshift(normalizeConversation(conversation));
    return next;
  });
}

function updateConversationInCache(
  userId: string,
  conversationId: string,
  updater: (conversation: Conversation) => Conversation,
): Conversation | null {
  let updatedConversation: Conversation | null = null;

  updateConversationCache(userId, (conversations) =>
    conversations.map((conversation) => {
      if (conversation.id !== conversationId) {
        return conversation;
      }

      updatedConversation = normalizeConversation(updater(conversation));
      return updatedConversation;
    }),
  );

  return updatedConversation;
}

function removeConversationFromAllCaches(conversationId: string): void {
  try {
    localStorage.removeItem(getMessageCacheKey(conversationId));

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;

      if (key.startsWith(`${CONVERSATIONS_CACHE_KEY}_`)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const conversations = dedupeConversations(JSON.parse(raw)).filter((conversation) => conversation.id !== conversationId);
        localStorage.setItem(key, JSON.stringify(conversations));
        continue;
      }

      if (key.startsWith(PENDING_CHAT_STATE_PREFIX)) {
        const userId = key.slice(PENDING_CHAT_STATE_PREFIX.length);
        if (!userId) continue;

        const state = readPendingChatState(userId);
        const nextConversationUpserts = { ...state.conversationUpserts };
        const nextMessageSnapshots = { ...state.messageSnapshots };
        delete nextConversationUpserts[conversationId];
        delete nextMessageSnapshots[conversationId];

        localStorage.setItem(
          key,
          JSON.stringify({
            conversationUpserts: nextConversationUpserts,
            messageSnapshots: nextMessageSnapshots,
            deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversationId),
          }),
        );
      }
    }
  } catch {}
}

function buildConversationList(userId: string, remoteConversations: Conversation[]): Conversation[] {
  const deletedConversationIds = getDeletedConversationIds(userId);
  const merged = dedupeConversations([
    ...remoteConversations,
    ...getPendingConversationUpserts(userId),
  ]).filter((conversation) => !deletedConversationIds.has(conversation.id));

  saveConversationsToCache(userId, merged);
  return merged;
}

function buildLocalConversationList(userId: string): Conversation[] {
  const cachedConversations = loadConversationsFromCache(userId);
  const deletedConversationIds = getDeletedConversationIds(userId);

  return dedupeConversations([
    ...cachedConversations,
    ...getPendingConversationUpserts(userId),
  ]).filter((conversation) => !deletedConversationIds.has(conversation.id));
}

function buildMessageList(userId: string, conversationId: string, remoteMessages: ChatMessage[]): ChatMessage[] {
  const merged = dedupeMessages([
    ...remoteMessages,
    ...getPendingMessageSnapshot(userId, conversationId),
  ]);

  saveMessagesToCache(conversationId, merged);
  return merged;
}

function buildLocalMessageList(userId: string, conversationId: string): ChatMessage[] {
  return dedupeMessages([
    ...loadMessagesFromCache(conversationId),
    ...getPendingMessageSnapshot(userId, conversationId),
  ]);
}

function recoverPendingConversationsFromCache(userId: string, remoteConversationIds: Set<string>): string[] {
  const recoveredIds: string[] = [];

  updatePendingChatState(userId, (state) => {
    const nextState: PendingChatState = {
      conversationUpserts: { ...state.conversationUpserts },
      messageSnapshots: { ...state.messageSnapshots },
      deletedConversationIds: [...state.deletedConversationIds],
    };

    for (const cachedConversation of loadConversationsFromCache(userId)) {
      if (
        remoteConversationIds.has(cachedConversation.id) ||
        nextState.deletedConversationIds.includes(cachedConversation.id) ||
        nextState.conversationUpserts[cachedConversation.id]
      ) {
        continue;
      }

      const cachedMessages = loadMessagesFromCache(cachedConversation.id);
      if (cachedMessages.length === 0) {
        continue;
      }

      nextState.conversationUpserts[cachedConversation.id] = normalizeConversation(cachedConversation);
      nextState.messageSnapshots[cachedConversation.id] = dedupeMessages(cachedMessages);
      recoveredIds.push(cachedConversation.id);
    }

    return nextState;
  });

  return recoveredIds;
}

function recoverPendingMessagesFromCache(
  userId: string,
  conversationId: string,
  remoteMessages: ChatMessage[],
): boolean {
  const cachedMessages = loadMessagesFromCache(conversationId);
  const pendingSnapshot = getPendingMessageSnapshot(userId, conversationId);

  if (cachedMessages.length === 0 || pendingSnapshot.length > 0) {
    return false;
  }

  const cachedLastTimestamp = cachedMessages[cachedMessages.length - 1]?.timestamp || 0;
  const remoteLastTimestamp = remoteMessages[remoteMessages.length - 1]?.timestamp || 0;
  const shouldRecover =
    remoteMessages.length === 0 ||
    cachedMessages.length > remoteMessages.length ||
    cachedLastTimestamp > remoteLastTimestamp;

  if (!shouldRecover) {
    return false;
  }

  queueMessageSnapshot(userId, conversationId, cachedMessages);
  return true;
}

async function upsertConversationRemote(conversation: Conversation): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .upsert(
      {
        id: conversation.id,
        user_id: conversation.user_id,
        title: conversation.title,
        folder_id: conversation.folder_id || null,
        org_id: conversation.org_id || null,
        is_pinned: conversation.is_pinned || false,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      },
      { onConflict: 'id' },
    )
    .select()
    .single();

  if (error) {
    console.error('[chat-service] upsertConversationRemote FAILED:', error.message, '| code:', error.code);
    return null;
  }

  return normalizeConversation(data);
}

async function syncMessagesRemote(
  conversationId: string,
  userId: string,
  messages: ChatMessage[],
  sequence: number,
): Promise<boolean> {
  const validMessages = dedupeMessages(messages);

  if (validMessages.length > 0) {
    const rows = validMessages.map((message) => ({
      id: message.id,
      conversation_id: conversationId,
      user_id: userId,
      role: message.role,
      content: message.text,
      metadata: {
        sources: message.sources || null,
        images: message.images || null,
        feedback: message.feedback || null,
      },
    }));

    const { error: upsertError } = await supabase
      .from('messages')
      .upsert(rows, { onConflict: 'id' });

    if (upsertError) {
      console.error('[chat-service] syncMessagesRemote upsert FAILED:', upsertError.message, '| code:', upsertError.code);
      return false;
    }
  }

  if (saveSequenceByConversation.get(conversationId) !== sequence) {
    return false;
  }

  const { data: existing, error: fetchError } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId);

  if (fetchError) {
    console.warn('[chat-service] syncMessagesRemote fetch existing FAILED:', fetchError.message);
    return false;
  }

  if (saveSequenceByConversation.get(conversationId) !== sequence) {
    return false;
  }

  const currentIds = new Set(validMessages.map((message) => message.id));
  const orphanIds = (existing || [])
    .map((message: any) => message.id as string)
    .filter((id) => !currentIds.has(id));

  if (orphanIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .in('id', orphanIds);

    if (deleteError) {
      console.error('[chat-service] syncMessagesRemote delete orphans FAILED:', deleteError.message, '| code:', deleteError.code);
      return false;
    }
  }

  return true;
}

async function deleteConversationRemote(conversationId: string): Promise<boolean> {
  const { error: messageError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);

  if (messageError) {
    console.error('[chat-service] deleteConversationRemote messages FAILED:', messageError.message, '| code:', messageError.code);
    return false;
  }

  const { error: conversationError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (conversationError) {
    console.error('[chat-service] deleteConversationRemote conversation FAILED:', conversationError.message, '| code:', conversationError.code);
    return false;
  }

  return true;
}

export async function syncPendingChatState(userId: string, conversationIds?: string[]): Promise<void> {
  if (!userId || !isSupabaseConfigured()) {
    return;
  }

  const targetIds = new Set(conversationIds || []);
  const isTargetedSync = targetIds.size > 0;

  const deletedConversationIds = readPendingChatState(userId).deletedConversationIds;
  for (const conversationId of deletedConversationIds) {
    if (isTargetedSync && !targetIds.has(conversationId)) {
      continue;
    }

    const deleted = await deleteConversationRemote(conversationId);
    if (deleted) {
      clearPendingConversationDelete(userId, conversationId);
    }
  }

  const pendingConversations = getPendingConversationUpserts(userId);
  for (const pendingConversation of pendingConversations) {
    if (isTargetedSync && !targetIds.has(pendingConversation.id)) {
      continue;
    }

    const syncedConversation = await upsertConversationRemote(pendingConversation);
    if (!syncedConversation) {
      continue;
    }

    saveConversationToCache(userId, syncedConversation);
    clearPendingConversationUpsert(userId, pendingConversation.id);
  }

  const stateAfterConversationSync = readPendingChatState(userId);
  for (const [conversationId, snapshot] of Object.entries(stateAfterConversationSync.messageSnapshots)) {
    if (isTargetedSync && !targetIds.has(conversationId)) {
      continue;
    }

    const sequence = saveSequenceByConversation.get(conversationId) || 0;
    const syncedMessages = await syncMessagesRemote(conversationId, userId, snapshot, sequence);
    if (syncedMessages) {
      clearPendingMessageSnapshot(userId, conversationId);
      saveMessagesToCache(conversationId, snapshot);
    }
  }
}

export async function loadConversations(userId: string): Promise<Conversation[]> {
  if (!userId) {
    return [];
  }

  await syncPendingChatState(userId);

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(MAX_CONVERSATIONS);

    if (error) {
      console.error('[chat-service] loadConversations Supabase FAILED:', error.message, '| code:', error.code);
      return buildLocalConversationList(userId);
    }

    let remoteConversations = dedupeConversations((data || []).map((conversation: any) => normalizeConversation(conversation)));
    const recoveredConversationIds = recoverPendingConversationsFromCache(
      userId,
      new Set(remoteConversations.map((conversation) => conversation.id)),
    );

    if (recoveredConversationIds.length > 0) {
      await syncPendingChatState(userId, recoveredConversationIds);

      const { data: recoveredData, error: recoveredError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(MAX_CONVERSATIONS);

      if (!recoveredError) {
        remoteConversations = dedupeConversations((recoveredData || []).map((conversation: any) => normalizeConversation(conversation)));
      } else {
        remoteConversations = dedupeConversations([
          ...remoteConversations,
          ...loadConversationsFromCache(userId),
        ]);
      }
    }

    return buildConversationList(userId, remoteConversations);
  } catch (err) {
    console.error('[chat-service] loadConversations exception:', err);
    return buildLocalConversationList(userId);
  }
}

export async function loadMessages(conversationId: string, userId?: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[chat-service] loadMessages FAILED:', error.message, '| code:', error.code);
      return userId ? buildLocalMessageList(userId, conversationId) : loadMessagesFromCache(conversationId);
    }

    let remoteMessages = dedupeMessages((data || []).map((message: any) => ({
      id: message.id,
      role: message.role as 'user' | 'model',
      text: message.content,
      timestamp: new Date(message.created_at).getTime(),
      sources: message.metadata?.sources,
      images: message.metadata?.images,
      feedback: message.metadata?.feedback,
    })));

    if (userId && recoverPendingMessagesFromCache(userId, conversationId, remoteMessages)) {
      await syncPendingChatState(userId, [conversationId]);
      remoteMessages = dedupeMessages([
        ...remoteMessages,
        ...loadMessagesFromCache(conversationId),
      ]);
    }

    if (!userId) {
      saveMessagesToCache(conversationId, remoteMessages);
      return remoteMessages;
    }

    return buildMessageList(userId, conversationId, remoteMessages);
  } catch (err) {
    console.error('[chat-service] loadMessages exception:', err);
    return userId ? buildLocalMessageList(userId, conversationId) : loadMessagesFromCache(conversationId);
  }
}

export async function createConversation(
  userId: string,
  title: string,
  folderId?: string,
  orgId?: string,
): Promise<Conversation | null> {
  if (!userId) {
    return null;
  }

  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: crypto.randomUUID(),
    user_id: userId,
    title: title.trim() || 'Nueva conversacion',
    folder_id: folderId || undefined,
    org_id: orgId || undefined,
    is_pinned: false,
    created_at: now,
    updated_at: now,
  };

  saveConversationToCache(userId, conversation);
  queueConversationUpsert(userId, conversation);
  await syncPendingChatState(userId, [conversation.id]);

  return normalizeConversation(
    loadConversationsFromCache(userId).find((item) => item.id === conversation.id) || conversation,
  );
}

export async function saveMessages(
  conversationId: string,
  userId: string,
  messages: ChatMessage[],
): Promise<void> {
  const validMessages = dedupeMessages(
    messages.filter((message) => !message.id.startsWith('error-') && isPersistableMessage(message)),
  );

  saveMessagesToCache(conversationId, validMessages);

  if (validMessages.length === 0) {
    return;
  }

  const nextSequence = (saveSequenceByConversation.get(conversationId) || 0) + 1;
  saveSequenceByConversation.set(conversationId, nextSequence);

  const previousChain = saveChainByConversation.get(conversationId) || Promise.resolve();
  const currentChain = previousChain
    .catch(() => undefined)
    .then(async () => {
      const updatedConversation = updateConversationInCache(userId, conversationId, (conversation) => ({
        ...conversation,
        updated_at: new Date().toISOString(),
      }));

      if (updatedConversation) {
        queueConversationUpsert(userId, updatedConversation);
      }

      queueMessageSnapshot(userId, conversationId, validMessages);

      try {
        await syncPendingChatState(userId, [conversationId]);
      } catch (err) {
        console.error('[chat-service] saveMessages sync exception:', err);
      }
    })
    .finally(() => {
      if (saveChainByConversation.get(conversationId) === currentChain) {
        saveChainByConversation.delete(conversationId);
      }
    });

  saveChainByConversation.set(conversationId, currentChain);
  await currentChain;
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  removeConversationFromAllCaches(conversationId);

  if (userId) {
    queueConversationDelete(userId, conversationId);
    try {
      await syncPendingChatState(userId, [conversationId]);
    } catch (err) {
      console.error('[chat-service] deleteConversation sync exception:', err);
    }
  }

  return true;
}

export async function updateConversationTitle(
  userId: string,
  conversationId: string,
  title: string,
): Promise<void> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return;
  }

  const updatedConversation = updateConversationInCache(userId, conversationId, (conversation) => ({
    ...conversation,
    title: trimmedTitle,
    updated_at: new Date().toISOString(),
  }));

  if (!updatedConversation) {
    return;
  }

  queueConversationUpsert(userId, updatedConversation);

  try {
    await syncPendingChatState(userId, [conversationId]);
  } catch (err) {
    console.error('[chat-service] updateConversationTitle sync exception:', err);
  }
}

export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (firstUserMessage) {
    const text = firstUserMessage.text.trim();
    return text.length > 40 ? `${text.slice(0, 40)}...` : text;
  }
  return 'Nueva conversacion';
}
