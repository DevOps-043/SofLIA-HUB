import { loadConversationsFromCache } from '../cache';
import { buildConversationList, buildLocalConversationList } from '../builders';
import { recoverPendingConversationsFromCache } from '../recovery';
import { fetchAccessibleConversations } from '../remote';
import { syncPendingChatState } from '../sync';
import type { Conversation } from '../types';

export async function loadConversations(
  userId: string,
  orgId?: string,
  accessUserIds?: string[],
): Promise<Conversation[]> {
  if (!userId) return [];
  await syncPendingChatState(userId);

  try {
    let remote = await fetchRemoteConversations(userId, orgId, accessUserIds);
    const recovered = recoverPendingConversationsFromCache(userId, new Set(remote.map((conversation) => conversation.id)));
    if (recovered.length > 0) {
      await syncPendingChatState(userId, recovered);
      remote = await retryFetchAfterRecovery(userId, orgId, accessUserIds, remote);
    }
    return buildConversationList(userId, remote);
  } catch (err) {
    console.error('[chat-service] loadConversations exception:', err);
    return buildLocalConversationList(userId);
  }
}

function fetchRemoteConversations(userId: string, orgId?: string, accessUserIds?: string[]) {
  return fetchAccessibleConversations(
    userId,
    accessUserIds && accessUserIds.length > 0 ? accessUserIds : [userId],
    orgId,
  );
}

async function retryFetchAfterRecovery(userId: string, orgId: string | undefined, accessUserIds: string[] | undefined, remote: Conversation[]) {
  try {
    return await fetchRemoteConversations(userId, orgId, accessUserIds);
  } catch {
    return [...remote, ...loadConversationsFromCache(userId)];
  }
}
