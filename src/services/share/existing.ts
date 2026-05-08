import { supabase } from '../../lib/supabase';
import { normalizeConversationShare, normalizeFolderShare } from './normalizers';
import type { ConversationShare, FolderShare } from './types';

export async function loadExistingConversationShare(
  conversationId: string,
  orgId: string,
  sharedWithUserId: string | null,
): Promise<ConversationShare | null> {
  let query = supabase
    .from('conversation_shares')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('org_id', orgId)
    .eq('is_active', true);

  query = sharedWithUserId ? query.eq('shared_with_user_id', sharedWithUserId) : query.is('shared_with_user_id', null);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[share-service] loadExistingConversationShare FAILED:', error.message, '| code:', error.code);
    return null;
  }
  return data?.[0] ? normalizeConversationShare(data[0]) : null;
}

export async function loadExistingFolderShare(
  folderId: string,
  orgId: string,
  sharedWithUserId: string | null,
): Promise<FolderShare | null> {
  let query = supabase
    .from('folder_shares')
    .select('*')
    .eq('folder_id', folderId)
    .eq('org_id', orgId)
    .eq('is_active', true);

  query = sharedWithUserId ? query.eq('shared_with_user_id', sharedWithUserId) : query.is('shared_with_user_id', null);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[share-service] loadExistingFolderShare FAILED:', error.message, '| code:', error.code);
    return null;
  }
  return data?.[0] ? normalizeFolderShare(data[0]) : null;
}
