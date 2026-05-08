import type { MouseEvent } from 'react';
import type { Conversation } from '../../services/chat-service';
import type { Folder } from '../../services/folder-service';

export type ProjectHubTab = 'chats' | 'sources';

export interface ProjectHubProps {
  folder: Folder;
  chats: Conversation[];
  onOpenChat: (chatId: string) => void;
  onNewChat: () => void;
  onNewChatWithMessage?: (message: string) => void;
  onDeleteChat: (chatId: string, event: MouseEvent) => void;
  onRenameFolder: (newName: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onShareFolder?: () => void;
  userId?: string;
  orgId?: string;
}
