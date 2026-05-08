import type { Folder } from './types';
import { dedupeFolders, normalizeFolder } from './normalizers';

const FOLDERS_CACHE_PREFIX = 'lia_folders_';

function getFoldersCacheKey(userId: string): string {
  return `${FOLDERS_CACHE_PREFIX}${userId}`;
}

export function loadFoldersFromCache(userId: string): Folder[] {
  try {
    const cached = localStorage.getItem(getFoldersCacheKey(userId));
    return cached ? dedupeFolders(JSON.parse(cached)) : [];
  } catch {
    return [];
  }
}

export function saveFoldersToCache(userId: string, folders: Folder[]): void {
  try {
    localStorage.setItem(getFoldersCacheKey(userId), JSON.stringify(dedupeFolders(folders)));
  } catch {}
}

export function updateFoldersCache(userId: string, updater: (folders: Folder[]) => Folder[]): Folder[] {
  const nextFolders = dedupeFolders(updater(loadFoldersFromCache(userId)));
  saveFoldersToCache(userId, nextFolders);
  return nextFolders;
}

export function findFolderInCache(userId: string, folderId: string): Folder | null {
  return loadFoldersFromCache(userId).find((folder) => folder.id === folderId) || null;
}

export function migrateLegacyFolderCache(sourceUserId: string, targetUserId: string): void {
  if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) return;

  const sourceFolders = loadFoldersFromCache(sourceUserId).map((folder) =>
    normalizeFolder({
      ...folder,
      user_id: targetUserId,
      is_shared: false,
      share_permission: 'owner',
      can_edit: true,
      can_share: true,
    }),
  );
  if (sourceFolders.length === 0) return;

  saveFoldersToCache(targetUserId, [...loadFoldersFromCache(targetUserId), ...sourceFolders]);

  try {
    localStorage.removeItem(getFoldersCacheKey(sourceUserId));
  } catch {}
}
