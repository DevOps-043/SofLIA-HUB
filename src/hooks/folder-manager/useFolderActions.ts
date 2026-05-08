import { useCallback } from 'react';
import type { Conversation } from '../../services/chat-service';
import {
  createFolder,
  deleteFolder as deleteFolderService,
  moveChatToFolder as moveChatToFolderService,
  renameFolder as renameFolderService,
  type Folder,
} from '../../services/folder-service';

interface FolderActionsConfig {
  userId: string | undefined;
  orgId?: string;
  folders: Folder[];
  conversations: Conversation[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setMovingChatId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useFolderActions(config: FolderActionsConfig) {
  const handleCreateFolder = useCallback(async (name: string) => {
    if (!config.userId) return;
    const folder = await createFolder(config.userId, name, config.orgId);
    if (folder) config.setFolders((prev) => [folder, ...prev]);
  }, [config]);

  const handleRenameFolder = useCallback(async (folderId: string, newName: string) => {
    const folder = config.folders.find((item) => item.id === folderId);
    if (!config.userId || !folder?.can_share) return;
    const success = await renameFolderService(config.userId, folderId, newName);
    if (success) {
      config.setFolders((prev) => prev.map((item) => item.id === folderId ? { ...item, name: newName } : item));
    }
  }, [config]);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    const folder = config.folders.find((item) => item.id === folderId);
    if (!config.userId || !folder?.can_share) return;
    const success = await deleteFolderService(config.userId, folderId);
    if (!success) return;

    config.setFolders((prev) => prev.filter((item) => item.id !== folderId));
    config.setConversations((prev) =>
      prev.map((conversation) => conversation.folder_id === folderId ? { ...conversation, folder_id: undefined } : conversation),
    );
  }, [config]);

  const handleMoveChat = useCallback(async (chatId: string, folderId: string | null) => {
    const conversation = config.conversations.find((item) => item.id === chatId);
    if (!config.userId || !conversation?.can_share || !canMoveToFolder(config.folders, folderId)) {
      config.setMovingChatId(null);
      return;
    }

    const success = await moveChatToFolderService(config.userId, chatId, folderId);
    if (success) {
      config.setConversations((prev) =>
        prev.map((conversationItem) => conversationItem.id === chatId ? { ...conversationItem, folder_id: folderId || undefined } : conversationItem),
      );
    }
    config.setMovingChatId(null);
  }, [config]);

  return { handleCreateFolder, handleRenameFolder, handleDeleteFolder, handleMoveChat };
}

function canMoveToFolder(folders: Folder[], folderId: string | null): boolean {
  if (!folderId) return true;
  return Boolean(folders.find((item) => item.id === folderId)?.can_edit);
}
