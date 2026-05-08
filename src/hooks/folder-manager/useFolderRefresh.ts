import { useEffect } from 'react';
import { loadFolders, type Folder } from '../../services/folder-service';

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

    const refreshFolders = () => {
      void loadFolders(userId, orgId, accessUserIds)
        .then((nextFolders) => {
          setFolders((prev) => (areFolderListsEqual(prev, nextFolders) ? prev : nextFolders));
          if (currentFolderId && !nextFolders.some((folder) => folder.id === currentFolderId)) {
            setCurrentFolderId(null);
          }
        })
        .catch((error) => {
          console.warn('[useFolderManager] refreshFolders FAILED:', error);
        });
    };

    const intervalId = window.setInterval(refreshFolders, 30000);
    window.addEventListener('focus', refreshFolders);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshFolders);
    };
  }, [accessUserIds, currentFolderId, orgId, setCurrentFolderId, setFolders, userId]);
}
