import { useEffect, useRef, useState } from 'react';
import type { Conversation } from '../../services/chat-service';
import type { Folder } from '../../services/folder-service';

interface UseProjectEditingOptions {
  folder: Folder;
  chats: Conversation[];
  canShareFolder: boolean;
  onRenameFolder: (newName: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
}

export function useProjectEditing(options: UseProjectEditingOptions) {
  const { folder, chats, canShareFolder, onRenameFolder, onRenameChat } = options;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setEditName(folder.name), [folder.name]);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  function saveFolderName(): void {
    if (!canShareFolder) {
      setIsEditing(false);
      setEditName(folder.name);
      return;
    }

    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) onRenameFolder(trimmed);
    else setEditName(folder.name);
    setIsEditing(false);
  }

  function saveChatTitle(chatId: string): void {
    const targetChat = chats.find((chat) => chat.id === chatId);
    if (!targetChat?.can_edit) {
      setRenamingChatId(null);
      return;
    }

    const trimmed = editingChatTitle.trim();
    if (onRenameChat && trimmed) onRenameChat(chatId, trimmed);
    setRenamingChatId(null);
  }

  function startRenamingChat(chatId: string, title: string): void {
    setRenamingChatId(chatId);
    setEditingChatTitle(title);
  }

  return {
    editName, editingChatTitle, inputRef, isEditing, renamingChatId,
    saveChatTitle, saveFolderName, setEditName, setEditingChatTitle,
    setIsEditing, setRenamingChatId, startRenamingChat,
  };
}
