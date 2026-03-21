import { supabase } from '../lib/supabase';

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

const CONVERSATIONS_CACHE_KEY = 'lia_conversations';
const MESSAGE_CACHE_PREFIX = 'lia_messages_';
const saveSequenceByConversation = new Map<string, number>();
const saveChainByConversation = new Map<string, Promise<void>>();

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
    const existing = byId.get(conversation.id);
    if (!existing) {
      byId.set(conversation.id, conversation);
      continue;
    }

    const existingUpdated = new Date(existing.updated_at || existing.created_at || 0).getTime();
    const nextUpdated = new Date(conversation.updated_at || conversation.created_at || 0).getTime();
    if (nextUpdated >= existingUpdated) {
      byId.set(conversation.id, conversation);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime(),
  );
}

function normalizeMessage(raw: Partial<ChatMessage> & { id?: string | null }): ChatMessage | null {
  const id = raw.id?.trim();
  if (!id) return null;

  const text = typeof raw.text === 'string' ? raw.text : '';
  const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : undefined;
  const sources = Array.isArray(raw.sources) ? raw.sources.filter((source) => source?.uri) : undefined;

  if (!text.trim() && (!images || images.length === 0)) {
    return null;
  }

  return {
    id,
    role: raw.role === 'user' ? 'user' : 'model',
    text,
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

function updateConversationCache(userId: string, updater: (conversations: Conversation[]) => Conversation[]): void {
  try {
    const cacheKey = `${CONVERSATIONS_CACHE_KEY}_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    const conversations = cached ? dedupeConversations(JSON.parse(cached)) : [];
    localStorage.setItem(cacheKey, JSON.stringify(dedupeConversations(updater(conversations)).slice(0, 50)));
  } catch {}
}

function removeConversationFromAllCaches(conversationId: string): void {
  try {
    localStorage.removeItem(`${MESSAGE_CACHE_PREFIX}${conversationId}`);

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(`${CONVERSATIONS_CACHE_KEY}_`)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const conversations = dedupeConversations(JSON.parse(raw)).filter((conversation) => conversation.id !== conversationId);
      localStorage.setItem(key, JSON.stringify(conversations));
    }
  } catch {}
}

export async function loadConversations(userId: string): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[chat-service] loadConversations Supabase FAILED:', error.message, '| code:', error.code);
      return loadConversationsFromCache(userId);
    }

    const conversations = dedupeConversations((data || []).map((conversation: any) => normalizeConversation(conversation)));
    try {
      localStorage.setItem(`${CONVERSATIONS_CACHE_KEY}_${userId}`, JSON.stringify(conversations));
    } catch {}
    return conversations;
  } catch (err) {
    console.error('[chat-service] loadConversations exception:', err);
    return loadConversationsFromCache(userId);
  }
}

function loadConversationsFromCache(userId: string): Conversation[] {
  try {
    const cached = localStorage.getItem(`${CONVERSATIONS_CACHE_KEY}_${userId}`);
    return cached ? dedupeConversations(JSON.parse(cached)) : [];
  } catch {
    return [];
  }
}

export async function loadMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[chat-service] loadMessages FAILED:', error.message);
      return loadMessagesFromCache(conversationId);
    }

    const messages = dedupeMessages((data || []).map((message: any) => ({
      id: message.id,
      role: message.role as 'user' | 'model',
      text: message.content,
      timestamp: new Date(message.created_at).getTime(),
      sources: message.metadata?.sources,
      images: message.metadata?.images,
      feedback: message.metadata?.feedback,
    })));

    saveMessagesToCache(conversationId, messages);
    return messages;
  } catch (err) {
    console.error('[chat-service] loadMessages exception:', err);
    return loadMessagesFromCache(conversationId);
  }
}

function loadMessagesFromCache(conversationId: string): ChatMessage[] {
  try {
    const cached = localStorage.getItem(`${MESSAGE_CACHE_PREFIX}${conversationId}`);
    return cached ? dedupeMessages(JSON.parse(cached)) : [];
  } catch {
    return [];
  }
}

export function saveMessagesToCache(conversationId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(`${MESSAGE_CACHE_PREFIX}${conversationId}`, JSON.stringify(dedupeMessages(messages)));
  } catch {}
}

export async function createConversation(
  userId: string,
  title: string,
  folderId?: string,
  orgId?: string,
): Promise<Conversation | null> {
  const row: Record<string, any> = {
    user_id: userId,
    title,
    folder_id: folderId || null,
  };
  if (orgId) row.org_id = orgId;

  try {
    const { data, error } = await supabase
      .from('conversations')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[chat-service] createConversation Supabase FAILED:', error.message, '| code:', error.code);
      const localConversation: Conversation = {
        id: crypto.randomUUID(),
        user_id: userId,
        title,
        folder_id: folderId,
        org_id: orgId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveConversationToCache(userId, localConversation);
      return localConversation;
    }

    if (data) saveConversationToCache(userId, data);
    return data;
  } catch (err) {
    console.error('[chat-service] createConversation exception:', err);
    const localConversation: Conversation = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      folder_id: folderId,
      org_id: orgId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveConversationToCache(userId, localConversation);
    return localConversation;
  }
}

function saveConversationToCache(userId: string, conversation: Conversation) {
  updateConversationCache(userId, (conversations) => {
    const next = conversations.filter((item) => item.id !== conversation.id);
    next.unshift(normalizeConversation(conversation));
    return next;
  });
}

export async function saveMessages(
  conversationId: string,
  userId: string,
  messages: ChatMessage[],
): Promise<void> {
  saveMessagesToCache(conversationId, messages);

  const validMessages = dedupeMessages(
    messages.filter(
      (message) => !message.id.startsWith('error-') && (
        (message.text && message.text.trim().length > 0) ||
        (message.images && message.images.length > 0)
      ),
    ),
  );

  const nextSequence = (saveSequenceByConversation.get(conversationId) || 0) + 1;
  saveSequenceByConversation.set(conversationId, nextSequence);

  const previousChain = saveChainByConversation.get(conversationId) || Promise.resolve();
  const currentChain = previousChain
    .catch(() => undefined)
    .then(async () => {
      try {
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
            console.error('[chat-service] upsert error:', upsertError);
            return;
          }
        }

        if (saveSequenceByConversation.get(conversationId) !== nextSequence) {
          return;
        }

        const { data: existing, error: fetchError } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', conversationId);

        if (fetchError) {
          console.warn('[chat-service] fetch existing error:', fetchError.message);
          return;
        }

        if (saveSequenceByConversation.get(conversationId) !== nextSequence) {
          return;
        }

        const currentIds = new Set(validMessages.map((message) => message.id));
        const orphanIds = (existing || [])
          .map((message: any) => message.id as string)
          .filter((id) => !currentIds.has(id));

        if (orphanIds.length === 0) {
          return;
        }

        const { error: deleteError } = await supabase
          .from('messages')
          .delete()
          .in('id', orphanIds);

        if (deleteError) {
          console.error('[chat-service] delete orphans error:', deleteError);
        }
      } catch (err) {
        console.error('[chat-service] saveMessages exception:', err);
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

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const { error: messageError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);

  if (messageError) {
    console.error('Error deleting messages:', messageError);
    return false;
  }

  const { error: conversationError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (conversationError) {
    console.error('Error deleting conversation:', conversationError);
    return false;
  }

  removeConversationFromAllCaches(conversationId);
  return true;
}

export async function updateConversationTitle(
  conversationId: string,
  title: string,
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId);

  if (error) {
    console.error('Error updating conversation title:', error);
  }

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(`${CONVERSATIONS_CACHE_KEY}_`)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const conversations = dedupeConversations(JSON.parse(raw)).map((conversation) =>
        conversation.id === conversationId ? { ...conversation, title } : conversation,
      );
      localStorage.setItem(key, JSON.stringify(conversations));
    }
  } catch {}
}

export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (firstUserMessage) {
    const text = firstUserMessage.text.trim();
    return text.length > 40 ? `${text.slice(0, 40)}...` : text;
  }
  return 'Nueva conversacion';
}
