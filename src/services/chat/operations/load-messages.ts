import { supabase } from '../../../lib/supabase';
import { loadMessagesFromCache, saveMessagesToCache } from '../cache';
import { buildLocalMessageList, buildMessageList } from '../builders';
import { dedupeMessages } from '../normalize';
import { recoverPendingMessagesFromCache } from '../recovery';
import { syncPendingChatState } from '../sync';
import type { ChatMessage } from '../types';

export async function loadMessages(conversationId: string, userId?: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) return loadLocalMessages(conversationId, userId, error);

    let remote = mapRemoteMessages(data || []);
    if (userId && recoverPendingMessagesFromCache(userId, conversationId, remote)) {
      await syncPendingChatState(userId, [conversationId]);
      remote = dedupeMessages([...remote, ...loadMessagesFromCache(conversationId)]);
    }

    if (!userId) {
      saveMessagesToCache(conversationId, remote);
      return remote;
    }
    return buildMessageList(userId, conversationId, remote);
  } catch (err) {
    console.error('[chat-service] loadMessages exception:', err);
    return userId ? buildLocalMessageList(userId, conversationId) : loadMessagesFromCache(conversationId);
  }
}

function loadLocalMessages(conversationId: string, userId: string | undefined, error: any) {
  console.error('[chat-service] loadMessages FAILED:', error.message, '| code:', error.code);
  return userId ? buildLocalMessageList(userId, conversationId) : loadMessagesFromCache(conversationId);
}

function mapRemoteMessages(rows: Record<string, unknown>[]): ChatMessage[] {
  return dedupeMessages(rows.map((message) => ({
    id: message.id as string,
    role: message.role as 'user' | 'model',
    text: message.content as string,
    timestamp: new Date(message.created_at as string).getTime(),
    sources: (message.metadata as { sources?: ChatMessage['sources'] })?.sources,
    images: (message.metadata as { images?: ChatMessage['images'] })?.images,
    feedback: (message.metadata as { feedback?: ChatMessage['feedback'] })?.feedback,
  })));
}
