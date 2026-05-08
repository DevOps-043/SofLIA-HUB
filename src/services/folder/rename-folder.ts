import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { findFolderInCache, updateFoldersCache } from './cache';

export async function renameFolder(userId: string, folderId: string, name: string): Promise<boolean> {
  const trimmedName = name.trim();
  const folder = findFolderInCache(userId, folderId);

  if (!trimmedName || !folder?.can_share) return false;

  updateFoldersCache(userId, (folders) =>
    folders.map((item) =>
      item.id === folderId
        ? { ...item, name: trimmedName, updated_at: new Date().toISOString() }
        : item,
    ),
  );

  if (!isSupabaseConfigured()) return true;

  const { error } = await supabase.from('folders').update({ name: trimmedName }).eq('id', folderId);
  if (error) {
    console.error('[folder-service] renameFolder FAILED:', error.message, '| code:', error.code);
    return false;
  }

  return true;
}
