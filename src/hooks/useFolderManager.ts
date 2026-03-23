import { useState, useCallback, useEffect } from 'react';
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
  orgId?: string;
  accessUserIds?: string[];
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
}

function areFolderListsEqual(left: Folder[], right: Folder[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((folder, index) => {
    const other = right[index];
    return (
      folder.id === other?.id &&
      folder.name === other?.name &&
      folder.updated_at === other?.updated_at &&
      folder.is_shared === other?.is_shared &&
      folder.share_permission === other?.share_permission &&
      folder.can_edit === other?.can_edit &&
      folder.can_share === other?.can_share
    );
  });
}

export function useFolderManager({ userId, orgId, accessUserIds, conversations, setConversations }: UseFolderManagerOptions) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [movingChatId, setMovingChatId] = useState<string | null>(null);

  const loadInitialFolders = useCallback(async () => {
    if (!userId) return [];
    const flds = await loadFolders(userId, orgId, accessUserIds);
    setFolders(flds);
    return flds;
  }, [accessUserIds, orgId, userId]);

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
    const handleFocus = () => refreshFolders();

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [accessUserIds, currentFolderId, orgId, userId]);

  const handleCreateFolder = useCallback(
      async (name: string) => {
        if (!userId) return;
      const folder = await createFolder(userId, name, orgId);
      if (folder) {
        setFolders((prev) => [folder, ...prev]);
      }
    },
    [orgId, userId],
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, newName: string) => {
      const folder = folders.find((item) => item.id === folderId);
      if (!userId || !folder?.can_share) return;
      const success = await renameFolderService(userId, folderId, newName);
      if (success) {
        setFolders((prev) =>
          prev.map((f) =>
            f.id === folderId ? { ...f, name: newName } : f,
          ),
        );
      }
    },
    [folders, userId],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      if (!userId) return;
      const folder = folders.find((item) => item.id === folderId);
      if (!folder?.can_share) return;
      const success = await deleteFolderService(userId, folderId);
      if (success) {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        setConversations((prev) =>
          prev.map((c) =>
            c.folder_id === folderId ? { ...c, folder_id: undefined } : c,
          ),
        );
      }
    },
    [folders, setConversations, userId],
  );

  const handleMoveChat = useCallback(
    async (chatId: string, folderId: string | null) => {
      const conversation = conversations.find((item) => item.id === chatId);
      if (!userId || !conversation?.can_share) {
        setMovingChatId(null);
        return;
      }
      if (folderId) {
        const targetFolder = folders.find((item) => item.id === folderId);
        if (!targetFolder?.can_edit) {
          setMovingChatId(null);
          return;
        }
      }
      const success = await moveChatToFolderService(userId, chatId, folderId);
      if (success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === chatId ? { ...c, folder_id: folderId || undefined } : c,
          ),
        );
      }
      setMovingChatId(null);
    },
    [conversations, folders, setConversations, userId],
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
