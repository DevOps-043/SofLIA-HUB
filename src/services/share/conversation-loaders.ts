import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { normalizeConversationShare } from './normalizers';
import type { ConversationShare } from './types';

export async function loadConversationShares(conversationId: string): Promise<ConversationShare[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('conversation_shares')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadConversationShares FAILED:', error.message, '| code:', error.code);
    return [];
  }
  return (data || []).map((share: any) => normalizeConversationShare(share));
}

export async function loadOutgoingConversationShares(
  sharedByUserId: string,
  orgId?: string,
): Promise<ConversationShare[]> {
  const normalizedUserId = sharedByUserId?.trim();
  if (!normalizedUserId || !isSupabaseConfigured()) return [];
  let query = supabase
    .from('conversation_shares')
    .select('*')
    .eq('shared_by', normalizedUserId)
    .eq('is_active', true);

  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[share-service] loadOutgoingConversationShares FAILED:', error.message, '| code:', error.code);
    return [];
  }
  return (data || []).map((share: any) => normalizeConversationShare(share));
}
