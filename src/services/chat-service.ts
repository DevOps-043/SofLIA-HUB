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
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[chat-service] loadMessages FAILED:', error.message, '| code:', error.code, '| details:', error.details);
    return [];
  }

  return (data || []).map((m: any) => ({
    id: m.id,
    role: m.role as 'user' | 'model',
    text: m.content,
    timestamp: new Date(m.created_at).getTime(),
    sources: m.metadata?.sources,
    images: m.metadata?.images,
    feedback: m.metadata?.feedback,
  }));
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
 * Guarda mensajes (insert nuevos, update existentes con contenido cambiado).
 */
export async function saveMessages(
  conversationId: string,
  userId: string,
  messages: ChatMessage[]
): Promise<void> {
  if (messages.length === 0) return;

  // Obtener mensajes existentes
  const { data: existingMsgs } = await supabase
    .from('messages')
    .select('id, content')
    .eq('conversation_id', conversationId);

  const existingMap = new Map<string, string>();
  existingMsgs?.forEach((m: any) => existingMap.set(m.id, m.content));

  // Filtrar mensajes validos
  const validMessages = messages.filter(
    m => m.text && m.text.trim().length > 0 && !m.id.startsWith('error-')
  );

  // Separar nuevos y actualizados
  const newMessages = validMessages.filter(m => !existingMap.has(m.id));
  const updatedMessages = validMessages.filter(m => {
    return existingMap.has(m.id);
  });

  // Insert nuevos
  if (newMessages.length > 0) {
    const { error } = await supabase.from('messages').insert(
      newMessages.map(m => ({
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
      }))
    );
    if (error) {
      console.error('Error inserting messages:', error);
    }
  }

  // Update existentes
  for (const m of updatedMessages) {
    const { error } = await supabase
      .from('messages')
      .update({
        content: m.text,
        metadata: {
          sources: m.sources || null,
          images: m.images || null,
          feedback: m.feedback || null,
        },
      })
      .eq('id', m.id);

    if (error) {
      console.error('Error updating message:', error);
    }
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
