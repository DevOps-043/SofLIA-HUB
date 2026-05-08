import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { normalizeFolderShare } from './normalizers';
import type { FolderShare } from './types';

export async function loadFolderShares(folderId: string): Promise<FolderShare[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('folder_shares')
    .select('*')
    .eq('folder_id', folderId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadFolderShares FAILED:', error.message, '| code:', error.code);
    return [];
  }
  return (data || []).map((share: any) => normalizeFolderShare(share));
}

export async function loadOutgoingFolderShares(
  sharedByUserId: string,
  orgId?: string,
): Promise<FolderShare[]> {
  const normalizedUserId = sharedByUserId?.trim();
  if (!normalizedUserId || !isSupabaseConfigured()) return [];
  let query = supabase
    .from('folder_shares')
    .select('*')
    .eq('shared_by', normalizedUserId)
    .eq('is_active', true);

  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[share-service] loadOutgoingFolderShares FAILED:', error.message, '| code:', error.code);
    return [];
  }
  return (data || []).map((share: any) => normalizeFolderShare(share));
}
