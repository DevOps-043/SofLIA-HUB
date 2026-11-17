import { useEffect } from 'react';
import { loadFolders, type Folder } from '../../services/folder-service';
import { createVisibleRefresh } from '../../services/visible-refresh';

interface FolderRefreshConfig {
  userId: string | undefined;
  orgId?: string;
  accessUserIds?: string[];
  currentFolderId: string | null;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  setCurrentFolderId: React.Dispatch<React.SetStateAction<string | null>>;
}

import { areFolderListsEqual } from './folder-list';

export function useFolderRefresh({
  userId,
  orgId,
  accessUserIds,
  currentFolderId,
  setFolders,
  setCurrentFolderId,
}: FolderRefreshConfig) {
  useEffect(() => {
    if (!userId) return;

    let disposed = false;
    const refresh = createVisibleRefresh(async () => {
      const nextFolders = await loadFolders(userId, orgId, accessUserIds);
      if (!disposed) {
        setFolders((prev) => (areFolderListsEqual(prev, nextFolders) ? prev : nextFolders));
        if (currentFolderId && !nextFolders.some((folder) => folder.id === currentFolderId)) {
          setCurrentFolderId(null);
        }
      }
    }, 30000, error => console.warn('[Carpetas] No se pudieron actualizar las carpetas:', error));

    return () => {
      disposed = true;
      refresh.dispose();
    };
  }, [accessUserIds, currentFolderId, orgId, setCurrentFolderId, setFolders, userId]);
}
