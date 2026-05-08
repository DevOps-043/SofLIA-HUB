import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { applyAccessibleShareFilter } from './filters';
import { normalizeConversationShare, normalizeFolderShare, normalizeUserIds } from './normalizers';
import type { AccessibleConversationShare, AccessibleFolderShare } from './types';

export async function loadAccessibleConversationShares(
  userIds: string | string[],
  orgId?: string,
): Promise<AccessibleConversationShare[]> {
  const normalizedUserIds = normalizeUserIds(userIds);
  if ((normalizedUserIds.length === 0 && !orgId) || !isSupabaseConfigured()) return [];
  let query = supabase
    .from('conversation_shares')
    .select('id, conversation_id, shared_by, shared_with_user_id, org_id, permission, share_token, is_active, created_at, revoked_at, conversation:conversations(*)')
    .eq('is_active', true);

  if (orgId) query = query.eq('org_id', orgId);
  query = applyAccessibleShareFilter(query, normalizedUserIds, orgId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[share-service] loadAccessibleConversationShares FAILED:', error.message, '| code:', error.code);
    return [];
  }
  return (data || []).map((share: any) => ({
    ...normalizeConversationShare(share),
    conversation: share.conversation || null,
  }));
}

export async function loadAccessibleFolderShares(
  userIds: string | string[],
  orgId?: string,
): Promise<AccessibleFolderShare[]> {
  const normalizedUserIds = normalizeUserIds(userIds);
  if ((normalizedUserIds.length === 0 && !orgId) || !isSupabaseConfigured()) return [];
  let query = supabase
    .from('folder_shares')
    .select('id, folder_id, shared_by, shared_with_user_id, org_id, permission, share_token, is_active, created_at, revoked_at, folder:folders(*)')
    .eq('is_active', true);

  if (orgId) query = query.eq('org_id', orgId);
  query = applyAccessibleShareFilter(query, normalizedUserIds, orgId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[share-service] loadAccessibleFolderShares FAILED:', error.message, '| code:', error.code);
    return [];
  }
  return (data || []).map((share: any) => ({
    ...normalizeFolderShare(share),
    folder: share.folder || null,
  }));
}
