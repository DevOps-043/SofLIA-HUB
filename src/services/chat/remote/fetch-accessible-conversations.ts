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
import { isMissingSoftDeleteColumn, warnMissingSoftDeleteColumn } from './soft-delete';

function buildOwnConversationsQuery(userId: string, orgId: string | undefined, excludeDeleted: boolean) {
  let query = supabase.from('conversations').select('*').eq('user_id', userId);
  if (orgId) query = query.eq('org_id', orgId);
  if (excludeDeleted) query = query.is('deleted_at', null);
  return query.order('updated_at', { ascending: false }).limit(MAX_CONVERSATIONS);
}

/**
 * Pide solo las activas. Si la migracion del borrado logico aun no se aplico,
 * repite sin el filtro en vez de dejar el listado sin datos.
 */
async function selectOwnConversations(userId: string, orgId?: string) {
  const filtered = await buildOwnConversationsQuery(userId, orgId, true);
  if (!isMissingSoftDeleteColumn(filtered.error)) return filtered;

  warnMissingSoftDeleteColumn('fetchAccessibleConversations');
  return buildOwnConversationsQuery(userId, orgId, false);
}

export async function fetchAccessibleConversations(
  userId: string,
  accessUserIds: string[],
  orgId?: string,
): Promise<Conversation[]> {
  const ownedFoldersQuery = supabase.from('folders').select('id').eq('user_id', userId);
  if (orgId) ownedFoldersQuery.eq('org_id', orgId);

  const [
    ownConversationsResult,
    ownedFoldersResult,
    sharedConversationShares,
    sharedFolderShares,
    outgoingConversationShares,
  ] = await Promise.all([
    selectOwnConversations(userId, orgId),
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

  // Un chat borrado tampoco se muestra a quien lo tenia compartido: los shares
  // traen la conversacion incrustada y ahi el filtro no viaja en la consulta.
  return dedupeConversations(
    [...ownedConversations, ...folderConversations, ...directSharedConversations].filter(
      (conversation) => !conversation.deleted_at,
    ),
  );
}
