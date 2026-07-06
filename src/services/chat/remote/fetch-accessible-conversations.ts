import { supabase } from '../../../lib/supabase';
import {
  loadAccessibleConversationShares,
  loadAccessibleFolderShares,
  loadOutgoingConversationShares,
} from '../../share-service';
import {
  decorateOwnedConversation,
  decorateSharedConversation,
  dedupeConversations,
} from '../normalize';
import { MAX_CONVERSATIONS, type Conversation } from '../types';
import { buildFolderConversations } from './folder-conversations';
import { buildOutgoingShareMap } from './outgoing-share-map';

export async function fetchAccessibleConversations(
  userId: string,
  accessUserIds: string[],
  orgId?: string,
): Promise<Conversation[]> {
  const ownConversationsQuery = supabase.from('conversations').select('*').eq('user_id', userId);
  const ownedFoldersQuery = supabase.from('folders').select('id').eq('user_id', userId);
  if (orgId) {
    ownConversationsQuery.eq('org_id', orgId);
    ownedFoldersQuery.eq('org_id', orgId);
  }

  const [
    ownConversationsResult,
    ownedFoldersResult,
    sharedConversationShares,
    sharedFolderShares,
    outgoingConversationShares,
  ] = await Promise.all([
    ownConversationsQuery.order('updated_at', { ascending: false }).limit(MAX_CONVERSATIONS),
    ownedFoldersQuery,
    loadAccessibleConversationShares(accessUserIds, orgId),
    loadAccessibleFolderShares(accessUserIds, orgId),
    loadOutgoingConversationShares(userId, orgId),
  ]);

  if (ownConversationsResult.error) throw ownConversationsResult.error;
  if (ownedFoldersResult.error) throw ownedFoldersResult.error;

  const outgoingShareMap = buildOutgoingShareMap(outgoingConversationShares);
  const ownedConversations = (ownConversationsResult.data || []).map((conversation: Record<string, unknown>) =>
    decorateOwnedConversation(conversation, outgoingShareMap.get(conversation.id as string)),
  );
  const ownedFolderIds = new Set((ownedFoldersResult.data || []).map((folder: { id: string }) => folder.id));
  const folderConversations = await buildFolderConversations(userId, ownedFolderIds, sharedFolderShares, outgoingShareMap);
  const directSharedConversations = sharedConversationShares
    .filter((share) => share.conversation)
    .map((share) =>
      share.conversation?.user_id === userId
        ? decorateOwnedConversation(
            share.conversation as unknown as Record<string, unknown>,
            outgoingShareMap.get(share.conversation.id),
          )
        : decorateSharedConversation(share.conversation as unknown as Record<string, unknown>, share),
    );

  return dedupeConversations([...ownedConversations, ...folderConversations, ...directSharedConversations]);
}
