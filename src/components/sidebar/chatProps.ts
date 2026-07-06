import type { MouseEvent } from 'react';
import type { Conversation } from '../../services/chat-service';
import type { SidebarProps } from './types';
import type { ChatItemProps } from './ChatItem';

export function buildChatItemProps(props: SidebarProps, conv: Conversation, compact?: boolean): ChatItemProps {
  return {
    conv,
    isActive: props.currentConversationId === conv.id && props.activeView === 'chat',
    isRenaming: props.renamingChatId === conv.id,
    editingTitle: props.editingChatTitle,
    isMenuOpen: props.activeMenuChatId === conv.id,
    compact,
    sidebarOpen: props.isOpen,
    onSelect: () => props.onSelectConversation(conv.id),
    onStartRename: () => {
      props.onSetRenamingChatId(conv.id);
      props.onSetEditingChatTitle(conv.title);
    },
    onEditTitle: props.onSetEditingChatTitle,
    onFinishRename: props.onRenameChat,
    onCancelRename: () => props.onSetRenamingChatId(null),
    onToggleMenu: () => props.onSetActiveMenuChatId(props.activeMenuChatId === conv.id ? null : conv.id),
    onMove: () => props.onSetMovingChatId(conv.id),
    onDelete: (e: MouseEvent) => props.onDeleteConversation(conv.id, e),
    canRename: Boolean(conv.can_edit),
    canMove: Boolean(conv.can_share),
    canDelete: Boolean(conv.can_share),
    isPinned: Boolean(conv.is_pinned),
    onTogglePin: () => props.onTogglePinConversation?.(conv.id, !conv.is_pinned),
  };
}

export function splitChatsByFolder(props: SidebarProps) {
  const visibleFolderIds = new Set(props.folders.map((folder) => folder.id));
  const getVisibleFolderId = (conversation: Conversation) =>
    conversation.folder_id && visibleFolderIds.has(conversation.folder_id)
      ? conversation.folder_id
      : undefined;

  const pinnedChats = props.conversations.filter((c) => c.is_pinned);
  const unpinned = props.conversations.filter((c) => !c.is_pinned);

  return {
    pinnedChats,
    folderChats: (folderId: string) => unpinned.filter((conversation) => getVisibleFolderId(conversation) === folderId),
    ungroupedChats: unpinned.filter((conversation) => !getVisibleFolderId(conversation)),
  };
}
