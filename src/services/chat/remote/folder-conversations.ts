import { supabase } from '../../../lib/supabase';
import {
  decorateOwnedConversation,
  decorateSharedConversation,
  normalizeConversation,
} from '../normalize';
import { MAX_CONVERSATIONS, type Conversation } from '../types';

export async function buildFolderConversations(
  userId: string,
  ownedFolderIds: Set<string>,
  sharedFolderShares: any[],
  outgoingShareMap: Map<string, { share_token?: string | null; created_at: string }>,
): Promise<Conversation[]> {
  const accessibleFolderIds = Array.from(new Set([...ownedFolderIds, ...sharedFolderShares.map((share) => share.folder_id)]));
  if (accessibleFolderIds.length === 0) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .in('folder_id', accessibleFolderIds)
    .order('updated_at', { ascending: false })
    .limit(MAX_CONVERSATIONS);

  if (error) throw error;

  const sharedFolderShareMap = new Map(sharedFolderShares.map((share) => [share.folder_id, share]));
  return (data || []).map((raw: Record<string, unknown>) =>
    normalizeFolderConversation(raw, userId, ownedFolderIds, sharedFolderShareMap, outgoingShareMap)
  );
}

function normalizeFolderConversation(
  raw: Record<string, unknown>,
  userId: string,
  ownedFolderIds: Set<string>,
  sharedFolderShareMap: Map<string, any>,
  outgoingShareMap: Map<string, { share_token?: string | null; created_at: string }>,
) {
  if (raw.user_id === userId) {
    return decorateOwnedConversation(raw, outgoingShareMap.get(raw.id as string));
  }

  const folderShare = sharedFolderShareMap.get(raw.folder_id as string);
  if (folderShare) return decorateSharedConversation(raw, folderShare);

  if (ownedFolderIds.has(raw.folder_id as string)) {
    return normalizeConversation({
      ...raw,
      is_shared: true,
      share_permission: 'edit',
      can_edit: true,
      can_share: false,
      shared_by_user_id: raw.user_id as string,
      share_token: null,
      shared_at: raw.created_at as string,
    });
  }

  return decorateOwnedConversation(raw);
}
