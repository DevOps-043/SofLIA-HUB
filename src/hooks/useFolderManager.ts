import { useState, useCallback } from 'react';
import {
  loadFolders,
  createFolder,
  renameFolder as renameFolderService,
  deleteFolder as deleteFolderService,
  moveChatToFolder as moveChatToFolderService,
  type Folder,
} from '../services/folder-service';
import type { Conversation } from '../services/chat-service';

interface UseFolderManagerOptions {
  userId: string | undefined;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
}

export function useFolderManager({ userId, setConversations }: UseFolderManagerOptions) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [movingChatId, setMovingChatId] = useState<string | null>(null);

  const loadInitialFolders = useCallback(async () => {
    if (!userId) return [];
    const flds = await loadFolders(userId);
    setFolders(flds);
    return flds;
  }, [userId]);

  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (!userId) return;
      const folder = await createFolder(userId, name);
      if (folder) {
        setFolders((prev) => [folder, ...prev]);
      }
    },
    [userId],
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, newName: string) => {
      const success = await renameFolderService(folderId, newName);
      if (success) {
        setFolders((prev) =>
          prev.map((f) =>
            f.id === folderId ? { ...f, name: newName } : f,
          ),
        );
      }
    },
    [],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      if (!userId) return;
      const success = await deleteFolderService(folderId);
      if (success) {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        setConversations((prev) =>
          prev.map((c) =>
            c.folder_id === folderId ? { ...c, folder_id: undefined } : c,
          ),
        );
      }
    },
    [userId, setConversations],
  );

  const handleMoveChat = useCallback(
    async (chatId: string, folderId: string | null) => {
      const success = await moveChatToFolderService(chatId, folderId);
      if (success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === chatId ? { ...c, folder_id: folderId || undefined } : c,
          ),
        );
      }
      setMovingChatId(null);
    },
    [setConversations],
  );

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  return {
    folders,
    setFolders,
    expandedFolders,
    currentFolderId,
    setCurrentFolderId,
    isFolderModalOpen,
    setIsFolderModalOpen,
    movingChatId,
    setMovingChatId,
    loadInitialFolders,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveChat,
    toggleFolder,
  };
}
