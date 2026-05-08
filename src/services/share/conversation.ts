import { isSupabaseConfigured } from '../../lib/supabase';
import { loadExistingConversationShare } from './existing';
import { resolveTargetProfileByEmail } from './profiles';
import type { ConversationShare, SharePermission } from './types';
import { upsertConversationShareRow } from './upserts';

export async function shareConversationWithEmail(
  conversationId: string,
  sharedByUserId: string,
  targetEmail: string,
  orgId: string,
  permission: SharePermission,
): Promise<ConversationShare> {
  if (!isSupabaseConfigured()) throw new Error('Lia no esta configurado en este entorno.');
  const targetProfile = await resolveTargetProfileByEmail(targetEmail);
  return shareConversationWithTarget(conversationId, sharedByUserId, targetProfile.id, orgId, permission);
}

export async function shareConversationWithUserId(
  conversationId: string,
  sharedByUserId: string,
  sharedWithUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<ConversationShare> {
  if (!isSupabaseConfigured()) throw new Error('Lia no esta configurado en este entorno.');
  const targetUserId = sharedWithUserId?.trim();
  if (!targetUserId) throw new Error('No encontre un identificador valido para compartir esta conversacion.');
  return shareConversationWithTarget(conversationId, sharedByUserId, targetUserId, orgId, permission);
}

async function shareConversationWithTarget(
  conversationId: string,
  sharedByUserId: string,
  targetUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<ConversationShare> {
  const existing = await loadExistingConversationShare(conversationId, orgId, targetUserId);
  if (existing?.permission === permission) return existing;
  return upsertConversationShareRow({
    id: existing?.id,
    conversation_id: conversationId,
    shared_by: sharedByUserId,
    shared_with_user_id: targetUserId,
    org_id: orgId,
    permission,
    share_token: existing?.share_token ?? null,
    is_active: true,
    revoked_at: null,
  });
}
