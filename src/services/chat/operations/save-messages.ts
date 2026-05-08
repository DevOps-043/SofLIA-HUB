import { saveMessagesToCache, updateConversationInCache } from '../cache';
import { dedupeMessages, isPersistableMessage } from '../normalize';
import { queueConversationUpsert, queueMessageSnapshot } from '../pending-state';
import { syncPendingChatState } from '../sync';
import type { ChatMessage } from '../types';

const saveChainByConversation = new Map<string, Promise<void>>();

export async function saveMessages(conversationId: string, userId: string, messages: ChatMessage[]): Promise<void> {
  const validMessages = dedupeMessages(
    messages.filter((message) => !message.id.startsWith('error-') && isPersistableMessage(message)),
  );

  saveMessagesToCache(conversationId, validMessages);
  if (validMessages.length === 0) return;

  const previous = saveChainByConversation.get(conversationId) || Promise.resolve();
  const chain = previous
    .catch(() => undefined)
    .then(() => syncConversationMessages(conversationId, userId, validMessages))
    .finally(() => {
      if (saveChainByConversation.get(conversationId) === chain) saveChainByConversation.delete(conversationId);
    });

  saveChainByConversation.set(conversationId, chain);
  await chain;
}

async function syncConversationMessages(conversationId: string, userId: string, validMessages: ChatMessage[]): Promise<void> {
  const updated = updateConversationInCache(userId, conversationId, (conversation) => ({
    ...conversation,
    updated_at: new Date().toISOString(),
  }));
  if (updated) queueConversationUpsert(userId, updated);
  queueMessageSnapshot(userId, conversationId, validMessages);

  try {
    await syncPendingChatState(userId, [conversationId]);
  } catch (err) {
    console.error('[chat-service] saveMessages sync exception:', err);
  }
}
