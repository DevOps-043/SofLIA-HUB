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
  /** Carpeta en edicion inline desde la barra lateral (null = ninguna). */
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

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

  /** Abre la edicion inline. Solo el dueño puede renombrar (can_share). */
  const startFolderRename = useCallback((folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder?.can_share) return;
    setRenamingFolderId(folderId);
    setEditingFolderName(folder.name);
  }, [folders]);

  const cancelFolderRename = useCallback(() => {
    setRenamingFolderId(null);
    setEditingFolderName('');
  }, []);

  /**
   * Confirma la edicion. Un nombre vacio o sin cambios solo cierra el input:
   * el usuario que pulsa Enter sin escribir no espera perder el nombre.
   */
  const commitFolderRename = useCallback(async () => {
    const folderId = renamingFolderId;
    const nextName = editingFolderName.trim();
    setRenamingFolderId(null);
    setEditingFolderName('');
    if (!folderId || !nextName) return;
    const folder = folders.find((item) => item.id === folderId);
    if (!folder || folder.name === nextName) return;
    await actions.handleRenameFolder(folderId, nextName);
  }, [actions, editingFolderName, folders, renamingFolderId]);

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
    renamingFolderId,
    editingFolderName,
    setEditingFolderName,
    startFolderRename,
    cancelFolderRename,
    commitFolderRename,
    loadInitialFolders,
    ...actions,
    toggleFolder,
  };
}
