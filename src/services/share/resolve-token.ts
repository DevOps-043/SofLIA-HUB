import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { normalizeShareToken } from './normalizers';
import type { ResolvedShareTarget } from './types';

export async function resolveShareTargetByToken(
  shareTokenOrUrl: string,
  orgId?: string,
): Promise<ResolvedShareTarget | null> {
  const shareToken = normalizeShareToken(shareTokenOrUrl);
  if (!shareToken || !isSupabaseConfigured()) return null;

  const conversationTarget = await resolveConversationToken(shareToken, orgId);
  if (conversationTarget) return conversationTarget;
  return resolveFolderToken(shareToken, orgId);
}

async function resolveConversationToken(shareToken: string, orgId?: string): Promise<ResolvedShareTarget | null> {
  let query = supabase
    .from('conversation_shares')
    .select('conversation_id, org_id, permission, share_token')
    .eq('share_token', shareToken)
    .eq('is_active', true);

  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query.limit(1);
  if (error) {
    console.error('[share-service] resolveShareTargetByToken conversation FAILED:', error.message, '| code:', error.code);
    return null;
  }

  const row = data?.[0];
  if (!row?.conversation_id || !row?.share_token) return null;
  return {
    targetType: 'conversation',
    targetId: row.conversation_id,
    permission: row.permission === 'edit' ? 'edit' : 'view',
    shareToken: row.share_token,
    orgId: row.org_id,
  };
}

async function resolveFolderToken(shareToken: string, orgId?: string): Promise<ResolvedShareTarget | null> {
  let query = supabase
    .from('folder_shares')
    .select('folder_id, org_id, permission, share_token')
    .eq('share_token', shareToken)
    .eq('is_active', true);

  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query.limit(1);
  if (error) {
    console.error('[share-service] resolveShareTargetByToken folder FAILED:', error.message, '| code:', error.code);
    return null;
  }

  const row = data?.[0];
  if (!row?.folder_id || !row?.share_token) return null;
  return {
    targetType: 'folder',
    targetId: row.folder_id,
    permission: row.permission === 'edit' ? 'edit' : 'view',
    shareToken: row.share_token,
    orgId: row.org_id,
  };
}
