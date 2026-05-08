import type { Folder } from '../../services/folder-service';

export interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export interface MoveChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  currentFolderId: string | null | undefined;
  onMove: (folderId: string | null) => void;
}
