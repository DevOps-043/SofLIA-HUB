import React, { useState, useRef, useEffect } from 'react';
import type { Folder } from '../services/folder-service';
import type { Conversation } from '../services/chat-service';

interface ProjectHubProps {
  folder: Folder;
  chats: Conversation[];
  onOpenChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string, e: React.MouseEvent) => void;
  onRenameFolder: (newName: string) => void;
}

export const ProjectHub: React.FC<ProjectHubProps> = ({
  folder,
  chats,
  onOpenChat,
  onNewChat,
  onDeleteChat,
  onRenameFolder,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditName(folder.name);
  }, [folder.name]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) {
      onRenameFolder(trimmed);
    } else {
      setEditName(folder.name);
    }
    setIsEditing(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} dias`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background dark:bg-background-dark overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>

          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') { setEditName(folder.name); setIsEditing(false); }
              }}
              className="text-2xl font-bold bg-transparent border-b-2 border-accent focus:outline-none text-primary dark:text-white"
            />
          ) : (
            <h1
              className="text-2xl font-bold text-primary dark:text-white cursor-pointer hover:text-accent transition-colors"
              onClick={() => setIsEditing(true)}
              title="Click para renombrar"
            >
              {folder.name}
            </h1>
          )}
        </div>

        <p className="text-sm text-secondary ml-[52px]">
          {chats.length} {chats.length === 1 ? 'conversacion' : 'conversaciones'}
          {folder.created_at && ` · Creado ${formatDate(folder.created_at)}`}
        </p>
      </div>

      {/* New Chat Button */}
      <div className="px-8 pb-6">
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo chat en proyecto
        </button>
      </div>

      {/* Chats Grid */}
      {chats.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p className="text-secondary text-sm">No hay conversaciones en este proyecto</p>
          <p className="text-gray-400 text-xs mt-1">Crea un nuevo chat para comenzar</p>
        </div>
      ) : (
        <div className="px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => onOpenChat(chat.id)}
              className="group bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 rounded-xl p-4 cursor-pointer hover:border-accent/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-primary dark:text-white truncate">
                    {chat.title}
                  </h3>
                  <p className="text-xs text-secondary mt-1">
                    {formatDate(chat.updated_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => onDeleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-all flex-shrink-0"
                  title="Eliminar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400 hover:text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Chat icon */}
              <div className="mt-3 flex items-center gap-1.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="text-[11px]">Conversacion</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
