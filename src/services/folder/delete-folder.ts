import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { findFolderInCache, updateFoldersCache } from './cache';

async function deleteRelatedRows(table: string, folderId: string, action: () => Promise<{ error: any } | any>): Promise<boolean> {
  const { error } = await action();
  if (!error) return true;

  if (error.code === '42P01') {
    console.warn(`[folder-service] ${table} table is missing while deleting folder ${folderId}; continuing.`);
    return true;
  }

  console.error(`[folder-service] deleteFolder ${table} FAILED:`, error.message, '| code:', error.code);
  return false;
}

export async function deleteFolder(userId: string, folderId: string): Promise<boolean> {
  const folder = findFolderInCache(userId, folderId);
  if (!folder?.can_share) return false;

  updateFoldersCache(userId, (folders) => folders.filter((item) => item.id !== folderId));

  if (!isSupabaseConfigured()) return true;

  const dependenciesDeleted = await Promise.all([
    deleteRelatedRows('conversations', folderId, () =>
      Promise.resolve(supabase.from('conversations').update({ folder_id: null }).eq('folder_id', folderId)),
    ),
    deleteRelatedRows('folder_shares', folderId, () =>
      Promise.resolve(supabase.from('folder_shares').delete().eq('folder_id', folderId)),
    ),
    deleteRelatedRows('workspace_sources', folderId, () =>
      Promise.resolve(supabase.from('workspace_sources').delete().eq('folder_id', folderId)),
    ),
  ]);

  if (dependenciesDeleted.some((result) => !result)) return false;

  const { error } = await supabase.from('folders').delete().eq('id', folderId);
  if (error) {
    console.error('[folder-service] deleteFolder FAILED:', error.message, '| code:', error.code);
    return false;
  }

  return true;
}
