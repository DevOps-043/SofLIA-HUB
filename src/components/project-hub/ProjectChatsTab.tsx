import type { MouseEvent } from 'react';
import type { Conversation } from '../../services/chat-service';
import { ProjectChatRow } from './ProjectChatRow';
import { ProjectEmptyState } from './ProjectEmptyState';

interface ProjectChatsTabProps {
  chats: Conversation[];
  editingChatTitle: string;
  renamingChatId: string | null;
  onDeleteChat: (chatId: string, event: MouseEvent) => void;
  onOpenChat: (chatId: string) => void;
  onSaveChatTitle: (chatId: string) => void;
  onSetEditingChatTitle: (title: string) => void;
  onSetRenamingChatId: (chatId: string | null) => void;
  onStartRenamingChat: (chatId: string, title: string) => void;
}

export function ProjectChatsTab(props: ProjectChatsTabProps) {
  if (props.chats.length === 0) {
    return <ProjectEmptyState type="chats" label="Sin conversaciones aun" />;
  }

  return (
    <div className="space-y-1">
      {props.chats.map((chat) => (
        <ProjectChatRow key={chat.id} chat={chat} {...props} />
      ))}
    </div>
  );
}
