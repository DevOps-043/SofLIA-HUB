import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatUI } from './adapters/desktop_ui/ChatUI';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { ScreenViewer } from './components/ScreenViewer';
import { ProjectHub } from './components/ProjectHub';
import { CreateFolderModal, MoveChatModal } from './components/FolderModals';
import {
  loadConversations,
  loadMessages,
  createConversation,
  saveMessages,
  deleteConversation,
  generateTitle,
  type Conversation,
  type ChatMessage,
} from './services/chat-service';
import {
  loadFolders,
  createFolder,
  renameFolder as renameFolderService,
  deleteFolder as deleteFolderService,
  moveChatToFolder as moveChatToFolderService,
  type Folder,
} from './services/folder-service';

type ActiveView = 'chat' | 'screen' | 'project';

function AppContent() {
  const { user, loading, signOut, sofiaContext } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('chat');

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [movingChatId, setMovingChatId] = useState<string | null>(null);

  // Debounce save ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentConvIdRef = useRef<string | null>(null);
  currentConvIdRef.current = currentConversationId;
  const currentFolderIdRef = useRef<string | null>(null);
  currentFolderIdRef.current = currentFolderId;

  const userId = user?.id;

  // ============================================
  // Cargar conversaciones y folders al inicio
  // ============================================
  useEffect(() => {
    if (!userId) return;

    const init = async () => {
      setLoadingConversations(true);
      const [convs, flds] = await Promise.all([
        loadConversations(userId),
        loadFolders(userId),
      ]);
      setConversations(convs);
      setFolders(flds);

      const lastChatId = localStorage.getItem('lia_current_chat_id');
      if (lastChatId) {
        const found = convs.find(c => c.id === lastChatId);
        if (found) {
          const msgs = await loadMessages(found.id);
          setCurrentConversationId(found.id);
          setCurrentMessages(msgs);
        }
      }
      setLoadingConversations(false);
    };

    init();
  }, [userId]);

  // ============================================
  // Auto-save con debounce
  // ============================================
  const autoSave = useCallback(async (messages: ChatMessage[]) => {
    if (!userId || messages.length === 0) return;

    const validMessages = messages.filter(m => m.text && m.text.trim().length > 0);
    if (validMessages.length === 0) return;

    let convId = currentConvIdRef.current;

    if (!convId) {
      const title = generateTitle(validMessages);
      const folderId = currentFolderIdRef.current;
      const newConv = await createConversation(userId, title, folderId || undefined);
      if (!newConv) return;

      convId = newConv.id;
      setCurrentConversationId(convId);
      currentConvIdRef.current = convId;
      localStorage.setItem('lia_current_chat_id', convId);

      setConversations(prev => [newConv, ...prev]);
    }

    await saveMessages(convId, userId, validMessages);

    setConversations(prev =>
      prev.map(c =>
        c.id === convId
          ? { ...c, updated_at: new Date().toISOString() }
          : c
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );
  }, [userId]);

  // ============================================
  // Handler de cambio de mensajes (desde ChatUI)
  // ============================================
  const handleMessagesChange = useCallback((messages: ChatMessage[]) => {
    setCurrentMessages(messages);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      autoSave(messages);
    }, 1000);
  }, [autoSave]);

  // ============================================
  // Nuevo chat
  // ============================================
  const handleNewChat = useCallback(() => {
    setCurrentConversationId(null);
    currentConvIdRef.current = null;
    setCurrentMessages([]);
    setActiveView('chat');
    setCurrentFolderId(null);
    currentFolderIdRef.current = null;
    localStorage.removeItem('lia_current_chat_id');
  }, []);

  // ============================================
  // Nuevo chat en proyecto
  // ============================================
  const handleNewChatInProject = useCallback((folderId: string) => {
    setCurrentConversationId(null);
    currentConvIdRef.current = null;
    setCurrentMessages([]);
    setCurrentFolderId(folderId);
    currentFolderIdRef.current = folderId;
    setActiveView('chat');
    localStorage.removeItem('lia_current_chat_id');
  }, []);

  // ============================================
  // Seleccionar conversacion
  // ============================================
  const handleSelectConversation = useCallback(async (convId: string) => {
    if (convId === currentConvIdRef.current && activeView === 'chat') {
      return;
    }

    const msgs = await loadMessages(convId);
    setCurrentConversationId(convId);
    currentConvIdRef.current = convId;
    setCurrentMessages(msgs);
    setActiveView('chat');
    localStorage.setItem('lia_current_chat_id', convId);
  }, [activeView]);

  // ============================================
  // Eliminar conversacion
  // ============================================
  const handleDeleteConversation = useCallback(async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await deleteConversation(convId);
    if (success) {
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (convId === currentConvIdRef.current) {
        setCurrentConversationId(null);
        currentConvIdRef.current = null;
        setCurrentMessages([]);
        localStorage.removeItem('lia_current_chat_id');
      }
    }
  }, []);

  // ============================================
  // Folder handlers
  // ============================================
  const handleCreateFolder = useCallback(async (name: string) => {
    if (!userId) return;
    const folder = await createFolder(userId, name);
    if (folder) {
      setFolders(prev => [folder, ...prev]);
    }
  }, [userId]);

  const handleRenameFolder = useCallback(async (folderId: string, newName: string) => {
    const success = await renameFolderService(folderId, newName);
    if (success) {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName } : f));
    }
  }, []);

  const handleDeleteFolder = useCallback(async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await deleteFolderService(folderId);
    if (success) {
      setFolders(prev => prev.filter(f => f.id !== folderId));
      setConversations(prev => prev.map(c =>
        c.folder_id === folderId ? { ...c, folder_id: undefined } : c
      ));
      if (currentFolderId === folderId) {
        setCurrentFolderId(null);
        setActiveView('chat');
      }
    }
  }, [currentFolderId]);

  const handleMoveChat = useCallback(async (folderId: string | null) => {
    if (!movingChatId) return;
    const success = await moveChatToFolderService(movingChatId, folderId);
    if (success) {
      setConversations(prev => prev.map(c =>
        c.id === movingChatId ? { ...c, folder_id: folderId || undefined } : c
      ));
    }
    setMovingChatId(null);
  }, [movingChatId]);

  const handleOpenProject = useCallback((folderId: string) => {
    setCurrentFolderId(folderId);
    setActiveView('project');
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // ============================================
  // Loading / Auth gates
  // ============================================
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background dark:bg-background-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <span className="text-xl font-bold text-accent">L</span>
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const displayName = sofiaContext?.user?.full_name
    || user.user_metadata?.first_name
    || user.email
    || 'Usuario';

  const initials = displayName.charAt(0).toUpperCase();
  const orgName = sofiaContext?.currentOrganization?.name;

  // Derived data
  const folderChats = (folderId: string) =>
    conversations.filter(c => c.folder_id === folderId);
  const ungroupedChats = conversations.filter(c => !c.folder_id);
  const currentFolder = folders.find(f => f.id === currentFolderId);
  const movingChat = movingChatId ? conversations.find(c => c.id === movingChatId) : null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background dark:bg-background-dark">

      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-sidebar text-white">

        {/* Brand */}
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-accent">Sof</span>
            <span className="text-white">LIA</span>
            <span className="text-gray-400 text-sm font-normal ml-1.5">Hub</span>
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="px-3 py-2 space-y-1">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/20 hover:bg-sidebar-hover transition-colors text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Chat
          </button>

          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-sidebar-hover hover:text-white transition-colors text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            Nueva Carpeta
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto no-scrollbar">
          {/* Ver Pantalla */}
          <button
            onClick={() => setActiveView('screen')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeView === 'screen'
                ? 'bg-sidebar-active text-white'
                : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Ver Pantalla
          </button>

          {/* Folders Section */}
          {folders.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <span className="text-[11px] text-gray-500 uppercase tracking-wider">Proyectos</span>
              </div>

              {folders.map(folder => {
                const chatsInFolder = folderChats(folder.id);
                const isExpanded = expandedFolders.has(folder.id);
                const isActive = activeView === 'project' && currentFolderId === folder.id;

                return (
                  <div key={folder.id}>
                    {/* Folder row */}
                    <div
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer group ${
                        isActive
                          ? 'bg-sidebar-active text-white'
                          : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
                      }`}
                      onClick={() => toggleFolder(folder.id)}
                      onDoubleClick={() => handleOpenProject(folder.id)}
                    >
                      {/* Chevron */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>

                      {/* Folder icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>

                      <span className="flex-1 text-left truncate text-[13px]">{folder.name}</span>

                      {/* Chat count */}
                      {chatsInFolder.length > 0 && (
                        <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          {chatsInFolder.length}
                        </span>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteFolder(folder.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                        title="Eliminar carpeta"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 hover:text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded chats */}
                    {isExpanded && (
                      <div className="ml-4 space-y-0.5">
                        {chatsInFolder.length === 0 ? (
                          <p className="px-3 py-1.5 text-[11px] text-gray-600 italic">Vacia</p>
                        ) : (
                          chatsInFolder.map(conv => (
                            <button
                              key={conv.id}
                              onClick={() => handleSelectConversation(conv.id)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-colors group/chat ${
                                currentConversationId === conv.id && activeView === 'chat'
                                  ? 'bg-sidebar-active text-white'
                                  : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-300'
                              }`}
                            >
                              <span className="flex-1 text-left truncate">{conv.title}</span>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/chat:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMovingChatId(conv.id); }}
                                  className="p-0.5 rounded hover:bg-white/10"
                                  title="Mover"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                                  className="p-0.5 rounded hover:bg-white/10"
                                  title="Eliminar"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 hover:text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Ungrouped Conversations */}
          <div className="pt-3 pb-1 px-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">
              {folders.length > 0 ? 'Sin carpeta' : 'Conversaciones'}
            </span>
          </div>

          {loadingConversations ? (
            <div className="px-3 py-4 text-center">
              <div className="flex gap-1 justify-center">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          ) : ungroupedChats.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-gray-500">Sin conversaciones aun</p>
            </div>
          ) : (
            ungroupedChats.map(conv => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group ${
                  currentConversationId === conv.id && activeView === 'chat'
                    ? 'bg-sidebar-active text-white'
                    : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="flex-1 text-left truncate text-[13px]">{conv.title}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMovingChatId(conv.id); }}
                    className="p-1 rounded hover:bg-white/10"
                    title="Mover a carpeta"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="p-1 rounded hover:bg-white/10"
                    title="Eliminar"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-500 hover:text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </button>
            ))
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-3 py-3 border-t border-white/10">
          {orgName && (
            <div className="px-3 py-1.5 mb-1">
              <span className="text-[11px] text-gray-500 uppercase tracking-wider">{orgName}</span>
            </div>
          )}
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <span className="flex-1 truncate">{displayName}</span>
            <button
              onClick={signOut}
              className="p-1.5 rounded-lg hover:bg-sidebar-hover transition-colors text-gray-500 hover:text-gray-300"
              title="Cerrar sesion"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen">
        {activeView === 'chat' && (
          <ChatUI
            messages={currentMessages}
            onMessagesChange={handleMessagesChange}
          />
        )}
        {activeView === 'screen' && <ScreenViewer />}
        {activeView === 'project' && currentFolder && (
          <ProjectHub
            folder={currentFolder}
            chats={folderChats(currentFolder.id)}
            onOpenChat={handleSelectConversation}
            onNewChat={() => handleNewChatInProject(currentFolder.id)}
            onDeleteChat={handleDeleteConversation}
            onRenameFolder={(newName) => handleRenameFolder(currentFolder.id, newName)}
          />
        )}
      </main>

      {/* Modals */}
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onCreate={handleCreateFolder}
      />
      <MoveChatModal
        isOpen={movingChatId !== null}
        onClose={() => setMovingChatId(null)}
        folders={folders}
        currentFolderId={movingChat?.folder_id}
        onMove={handleMoveChat}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
