import { supabase } from '../lib/supabase';

// ============================================
// Types
// ============================================

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

// ============================================
// Conversation CRUD
// ============================================

const CONVERSATIONS_CACHE_KEY = 'lia_conversations';

/**
 * Carga todas las conversaciones del usuario (max 50, mas recientes primero).
 * Falls back to localStorage if Supabase fails.
 */
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
      // Fallback to localStorage
      return loadConversationsFromCache(userId);
    }

    const convs = data || [];
    // Cache to localStorage
    try {
      localStorage.setItem(CONVERSATIONS_CACHE_KEY + '_' + userId, JSON.stringify(convs));
    } catch {}
    return convs;
  } catch (err) {
    console.error('[chat-service] loadConversations exception:', err);
    return loadConversationsFromCache(userId);
  }
}

function loadConversationsFromCache(userId: string): Conversation[] {
  try {
    const cached = localStorage.getItem(CONVERSATIONS_CACHE_KEY + '_' + userId);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

/**
 * Carga los mensajes de una conversacion.
 */
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

    const msgs = (data || []).map((m: any) => ({
      id: m.id,
      role: m.role as 'user' | 'model',
      text: m.content,
      timestamp: new Date(m.created_at).getTime(),
      sources: m.metadata?.sources,
      images: m.metadata?.images,
      feedback: m.metadata?.feedback,
    }));

    // Save to cache
    saveMessagesToCache(conversationId, msgs);
    return msgs;
  } catch (err) {
    console.error('[chat-service] loadMessages exception:', err);
    return loadMessagesFromCache(conversationId);
  }
}

function loadMessagesFromCache(conversationId: string): ChatMessage[] {
  try {
    const cached = localStorage.getItem(`lia_messages_${conversationId}`);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

export function saveMessagesToCache(conversationId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(`lia_messages_${conversationId}`, JSON.stringify(messages));
  } catch {}
}

/**
 * Crea una nueva conversacion.
 */
export async function createConversation(
  userId: string,
  title: string,
  folderId?: string,
  orgId?: string
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
      // Create locally with a UUID
      const localConv: Conversation = {
        id: crypto.randomUUID(),
        user_id: userId,
        title,
        folder_id: folderId,
        org_id: orgId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveConversationToCache(userId, localConv);
      return localConv;
    }

    // Cache the new conversation
    if (data) saveConversationToCache(userId, data);
    return data;
  } catch (err) {
    console.error('[chat-service] createConversation exception:', err);
    // Create locally
    const localConv: Conversation = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      folder_id: folderId,
      org_id: orgId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveConversationToCache(userId, localConv);
    return localConv;
  }
}

function saveConversationToCache(userId: string, conv: Conversation) {
  try {
    const cached = localStorage.getItem(CONVERSATIONS_CACHE_KEY + '_' + userId);
    const convs: Conversation[] = cached ? JSON.parse(cached) : [];
    const existing = convs.findIndex(c => c.id === conv.id);
    if (existing >= 0) convs[existing] = conv;
    else convs.unshift(conv);
    localStorage.setItem(CONVERSATIONS_CACHE_KEY + '_' + userId, JSON.stringify(convs.slice(0, 50)));
  } catch {}
}

/**
 * Sincroniza mensajes con Supabase: upsert los actuales + eliminar huérfanos.
 * Diseñado para ser la ÚNICA función de persistencia. Idempotente y segura
 * contra race conditions — el último llamador siempre gana.
 */
export async function saveMessages(
  conversationId: string,
  userId: string,
  messages: ChatMessage[]
): Promise<void> {
  // Siempre actualizar cache local primero
  saveMessagesToCache(conversationId, messages);

  // Un mensaje es válido si tiene texto O imágenes (no filtrar respuestas con imágenes pero sin texto)
  const validMessages = messages.filter(
    m => !m.id.startsWith('error-') && (
      (m.text && m.text.trim().length > 0) ||
      (m.images && m.images.length > 0)
    )
  );

  try {
    // 1. Upsert todos los mensajes actuales (insert o update en una sola operación)
    if (validMessages.length > 0) {
      const rows = validMessages.map(m => ({
        id: m.id,
        conversation_id: conversationId,
        user_id: userId,
        role: m.role,
        content: m.text,
        metadata: {
          sources: m.sources || null,
          images: m.images || null,
          feedback: m.feedback || null,
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

    // 2. Eliminar mensajes huérfanos (los que están en Supabase pero no en el estado local)
    const { data: existing, error: fetchError } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId);

    if (fetchError) {
      console.warn('[chat-service] fetch existing error:', fetchError.message);
      return;
    }

    const currentIds = new Set(validMessages.map(m => m.id));
    const orphanIds = (existing || [])
      .map((m: any) => m.id as string)
      .filter(id => !currentIds.has(id));

    if (orphanIds.length > 0) {
      const { error: delError } = await supabase
        .from('messages')
        .delete()
        .in('id', orphanIds);

      if (delError) {
        console.error('[chat-service] delete orphans error:', delError);
      } else {
        console.log(`[chat-service] Deleted ${orphanIds.length} orphan messages`);
      }
    }
  } catch (err) {
    console.error('[chat-service] saveMessages exception:', err);
  }
}

/**
 * Elimina una conversacion y sus mensajes.
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  // Primero borrar mensajes
  const { error: msgError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);

  if (msgError) {
    console.error('Error deleting messages:', msgError);
    return false;
  }

  // Luego borrar conversacion
  const { error: convError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (convError) {
    console.error('Error deleting conversation:', convError);
    return false;
  }

  return true;
}

/**
 * Actualiza el titulo de una conversacion.
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId);

  if (error) {
    console.error('Error updating conversation title:', error);
  }
}

/**
 * Genera un titulo a partir del primer mensaje del usuario.
 */
export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (firstUserMsg) {
    const text = firstUserMsg.text.trim();
    return text.length > 40 ? text.slice(0, 40) + '...' : text;
  }
  return 'Nueva conversacion';
}
