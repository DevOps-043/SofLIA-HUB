import { isSupabaseConfigured } from '../../lib/supabase';
import type { Folder } from './types';
import { loadFoldersFromCache, saveFoldersToCache } from './cache';
import { fetchAccessibleFolders } from './remote';

export async function loadFolders(
  userId: string,
  orgId?: string,
  accessUserIds?: string[],
): Promise<Folder[]> {
  if (!userId) return [];
  if (!isSupabaseConfigured()) {
    return loadFoldersFromCache(userId);
  }

  try {
    const folders = await fetchAccessibleFolders(
      userId,
      accessUserIds && accessUserIds.length > 0 ? accessUserIds : [userId],
      orgId,
    );
    saveFoldersToCache(userId, folders);
    return folders;
  } catch {
    return loadFoldersFromCache(userId);
  }
}
