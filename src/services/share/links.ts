import { isSupabaseConfigured } from '../../lib/supabase';
import { loadExistingConversationShare, loadExistingFolderShare } from './existing';
import { buildShareToken } from './tokens';
import type { SharePermission } from './types';
import { upsertConversationShareRow, upsertFolderShareRow } from './upserts';

export async function generateConversationShareLink(
  conversationId: string,
  sharedByUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Lia no esta configurado en este entorno.');
  const existing = await loadExistingConversationShare(conversationId, orgId, null);
  const shareToken = existing?.share_token || buildShareToken('conv');
  await upsertConversationShareRow({
    id: existing?.id,
    conversation_id: conversationId,
    shared_by: sharedByUserId,
    shared_with_user_id: null,
    org_id: orgId,
    permission,
    share_token: shareToken,
    is_active: true,
    revoked_at: null,
  });
  return shareToken;
}

export async function generateFolderShareLink(
  folderId: string,
  sharedByUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Lia no esta configurado en este entorno.');
  const existing = await loadExistingFolderShare(folderId, orgId, null);
  const shareToken = existing?.share_token || buildShareToken('fold');
  await upsertFolderShareRow({
    id: existing?.id,
    folder_id: folderId,
    shared_by: sharedByUserId,
    shared_with_user_id: null,
    org_id: orgId,
    permission,
    share_token: shareToken,
    is_active: true,
    revoked_at: null,
  });
  return shareToken;
}
