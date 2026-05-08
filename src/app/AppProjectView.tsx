import { ProjectHub } from '../components/ProjectHub';
import type { MouseEvent } from 'react';
import type { ChatState, FolderState, ShareTarget } from './app-types';

interface AppProjectViewProps {
  chat: ChatState;
  currentFolder: FolderState['folders'][number];
  folder: FolderState;
  onDeleteConversation: (conversationId: string, event: MouseEvent) => Promise<void>;
  onNewChatInProject: (folderId: string) => Promise<void>;
  onNewChatWithMessage: (folderId: string, message: string) => Promise<void>;
  onSelectConversation: (conversationId: string) => Promise<void>;
  orgId: string;
  setShareTarget: (target: ShareTarget | null) => void;
  userId: string;
}

export function AppProjectView(props: AppProjectViewProps) {
  const { chat, currentFolder, folder, orgId, userId } = props;

  return (
    <ProjectHub
      folder={currentFolder}
      chats={chat.conversations.filter((conversation) => conversation.folder_id === currentFolder.id)}
      onOpenChat={props.onSelectConversation}
      onNewChat={() => props.onNewChatInProject(currentFolder.id)}
      onNewChatWithMessage={(message) => props.onNewChatWithMessage(currentFolder.id, message)}
      onDeleteChat={props.onDeleteConversation}
      onRenameFolder={(newName) => folder.handleRenameFolder(currentFolder.id, newName)}
      onRenameChat={chat.handleRenameChatFromHub}
      onShareFolder={currentFolder.can_share && orgId ? () => props.setShareTarget({ targetId: currentFolder.id, targetType: 'folder', targetName: currentFolder.name }) : undefined}
      userId={userId}
      orgId={orgId}
    />
  );
}
