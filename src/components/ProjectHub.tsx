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

interface ProjectHubProps {
  folder: Folder;
  chats: Conversation[];
  onOpenChat: (chatId: string) => void;
  onNewChat: () => void;
  onNewChatWithMessage?: (message: string) => void;
  onDeleteChat: (chatId: string, e: React.MouseEvent) => void;
  onRenameFolder: (newName: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const sourceTypeIcon = (type: string) => {
    if (type === 'drive') return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
      </svg>
    );
    if (type === 'outlook') return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    );
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    );
  };

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

  const handleSaveChatTitle = (chatId: string) => {
    if (onRenameChat) {
      const trimmed = editingChatTitle.trim();
      if (trimmed) {
        onRenameChat(chatId, trimmed);
      }
    }
    setRenamingChatId(null);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `${diffDays} mar`; 
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
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
            <h1
              className="text-3xl font-black text-primary dark:text-white cursor-pointer hover:text-accent transition-colors"
              onClick={() => setIsEditing(true)}
            >
              {folder.name}
            </h1>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em] mt-2 opacity-60">
            {chats.length} {chats.length === 1 ? 'conversacion' : 'conversaciones'}
          </p>
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
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
          <div className="w-full px-5 py-1 bg-gray-50/50 dark:bg-white/[0.03] backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl flex items-center gap-4 shadow-sm focus-within:border-accent/30 focus-within:ring-4 focus-within:ring-accent/5 transition-all duration-300">
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
               placeholder={`Mensaje en ${folder.name}...`}
               className="flex-1 bg-transparent text-[14px] font-medium tracking-tight text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none py-3"
             />
             <div className="flex items-center gap-2 text-gray-300 dark:text-gray-600">
                {chatInput.trim() ? (
                  <button
                    type="submit"
                    className="p-1.5 bg-accent rounded-lg text-white hover:bg-accent/80 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
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
                            <h3 className="text-[14px] font-bold text-primary dark:text-gray-100 truncate">
                              {chat.title}
                            </h3>
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
                          <button
                            onClick={(e) => onDeleteChat(chat.id, e)}
                            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-danger transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
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
                <div className="relative mb-6">
                  <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="w-full py-3.5 bg-accent/5 hover:bg-accent/10 text-accent text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2.5 border border-accent/10 hover:border-accent/20"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Agregar Fuente
                  </button>

                  {showAddMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-20">
                        <button
                          onClick={() => { setShowAddMenu(false); setShowDrivePicker(true); loadDriveFiles(); }}
                          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                        >
                          <div className="text-accent">{sourceTypeIcon('drive')}</div>
                          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Google Drive</span>
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-white/5" />
                        <button
                          onClick={() => { setShowAddMenu(false); fileInputRef.current?.click(); }}
                          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                        >
                          <div className="text-accent">{sourceTypeIcon('upload')}</div>
                          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Subir Archivo</span>
                        </button>
                      </div>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                </div>
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

              {/* Drive Picker Modal */}
              {showDrivePicker && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDrivePicker(false)}>
                  <div className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />

                    <div className="absolute top-4 right-4 z-20">
                      <button onClick={() => setShowDrivePicker(false)} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
                        <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="relative z-10 px-8 pt-10 pb-2">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                        <div>
                          <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Google Drive</h3>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60">Seleccionar archivo</p>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 px-8 pb-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={driveSearch}
                          onChange={e => setDriveSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') loadDriveFiles(driveSearch.trim() || undefined); }}
                          placeholder="Buscar en Drive..."
                          className="flex-1 px-4 py-2.5 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
                        />
                        <button onClick={() => loadDriveFiles(driveSearch.trim() || undefined)} className="px-4 py-2.5 bg-accent/10 text-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all">
                          Buscar
                        </button>
                      </div>
                    </div>

                    <div className="relative z-10 px-4 py-2 max-h-72 overflow-y-auto custom-scrollbar mb-6">
                      {driveLoading ? (
                        <div className="py-12 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                        </div>
                      ) : driveFiles.length === 0 ? (
                        <div className="py-12 text-center opacity-30">
                          <p className="text-[10px] font-black uppercase tracking-widest">Sin archivos</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {driveFiles.map(file => (
                            <button
                              key={file.id}
                              onClick={() => handleDriveSelect(file)}
                              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                            >
                              <div className="text-accent">{sourceTypeIcon('drive')}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">{file.name}</p>
                                <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase tracking-widest">{file.mimeType?.split('/').pop()}{file.size ? ` — ${formatFileSize(Number(file.size))}` : ''}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
