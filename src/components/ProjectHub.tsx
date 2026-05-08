import React, { useState, useRef, useEffect } from 'react';
import type { Folder } from '../services/folder-service';
import type { Conversation } from '../services/chat-service';
import { listDriveFiles } from '../services/drive-service';
import type { DriveFile } from '../services/drive-service';
import {
  type WorkspaceSource,
  getSourcesForFolder, addSourceFromDrive, addSourceFromUpload,
  removeSource, getDownloadUrl,
} from '../services/workspace-sources';
import { AddSourceMenu } from './project-hub/AddSourceMenu';
import { DrivePickerModal } from './project-hub/DrivePickerModal';
import { formatDate, formatFileSize, getInitials, sourceTypeIcon } from './project-hub/formatters';

interface ProjectHubProps {
  folder: Folder;
  chats: Conversation[];
  onOpenChat: (chatId: string) => void;
  onNewChat: () => void;
  onNewChatWithMessage?: (message: string) => void;
  onDeleteChat: (chatId: string, e: React.MouseEvent) => void;
  onRenameFolder: (newName: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onShareFolder?: () => void;
  userId?: string;
  orgId?: string;
}

export const ProjectHub: React.FC<ProjectHubProps> = ({
  folder,
  chats,
  onOpenChat,
  onNewChat,
  onNewChatWithMessage,
  onDeleteChat,
  onRenameFolder,
  onRenameChat,
  onShareFolder,
  userId,
  orgId,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'sources'>('chats');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState("");
  const [chatInput, setChatInput] = useState('');
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Sources state
  const [sources, setSources] = useState<WorkspaceSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEditFolder = folder.can_edit !== false;
  const canShareFolder = Boolean(folder.can_share);
  const folderSharedBadgeLabel = canShareFolder ? 'Compartida' : 'Recibida';

  useEffect(() => {
    setEditName(folder.name);
  }, [folder.name]);

  // Load sources when switching to sources tab
  useEffect(() => {
    if (activeTab === 'sources' && userId && orgId) {
      loadSourcesData();
    }
  }, [activeTab, folder.id]);

  const loadSourcesData = async () => {
    setLoadingSources(true);
    const data = await getSourcesForFolder(folder.id);
    setSources(data);
    setLoadingSources(false);
  };

  const loadDriveFiles = async (query?: string) => {
    setDriveLoading(true);
    const result = await listDriveFiles({ query, maxResults: 20 });
    if (result.success && result.files) setDriveFiles(result.files);
    setDriveLoading(false);
  };

  const handleDriveSelect = async (file: DriveFile) => {
    if (!userId || !orgId) return;
    setShowDrivePicker(false);
    const source = await addSourceFromDrive(folder.id, 'folder', file.id, userId, orgId);
    if (source) setSources(prev => [source, ...prev]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !orgId) return;
    const source = await addSourceFromUpload(folder.id, 'folder', file, userId, orgId);
    if (source) setSources(prev => [source, ...prev]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveSource = async (sourceId: string) => {
    const ok = await removeSource(sourceId);
    if (ok) setSources(prev => prev.filter(s => s.id !== sourceId));
  };

  const handleOpenSource = async (source: WorkspaceSource) => {
    const url = await getDownloadUrl(source);
    if (url) window.open(url, '_blank');
  };

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSaveName = () => {
    if (!canShareFolder) {
      setIsEditing(false);
      setEditName(folder.name);
      return;
    }
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) {
      onRenameFolder(trimmed);
    } else {
      setEditName(folder.name);
    }
    setIsEditing(false);
  };

  const handleSaveChatTitle = (chatId: string) => {
    const targetChat = chats.find((chat) => chat.id === chatId);
    if (!targetChat?.can_edit) {
      setRenamingChatId(null);
      return;
    }
    if (onRenameChat) {
      const trimmed = editingChatTitle.trim();
      if (trimmed) {
        onRenameChat(chatId, trimmed);
      }
    }
    setRenamingChatId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background dark:bg-background-dark overflow-y-auto custom-scrollbar">
      {/* Centered Content Wrapper */}
      <div className="w-full max-w-2xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center">
        
        {/* Project Icon Section */}
        <div className="relative group mb-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/5 flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/5 transition-transform duration-500 group-hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
        </div>

        {/* Project Title */}
        <div className="flex flex-col items-center mb-10 text-center">
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
              className="text-3xl font-black bg-transparent border-b-2 border-accent focus:outline-none text-primary dark:text-white text-center w-full max-w-md"
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h1
                  className={`text-3xl font-black text-primary dark:text-white transition-colors ${canShareFolder ? 'cursor-pointer hover:text-accent' : ''}`}
                  onClick={() => canShareFolder && setIsEditing(true)}
                >
                  {folder.name}
                </h1>
                {folder.is_shared && (
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                    canShareFolder
                      ? 'border-accent/20 bg-accent/10 text-accent'
                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 animate-pulse'
                  }`}>
                    {folderSharedBadgeLabel}
                  </span>
                )}
              </div>
              {folder.is_shared && (
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {canEditFolder ? 'Tienes permiso para colaborar en esta carpeta.' : 'Esta carpeta esta en solo lectura para ti.'}
                </p>
              )}
              {canShareFolder && onShareFolder && (
                <button
                  type="button"
                  onClick={onShareFolder}
                  className="inline-flex items-center gap-2 rounded-2xl border border-accent/15 bg-accent/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-accent transition-all hover:bg-accent/10"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                  Compartir carpeta
                </button>
              )}
            </div>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em] mt-2 opacity-60">
            {chats.length} {chats.length === 1 ? 'conversacion' : 'conversaciones'}
          </p>
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canEditFolder) return;
            const text = chatInput.trim();
            if (!text) return;
            setChatInput('');
            if (onNewChatWithMessage) {
              onNewChatWithMessage(text);
            } else {
              onNewChat();
            }
          }}
          className="w-full relative group mb-12"
        >
          <div className={`w-full px-5 py-1 backdrop-blur-md border rounded-2xl flex items-center gap-4 shadow-sm transition-all duration-300 ${canEditFolder ? 'bg-gray-50/50 dark:bg-white/[0.03] border-gray-200 dark:border-white/10 focus-within:border-accent/30 focus-within:ring-4 focus-within:ring-accent/5' : 'bg-gray-100/70 dark:bg-white/[0.02] border-gray-200/80 dark:border-white/5 opacity-70'}`}>
             <div className="text-gray-400 dark:text-gray-500">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
               </svg>
             </div>
             <input
               ref={chatInputRef}
               type="text"
               value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
               placeholder={canEditFolder ? `Mensaje en ${folder.name}...` : `Solo lectura en ${folder.name}`}
                className="flex-1 bg-transparent text-[14px] font-medium tracking-tight text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none py-3"
               disabled={!canEditFolder}
             />
             <div className="flex items-center gap-2 text-gray-300 dark:text-gray-600">
                {canEditFolder && chatInput.trim() ? (
                  <button
                    type="submit"
                    className="p-1.5 bg-accent rounded-lg text-white hover:bg-accent/80 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : !canEditFolder ? (
                  <div className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:bg-black/20 dark:text-gray-400">
                    Solo lectura
                  </div>
                ) : (
                  <>
                    <div className="p-1 hover:text-accent transition-colors cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <div className="p-1 hover:text-accent transition-colors cursor-pointer">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                  </>
                )}
             </div>
          </div>
        </form>

        {/* Navigation Tabs */}
        <div className="w-full flex items-center gap-6 border-b border-gray-100 dark:border-white/5 mb-6 px-2">
           <button 
             onClick={() => setActiveTab('chats')}
             className={`pb-3 text-[11px] font-black tracking-widest uppercase transition-all relative ${activeTab === 'chats' ? 'text-primary dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-500'}`}
           >
             Chats
             {activeTab === 'chats' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />}
           </button>
           <button 
             onClick={() => setActiveTab('sources')}
             className={`pb-3 text-[11px] font-black tracking-widest uppercase transition-all relative ${activeTab === 'sources' ? 'text-primary dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-500'}`}
           >
             Fuentes
             {activeTab === 'sources' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />}
           </button>
        </div>

        {/* Tab Content */}
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === 'chats' ? (
            chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-[10px] font-black uppercase tracking-widest">Sin conversaciones aun</p>
              </div>
            ) : (
              <div className="space-y-1">
                {chats.map(chat => (
                  <div 
                    key={chat.id}
                    onClick={() => onOpenChat(chat.id)}
                    className="group flex items-center justify-between p-3 hover:bg-primary/5 dark:hover:bg-white/[0.03] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/5"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                       <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-black uppercase ring-1 ring-accent/20">
                         {getInitials(chat.title)}
                       </div>
                       
                       <div className="flex-1 min-w-0">
                          {renamingChatId === chat.id ? (
                            <input
                              autoFocus
                              type="text"
                              className="w-full bg-white dark:bg-[#1E1E1E] border border-accent rounded px-2 py-0.5 text-sm font-medium text-gray-900 dark:text-white outline-none mb-1"
                              value={editingChatTitle}
                              onChange={(e) => setEditingChatTitle(e.target.value)}
                              onBlur={() => handleSaveChatTitle(chat.id)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") handleSaveChatTitle(chat.id);
                                else if (e.key === "Escape") setRenamingChatId(null);
                              }}
                            />
                          ) : (
                            <>
                              <h3 className="text-[14px] font-bold text-primary dark:text-gray-100 truncate">
                                {chat.title}
                              </h3>
                              {chat.is_shared && (
                                <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] ${
                                  chat.can_share
                                    ? 'border-accent/20 bg-accent/10 text-accent'
                                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 animate-pulse'
                                }`}>
                                  {chat.can_share ? 'Compartido' : 'Recibido'}
                                </div>
                              )}
                            </>
                          )}
                          <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate mt-0.5 italic">
                            Retomar conversación...
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center gap-6 ml-4 shrink-0">
                       <span className="text-[11px] text-gray-400 dark:text-gray-600 font-bold uppercase tracking-tighter">
                         {formatDate(chat.updated_at)}
                       </span>
                       
                       <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {chat.can_edit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingChatId(chat.id);
                                setEditingChatTitle(chat.title);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-accent transition-all"
                            >
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                          {chat.can_share && (
                            <button
                              onClick={(e) => onDeleteChat(chat.id, e)}
                              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-danger transition-all"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="w-full">
              {/* Add source button */}
              {userId && orgId && (
                <AddSourceMenu
                  fileInputRef={fileInputRef}
                  isOpen={showAddMenu}
                  onFileUpload={handleFileUpload}
                  onOpenDrivePicker={() => { setShowAddMenu(false); setShowDrivePicker(true); loadDriveFiles(); }}
                  onToggle={() => setShowAddMenu(!showAddMenu)}
                  onUploadClick={() => { setShowAddMenu(false); fileInputRef.current?.click(); }}
                />
              )}
              {/* Sources list */}
              {loadingSources ? (
                <div className="py-20 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                </div>
              ) : sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-[10px] font-black uppercase tracking-widest">Sin fuentes disponibles</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {sources.map(source => (
                    <div
                      key={source.id}
                      className="group flex items-center justify-between p-3 hover:bg-primary/5 dark:hover:bg-white/[0.03] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/5"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0" onClick={() => handleOpenSource(source)}>
                        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent ring-1 ring-accent/20">
                          {sourceTypeIcon(source.source_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[14px] font-bold text-primary dark:text-gray-100 truncate">
                            {source.file_name}
                          </h3>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
                            {source.source_type}{source.file_size ? ` — ${formatFileSize(source.file_size)}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveSource(source.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-danger transition-all ml-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <DrivePickerModal
                isOpen={showDrivePicker}
                driveFiles={driveFiles}
                driveLoading={driveLoading}
                driveSearch={driveSearch}
                onClose={() => setShowDrivePicker(false)}
                onDriveSearchChange={setDriveSearch}
                onSearch={() => loadDriveFiles(driveSearch.trim() || undefined)}
                onSelect={handleDriveSelect}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
