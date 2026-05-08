import { useCallback, useEffect } from 'react';
import { resolveShareTargetByToken } from '../services/share-service';

type ShareLinkNotice = { tone: 'info' | 'error'; message: string };

interface ShareLinkRoutingArgs {
  chat: { loadInitialConversations: () => Promise<Array<{ id: string }>> };
  folder: { loadInitialFolders: () => Promise<Array<{ id: string }>> };
  handleOpenProject: (folderId: string) => void;
  handleSelectConversation: (conversationId: string) => Promise<void>;
  orgId: string;
  pendingShareLink: string | null;
  setPendingShareLink: (value: string | null) => void;
  setShareLinkNotice: (notice: ShareLinkNotice) => void;
  userId?: string;
}

export function useShareLinkRouting({
  chat,
  folder,
  handleOpenProject,
  handleSelectConversation,
  orgId,
  pendingShareLink,
  setPendingShareLink,
  setShareLinkNotice,
  userId,
}: ShareLinkRoutingArgs) {
  const handlePendingShareLink = useCallback(async (shareLink: string) => {
    if (!orgId) return;
    const sharedTarget = await resolveShareTargetByToken(shareLink, orgId);
    if (!sharedTarget) {
      setShareLinkNotice({ tone: 'error', message: 'No encontre un recurso compartido valido para ese enlace.' });
      return;
    }

    if (sharedTarget.targetType === 'conversation') {
      const conversations = await chat.loadInitialConversations();
      if (!conversations.some((conversation) => conversation.id === sharedTarget.targetId)) {
        setShareLinkNotice({ tone: 'error', message: 'Ese chat compartido todavia no esta disponible para esta cuenta u organizacion.' });
        return;
      }
      await handleSelectConversation(sharedTarget.targetId);
      setShareLinkNotice({
        tone: 'info',
        message: sharedTarget.permission === 'edit'
          ? 'Chat compartido abierto en modo colaborativo.'
          : 'Chat compartido abierto en modo solo lectura.',
      });
      return;
    }

    const folders = await folder.loadInitialFolders();
    if (!folders.some((item) => item.id === sharedTarget.targetId)) {
      setShareLinkNotice({ tone: 'error', message: 'La carpeta compartida no esta disponible para esta cuenta u organizacion.' });
      return;
    }
    handleOpenProject(sharedTarget.targetId);
    setShareLinkNotice({
      tone: 'info',
      message: sharedTarget.permission === 'edit'
        ? 'Carpeta compartida abierta en modo colaborativo.'
        : 'Carpeta compartida abierta en modo solo lectura.',
    });
  }, [chat, folder, handleOpenProject, handleSelectConversation, orgId, setShareLinkNotice]);

  useEffect(() => {
    if (!pendingShareLink || !userId || !orgId) return;
    void handlePendingShareLink(pendingShareLink)
      .catch((error) => {
        console.error('[App] Error abriendo shared link:', error);
        setShareLinkNotice({ tone: 'error', message: 'No pude abrir el recurso compartido desde el enlace.' });
      })
      .finally(() => setPendingShareLink(null));
  }, [handlePendingShareLink, orgId, pendingShareLink, setPendingShareLink, setShareLinkNotice, userId]);
}
