import { useCallback, useState } from 'react';
import {
  loadFolders,
  type Folder,
} from '../services/folder-service';
import type { Conversation } from '../services/chat-service';
import { useFolderActions } from './folder-manager/useFolderActions';
import { useFolderRefresh } from './folder-manager/useFolderRefresh';

interface UseFolderManagerOptions {
  userId: string | undefined;
  orgId?: string;
  accessUserIds?: string[];
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
}

export function useFolderManager({ userId, orgId, accessUserIds, conversations, setConversations }: UseFolderManagerOptions) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [movingChatId, setMovingChatId] = useState<string | null>(null);

  const loadInitialFolders = useCallback(async () => {
    if (!userId) return [];
    const nextFolders = await loadFolders(userId, orgId, accessUserIds);
    setFolders(nextFolders);
    return nextFolders;
  }, [accessUserIds, orgId, userId]);

  useFolderRefresh({ userId, orgId, accessUserIds, currentFolderId, setFolders, setCurrentFolderId });

  const actions = useFolderActions({
    userId,
    orgId,
    folders,
    conversations,
    setFolders,
    setConversations,
    setMovingChatId,
  });

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
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
    ...actions,
    toggleFolder,
  };
}
