import { useState, useEffect, useCallback, useRef } from "react";
import { ChatUI } from "./adapters/desktop_ui/ChatUI";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Auth } from "./components/Auth";
import { ScreenViewer } from "./components/ScreenViewer";
import { ProjectHub } from "./components/ProjectHub";
import { CreateFolderModal, MoveChatModal } from "./components/FolderModals";
import { SettingsModal } from "./components/SettingsModal";
import {
  loadSettings,
  getCachedSettings,
  type UserAISettings,
} from "./services/settings-service";
import { FlowMode } from "./components/FlowMode";
import { WhatsAppSetup } from "./components/WhatsAppSetup";
import { UserManagementModal } from "./components/UserManagementModal";
import { ProductivityDashboard } from "./components/ProductivityDashboard";
import AutoDevPanel from "./components/AutoDevPanel";
import { GOOGLE_API_KEY } from "./config";
import {
  getTeams,
  getProjects,
  getIssues,
  PROJECT_STATUS_COLORS,
  ISSUE_STATUS_TYPE_COLORS,
} from "./services/iris-data";
import {
  isIrisConfigured,
  type IrisTeam,
  type IrisProject,
  type IrisIssue,
} from "./lib/iris-client";
import {
  loadConversations,
  loadMessages,
  createConversation,
  saveMessages,
  deleteConversation,
  generateTitle,
  updateConversationTitle,
  type Conversation,
  type ChatMessage,
} from "./services/chat-service";
import {
  loadFolders,
  createFolder,
  renameFolder as renameFolderService,
  deleteFolder as deleteFolderService,
  moveChatToFolder as moveChatToFolderService,
  type Folder,
} from "./services/folder-service";

type ActiveView = "chat" | "screen" | "project" | "productivity";

function AppContent() {
  const { user, loading, signOut, sofiaContext } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [movingChatId, setMovingChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isAutoDevOpen, setIsAutoDevOpen] = useState(false);
  const [userSettings, setUserSettings] = useState<UserAISettings | null>(null);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [_isFlowActive, _setIsFlowActive] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  // Detect if this is a specialized Flow window
  const isFlowWindow =
    window.location.href.includes("view=flow") ||
    (window.process as any)?.argv?.includes("--view-mode=flow");

  // IRIS Project Hub state
  const [irisTeams, setIrisTeams] = useState<IrisTeam[]>([]);
  const [irisProjects, setIrisProjects] = useState<IrisProject[]>([]);
  const [irisIssues, setIrisIssues] = useState<Record<string, IrisIssue[]>>({});
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  );

  // Theme effect
  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;

    // Function to apply theme
    const applyTheme = (themeValue: "system" | "light" | "dark") => {
      // Remove both classes first to ensure clean state
      root.classList.remove("light", "dark");

      if (themeValue === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(themeValue);
      }

      // Force repaint/restyle if needed (usually not required but safe)
      // console.log(`Theme set to: ${themeValue}`);
    };

    // Apply initially
    applyTheme(theme);

    // Listen for system changes if theme is system
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [theme]);

  // Electron IPC Integration
  useEffect(() => {
    const ipc = (window as any).ipcRenderer;
    if (ipc) {
      // Receive results from standalone Flow window
      ipc.on("flow-message-received", (_event: any, text: string) => {
        handleFlowSendToChat(text);
      });

      // Special handling for the Flow overlay window itself
      if (isFlowWindow) {
        ipc.on("flow-window-shown", () => {
          setFlowKey((prev) => prev + 1); // Force re-mount to trigger auto-start
        });
      }
    }

    return () => {
      if (ipc && ipc.off) {
        ipc.off("flow-message-received", () => {});
        ipc.off("flow-window-shown", () => {});
      }
    };
  }, [isFlowWindow]);

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
      // Load cached settings immediately
      const cached = getCachedSettings();
      if (cached && cached.user_id === userId) setUserSettings(cached);

      const [convs, flds, settings] = await Promise.all([
        loadConversations(userId),
        loadFolders(userId),
        loadSettings(userId),
      ]);
      setUserSettings(settings);
      setConversations(convs);
      setFolders(flds);

      const lastChatId = localStorage.getItem("lia_current_chat_id");
      if (lastChatId) {
        const found = convs.find((c) => c.id === lastChatId);
        if (found) {
          const msgs = await loadMessages(found.id);
          setCurrentConversationId(found.id);
          setCurrentMessages(msgs);
        }
      }
      setLoadingConversations(false);

      // Load IRIS data if configured
      if (isIrisConfigured()) {
        try {
          const teams = await getTeams();
          setIrisTeams(teams);
          const projects = await getProjects();
          setIrisProjects(projects);
        } catch (err) {
          console.error("IRIS: Error loading data", err);
        }
      }
    };

    init();
  }, [userId]);

  // ============================================
  // Auto-save con debounce
  // ============================================
  const autoSave = useCallback(
    async (messages: ChatMessage[]) => {
      if (!userId || messages.length === 0) return;

      const validMessages = messages.filter(
        (m) => m.text && m.text.trim().length > 0,
      );
      if (validMessages.length === 0) return;

      let convId = currentConvIdRef.current;

      if (!convId) {
        const title = generateTitle(validMessages);
        const folderId = currentFolderIdRef.current;
        const newConv = await createConversation(
          userId,
          title,
          folderId || undefined,
        );
        if (!newConv) return;

        convId = newConv.id;
        setCurrentConversationId(convId);
        currentConvIdRef.current = convId;
        localStorage.setItem("lia_current_chat_id", convId);

        setConversations((prev) => [newConv, ...prev]);
      }

      await saveMessages(convId, userId, validMessages);

      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === convId
              ? { ...c, updated_at: new Date().toISOString() }
              : c,
          )
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          ),
      );
    },
    [userId],
  );

  // ============================================
  // Handler de cambio de mensajes (desde ChatUI)
  // ============================================
  const handleMessagesChange = useCallback(
    (messages: ChatMessage[]) => {
      setCurrentMessages(messages);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        autoSave(messages);
      }, 1000);
    },
    [autoSave],
  );

  // ============================================
  // Nuevo chat
  // ============================================
  const handleNewChat = useCallback(() => {
    setCurrentConversationId(null);
    currentConvIdRef.current = null;
    setCurrentMessages([]);
    setActiveView("chat");
    setCurrentFolderId(null);
    currentFolderIdRef.current = null;
    localStorage.removeItem("lia_current_chat_id");
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
    setActiveView("chat");
    localStorage.removeItem("lia_current_chat_id");
  }, []);

  // ============================================
  // Seleccionar conversacion
  // ============================================
  const handleSelectConversation = useCallback(
    async (convId: string) => {
      if (convId === currentConvIdRef.current && activeView === "chat") {
        return;
      }

      const msgs = await loadMessages(convId);
      setCurrentConversationId(convId);
      currentConvIdRef.current = convId;
      setCurrentMessages(msgs);
      setActiveView("chat");
      localStorage.setItem("lia_current_chat_id", convId);
    },
    [activeView],
  );

  // ============================================
  // Eliminar conversacion
  // ============================================
  const handleDeleteConversation = useCallback(
    async (convId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const success = await deleteConversation(convId);
      if (success) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (convId === currentConvIdRef.current) {
          setCurrentConversationId(null);
          currentConvIdRef.current = null;
          setCurrentMessages([]);
          localStorage.removeItem("lia_current_chat_id");
        }
      }
    },
    [],
  );

  // ============================================
  // Folder handlers
  // ============================================
  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (!userId) return;
      const folder = await createFolder(userId, name);
      if (folder) {
        setFolders((prev) => [folder, ...prev]);
      }
    },
    [userId],
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, newName: string) => {
      const success = await renameFolderService(folderId, newName);
      if (success) {
        setFolders((prev) =>
          prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f)),
        );
      }
    },
    [],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const success = await deleteFolderService(folderId);
      if (success) {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        setConversations((prev) =>
          prev.map((c) =>
            c.folder_id === folderId ? { ...c, folder_id: undefined } : c,
          ),
        );
        if (currentFolderId === folderId) {
          setCurrentFolderId(null);
          setActiveView("chat");
        }
      }
    },
    [currentFolderId],
  );

  const handleMoveChat = useCallback(
    async (folderId: string | null) => {
      if (!movingChatId) return;
      const success = await moveChatToFolderService(movingChatId, folderId);
      if (success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === movingChatId
              ? { ...c, folder_id: folderId || undefined }
              : c,
          ),
        );
      }
      setMovingChatId(null);
    },
    [movingChatId],
  );

  const handleRenameChatFromHub = useCallback(async (chatId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      await updateConversationTitle(chatId, trimmed);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, title: trimmed } : c
        )
      );
    }
  }, []);

  const handleRenameChat = useCallback(async () => {
    if (!renamingChatId) return;
    const newTitle = editingChatTitle.trim();
    if (newTitle) {
      await updateConversationTitle(renamingChatId, newTitle);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === renamingChatId ? { ...c, title: newTitle } : c,
        ),
      );
    }
    setRenamingChatId(null);
  }, [renamingChatId, editingChatTitle]);

  const handleOpenProject = useCallback((folderId: string) => {
    setCurrentFolderId(folderId);
    setActiveView("project");
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
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
  // IRIS toggle handlers
  // ============================================
  const toggleTeam = useCallback((teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }, []);

  const toggleProject = useCallback(
    async (projectId: string) => {
      setExpandedProjects((prev) => {
        const next = new Set(prev);
        if (next.has(projectId)) {
          next.delete(projectId);
        } else {
          next.add(projectId);
        }
        return next;
      });

      // Load issues for this project if not cached
      if (!irisIssues[projectId]) {
        const issues = await getIssues({ projectId, limit: 20 });
        setIrisIssues((prev) => ({ ...prev, [projectId]: issues }));
      }
    },
    [irisIssues],
  );

  const refreshIrisData = useCallback(async () => {
    if (!isIrisConfigured()) return;
    try {
      setIrisTeams([]);
      setIrisProjects([]);
      setIrisIssues({});
      setExpandedTeams(new Set());
      setExpandedProjects(new Set());

      const [teams, projects] = await Promise.all([getTeams(), getProjects()]);
      setIrisTeams(teams);
      setIrisProjects(projects);
    } catch (err) {
      console.error("IRIS: Error refreshing data", err);
    }
  }, []);

  const handleIrisProjectClick = useCallback(
    (project: IrisProject) => {
      handleNewChat();
      const prompt = `Dame un resumen del estado del proyecto "${project.project_name}" [${project.project_key}]. Estado: ${project.project_status}, Progreso: ${project.completion_percentage}%.`;
      setExternalPrompt(prompt);
    },
    [handleNewChat],
  );

  const handleIrisIssueClick = useCallback(
    (issue: IrisIssue) => {
      handleNewChat();
      const statusName = issue.status?.name || "Sin estado";
      const prompt = `Dame detalles sobre la tarea #${issue.issue_number}: "${issue.title}". Estado: ${statusName}.${issue.description ? ` Descripción: ${issue.description}` : ""}`;
      setExternalPrompt(prompt);
    },
    [handleNewChat],
  );

  // ============================================
  // Loading / Auth gates
  // ============================================
  if (loading) {
    return (
      <div
        className={`flex h-screen w-screen items-center justify-center ${isFlowWindow ? "bg-transparent" : "bg-background dark:bg-background-dark"}`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 flex items-center justify-center">
            <img
              src="/assets/Icono.png"
              alt="Loading"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex gap-1">
            <div
              className="w-2 h-2 rounded-full bg-accent animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-2 h-2 rounded-full bg-accent animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-2 h-2 rounded-full bg-accent animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!user && !isFlowWindow) {
    return <Auth />;
  }

  const displayName =
    sofiaContext?.user?.full_name ||
    user?.user_metadata?.first_name ||
    user?.email ||
    "Usuario";

  const initials = displayName.charAt(0).toUpperCase();

  // Derived data
  const folderChats = (folderId: string) =>
    conversations.filter((c) => c.folder_id === folderId);
  const ungroupedChats = conversations.filter((c) => !c.folder_id);
  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const movingChat = movingChatId
    ? conversations.find((c) => c.id === movingChatId)
    : null;

  const handleFlowSendToChat = async (text: string) => {
    setExternalPrompt(text);
  };

  if (isFlowWindow) {
    return (
      <div className="h-screen w-screen bg-transparent flex items-end justify-center pb-0 overflow-hidden border-none shadow-none">
        <FlowMode
          key={flowKey}
          isActive={true}
          onClose={() => (window as any).ipcRenderer.send("close-flow")}
          onSendToChat={(text) => {
            (window as any).ipcRenderer.send("flow-send-to-chat", text);
            (window as any).ipcRenderer.send("close-flow");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background dark:bg-background-dark">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? "w-60" : "w-14"
        } flex-shrink-0 flex flex-col bg-gray-50 dark:bg-[#202123] text-gray-700 dark:text-white border-r border-gray-200 dark:border-none transition-all duration-300 ease-in-out`}
      >
        {/* Brand */}
        <div
          className={`px-4 pt-4 pb-2 flex items-center ${isSidebarOpen ? "justify-between" : "justify-center"} min-h-[50px]`}
        >
          {isSidebarOpen && (
            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
              <img
                src="/assets/Icono.png"
                alt="SofLIA"
                className="w-7 h-7 object-contain"
              />
            </div>
          )}

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
            title={isSidebarOpen ? "Colapsar menú" : "Expandir menú"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
            </svg>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="px-2 py-2 space-y-1">
          <button
            onClick={handleNewChat}
            className={`w-full flex items-center ${isSidebarOpen ? "gap-3 px-3" : "justify-center px-0"} py-2 rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#2A2B32] transition-colors text-sm shadow-sm dark:shadow-none`}
            title="Nuevo Chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            {isSidebarOpen && <span>Nuevo Chat</span>}
          </button>

          <button
            onClick={() => setIsFolderModalOpen(true)}
            className={`w-full flex items-center ${isSidebarOpen ? "gap-3 px-3" : "justify-center px-0"} py-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2A2B32] hover:text-gray-900 dark:hover:text-white transition-colors text-sm`}
            title="Nueva Carpeta"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
            {isSidebarOpen && <span>Nueva Carpeta</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto no-scrollbar">
          {/* IRIS Projects Section */}
          {(irisTeams.length > 0 || irisProjects.length > 0) && (
            <>
              {isSidebarOpen && (
                <div className="pt-4 pb-2 px-3 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">
                    WorkSpaces
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshIrisData();
                    }}
                    className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-accent transition-all"
                    title="Actualizar workspaces"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {irisTeams.map((team) => {
                const isTeamExpanded = expandedTeams.has(team.team_id);
                const teamProjects = irisProjects.filter(
                  (p) => p.team_id === team.team_id,
                );

                return (
                  <div key={team.team_id} className="mb-0.5">
                    {/* Team row */}
                    <div
                      className={`w-full flex items-center ${isSidebarOpen ? "gap-2.5 px-3" : "justify-center px-0"} py-1.5 rounded-md text-[13px] transition-all duration-200 cursor-pointer group ${isTeamExpanded ? "bg-gray-100/50 dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 font-medium" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/30 dark:hover:bg-white/[0.02] hover:text-gray-900 dark:hover:text-gray-200"}`}
                      onClick={() => toggleTeam(team.team_id)}
                      title={team.name}
                    >
                      {isSidebarOpen && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-3 w-3 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-all duration-200 ${isTeamExpanded ? "rotate-90 opacity-100" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}

                      {/* Letter Avatar (Minimalist modern) */}
                      <div
                        className="flex items-center justify-center w-[18px] h-[18px] shrink-0 rounded-[4px] text-[10px] font-bold text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                        style={{ backgroundColor: team.color || "#3b82f6" }}
                      >
                        {team.name ? team.name.charAt(0).toUpperCase() : "W"}
                      </div>

                      {isSidebarOpen && (
                        <>
                          <span className="flex-1 text-left truncate tracking-wide">
                            {team.name}
                          </span>
                          {teamProjects.length > 0 && !isTeamExpanded && (
                            <span className="text-[10px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                              {teamProjects.length}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Expanded projects */}
                    {isTeamExpanded && isSidebarOpen && (
                      <div className="ml-5 mt-0.5 space-y-0.5 border-l border-gray-100 dark:border-white/5">
                        {teamProjects.length === 0 ? (
                          <p className="pl-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 italic font-light">
                            Sin proyectos
                          </p>
                        ) : (
                          teamProjects.map((project) => {
                            const isProjectExpanded = expandedProjects.has(project.project_id);
                            const projectIssues = irisIssues[project.project_id] || [];
                            const statusColor = PROJECT_STATUS_COLORS[project.project_status] || "#6b7280";

                            return (
                              <div key={project.project_id} className="relative mt-0.5">
                                {/* Project row */}
                                <div
                                  className={`w-full flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-r-md text-[12.5px] transition-all duration-200 cursor-pointer group/proj ${isProjectExpanded ? "text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-white/[0.02]" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.01]"}`}
                                  onClick={() => toggleProject(project.project_id)}
                                  onDoubleClick={() => handleIrisProjectClick(project)}
                                  title={`${project.project_name} — ${project.project_status} (${project.completion_percentage}%)`}
                                >
                                  {/* Horizontal connector line */}
                                  <div className="absolute left-0 top-[14px] w-2.5 h-px bg-gray-100 dark:bg-white/5 group-hover/proj:bg-gray-300 dark:group-hover/proj:bg-white/20 transition-colors" />

                                  {/* Status indicator simple dot */}
                                  <div className="w-1.5 h-1.5 rounded-full z-10 shrink-0" style={{ backgroundColor: statusColor }} />

                                  <span className="flex-1 text-left truncate tracking-wide">
                                    {project.project_name}
                                  </span>

                                  {/* Minimal completion badge */}
                                  <span className="text-[9px] px-1 py-0.5 rounded border border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 opacity-0 group-hover/proj:opacity-100 transition-all font-medium">
                                    {project.completion_percentage}%
                                  </span>
                                </div>

                                {/* Expanded issues */}
                                {isProjectExpanded && (
                                  <div className="ml-4 mt-0.5 pb-1 space-y-0.5 border-l border-gray-100 dark:border-white/5">
                                    {projectIssues.length === 0 ? (
                                      <p className="pl-3 py-1 text-[10.5px] text-gray-400 dark:text-gray-500 italic">
                                        Sin tareas
                                      </p>
                                    ) : (
                                      projectIssues.map((issue) => {
                                        const issueStatusColor = ISSUE_STATUS_TYPE_COLORS[issue.status?.status_type || "backlog"] || "#6b7280";
                                        return (
                                          <button
                                            key={issue.issue_id}
                                            onClick={() => handleIrisIssueClick(issue)}
                                            className="relative w-full flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-r-md text-[11px] transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.02] group/issue"
                                            title={issue.title}
                                          >
                                            <div className="absolute left-0 top-[11px] w-2 h-px bg-gray-100 dark:bg-white/5 group-hover/issue:bg-gray-300 dark:group-hover/issue:bg-white/20 transition-colors" />
                                            <span
                                              className="w-1.5 h-1.5 rounded-full shrink-0 group-hover/issue:scale-125 transition-transform"
                                              style={{ backgroundColor: issueStatusColor }}
                                            />
                                            <span className="text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                                              #{issue.issue_number}
                                            </span>
                                            <span className="flex-1 text-left truncate font-medium tracking-wide">
                                              {issue.title}
                                            </span>
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Projects without team (Global Projects) */}
              {(() => {
                const projectsWithoutTeam = irisProjects.filter(
                  (p) =>
                    !p.team_id ||
                    !irisTeams.some((t) => t.team_id === p.team_id),
                );
                if (projectsWithoutTeam.length === 0) return null;

                return (
                  <div className="mt-2 pl-1">
                    {isSidebarOpen && (
                      <div className="px-3 py-1 mb-1">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">
                          WorkSpaces Globales
                        </span>
                      </div>
                    )}

                    {projectsWithoutTeam.map((project) => {
                      const isProjectExpanded = expandedProjects.has(
                        project.project_id,
                      );
                      const projectIssues =
                        irisIssues[project.project_id] || [];
                      const statusColor =
                        PROJECT_STATUS_COLORS[project.project_status] ||
                        "#6b7280";

                      return (
                        <div key={project.project_id} className="mb-0.5">
                          {/* Global Project Row */}
                          <div
                            className={`w-full flex items-center ${isSidebarOpen ? "gap-2.5 px-3" : "justify-center px-0"} py-1.5 rounded-md text-[13px] transition-all duration-200 cursor-pointer group/proj ${isProjectExpanded ? "bg-gray-100/50 dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 font-medium" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/30 dark:hover:bg-white/[0.02] hover:text-gray-900 dark:hover:text-gray-200"}`}
                            onClick={() => toggleProject(project.project_id)}
                            onDoubleClick={() => handleIrisProjectClick(project)}
                            title={`${project.project_name} — ${project.project_status}`}
                          >
                            {isSidebarOpen && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-3 w-3 shrink-0 text-gray-400 opacity-0 group-hover/proj:opacity-100 transition-all duration-200 ${isProjectExpanded ? "rotate-90 opacity-100" : ""}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            )}

                            {/* Square Icon for Global Projects */}
                            <div className="flex items-center justify-center w-[18px] h-[18px] shrink-0 rounded-[4px] border border-gray-200/50 dark:border-white/10 bg-white dark:bg-white/5 shadow-none">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                            </div>

                            {isSidebarOpen && (
                              <>
                                <span className="flex-1 text-left truncate tracking-wide">
                                  {project.project_name}
                                </span>
                                <span className="text-[10px] text-gray-400 px-1 py-0.5 opacity-0 group-hover/proj:opacity-100 transition-opacity">
                                  {project.completion_percentage}%
                                </span>
                              </>
                            )}
                          </div>

                          {isProjectExpanded && isSidebarOpen && (
                            <div className="ml-5 mt-0.5 border-l border-gray-100 dark:border-white/5 space-y-0.5">
                              {projectIssues.length === 0 ? (
                                <p className="pl-3 py-1.5 text-[10.5px] text-gray-400 dark:text-gray-500 italic font-light">
                                  Sin tareas
                                </p>
                              ) : (
                                projectIssues.map((issue) => {
                                  const issueStatusColor = ISSUE_STATUS_TYPE_COLORS[issue.status?.status_type || "backlog"] || "#6b7280";
                                  return (
                                    <button
                                      key={issue.issue_id}
                                      onClick={() => handleIrisIssueClick(issue)}
                                      className="relative w-full flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-r-md text-[11px] transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.02] group/issue"
                                      title={issue.title}
                                    >
                                      <div className="absolute left-0 top-[11px] w-2 h-px bg-gray-100 dark:bg-white/5 group-hover/issue:bg-gray-300 dark:group-hover/issue:bg-white/20 transition-colors" />
                                      <span
                                        className="w-1.5 h-1.5 rounded-full shrink-0 group-hover/issue:scale-125 transition-transform"
                                        style={{ backgroundColor: issueStatusColor }}
                                      />
                                      <span className="text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                                        #{issue.issue_number}
                                      </span>
                                      <span className="flex-1 text-left truncate font-medium tracking-wide">
                                        {issue.title}
                                      </span>
                                    </button>
                                  );
                                })
                               )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

          {/* Folders Section */}
          {folders.length > 0 && (
            <>
              {isSidebarOpen && (
                <div className="pt-5 pb-2 px-3">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">
                    Carpetas
                  </span>
                </div>
              )}

              {folders.map((folder) => {
                const chatsInFolder = folderChats(folder.id);
                const isExpanded = expandedFolders.has(folder.id);
                const isActive =
                  activeView === "project" && currentFolderId === folder.id;

                return (
                  <div key={folder.id}>
                    {/* Folder row */}
                    <div
                      className={`w-full flex items-center ${isSidebarOpen ? "gap-2.5 px-3" : "justify-center px-0"} py-2 rounded-lg text-[13px] transition-all duration-200 cursor-pointer group ${
                        isActive
                          ? "bg-accent/10 dark:bg-accent/20 text-accent font-semibold shadow-sm"
                          : isExpanded 
                          ? "bg-gray-100/50 dark:bg-white/[0.04] text-gray-800 dark:text-gray-200 font-medium"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                      onClick={() => toggleFolder(folder.id)}
                      onDoubleClick={() => handleOpenProject(folder.id)}
                      title={folder.name}
                    >
                      {/* Chevron */}
                      {isSidebarOpen && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 opacity-60 group-hover:opacity-100 ${isActive ? "text-accent opacity-100" : ""} ${isExpanded ? "rotate-90" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      )}

                      {/* Folder icon Box */}
                      <div className={`flex items-center justify-center w-6 h-6 shrink-0 rounded-[8px] border transition-all duration-200 ${isActive ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-white dark:bg-white/[0.02] border-gray-200/50 dark:border-white/[0.08] text-gray-400 group-hover:text-accent group-hover:border-accent/20'}`}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={isActive ? 2.5 : 2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          />
                        </svg>
                      </div>

                      {isSidebarOpen && (
                        <>
                          <span className="flex-1 text-left truncate">
                            {folder.name}
                          </span>

                          {/* Chat count */}
                          {chatsInFolder.length > 0 && (
                            <span className="text-[10px] bg-gray-200/50 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded-full text-gray-500 dark:text-gray-400">
                              {chatsInFolder.length}
                            </span>
                          )}

                          {/* Delete button */}
                          <button
                            onClick={(e) => handleDeleteFolder(folder.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-white/10 transition-all"
                            title="Eliminar carpeta"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3 text-gray-500 hover:text-danger"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Expanded chats */}
                    {isExpanded && isSidebarOpen && (
                      <div className="ml-4 space-y-0.5">
                        {chatsInFolder.length === 0 ? (
                          <p className="px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-600 italic">
                            Vacia
                          </p>
                        ) : (
                          chatsInFolder.map((conv) => (
                            <button
                              key={conv.id}
                              onClick={() => handleSelectConversation(conv.id)}
                              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12.5px] transition-all duration-200 group/chat ${
                                currentConversationId === conv.id &&
                                activeView === "chat"
                                  ? "bg-accent/10 dark:bg-accent/15 text-accent font-medium shadow-sm"
                                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200"
                              }`}
                            >
                              {/* Small chat indicator dot */}
                              <div className={`flex items-center justify-center w-2 h-2 shrink-0 rounded-full transition-all duration-200 ${currentConversationId === conv.id && activeView === "chat" ? 'bg-accent shadow-[0_0_6px_var(--tw-colors-accent)]' : 'bg-gray-300 dark:bg-white/[0.15] group-hover/chat:bg-gray-400 dark:group-hover/chat:bg-white/30'}`} />

                              {renamingChatId === conv.id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  className="flex-1 min-w-0 bg-white dark:bg-[#1E1E1E] border border-accent rounded px-2 py-0.5 text-[12px] text-gray-900 dark:text-white outline-none"
                                  value={editingChatTitle}
                                  onChange={(e) =>
                                    setEditingChatTitle(e.target.value)
                                  }
                                  onBlur={handleRenameChat}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === "Enter") {
                                      handleRenameChat();
                                    } else if (e.key === "Escape") {
                                      setRenamingChatId(null);
                                    }
                                  }}
                                />
                              ) : (
                                <span className="flex-1 text-left truncate">
                                  {conv.title}
                                </span>
                              )}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/chat:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingChatId(conv.id);
                                    setEditingChatTitle(conv.title);
                                  }}
                                  className="p-0.5 rounded hover:bg-gray-300 dark:hover:bg-white/10"
                                  title="Renombrar"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 text-gray-400 dark:text-gray-500 hover:text-accent"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovingChatId(conv.id);
                                  }}
                                  className="p-0.5 rounded hover:bg-gray-300 dark:hover:bg-white/10"
                                  title="Mover"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 text-gray-400 dark:text-gray-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) =>
                                    handleDeleteConversation(conv.id, e)
                                  }
                                  className="p-0.5 rounded hover:bg-gray-300 dark:hover:bg-white/10"
                                  title="Eliminar"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 text-gray-400 dark:text-gray-500 hover:text-danger"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
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
          {isSidebarOpen && (
            <div className="pt-5 pb-2 px-3">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">
                {folders.length > 0 ? "Sin carpeta" : "Conversaciones"}
              </span>
            </div>
          )}

          {loadingConversations ? (
            isSidebarOpen ? (
              <div className="px-3 py-4 text-center">
                <div className="flex gap-1 justify-center">
                  <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" />
                  <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:0.4s]" />
                </div>
              </div>
            ) : null
          ) : ungroupedChats.length === 0 ? (
            isSidebarOpen ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Sin conversaciones aun
                </p>
              </div>
            ) : null
          ) : (
            ungroupedChats.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`w-full flex items-center ${isSidebarOpen ? "gap-2.5 px-3" : "justify-center px-0"} py-2 rounded-lg text-[13px] transition-all duration-200 group ${
                  currentConversationId === conv.id && activeView === "chat"
                    ? "bg-accent/10 dark:bg-accent/15 text-accent font-medium shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200"
                }`}
                title={conv.title}
              >
                {/* Chat Icon Box */}
                <div className={`flex items-center justify-center w-6 h-6 shrink-0 rounded-[8px] border transition-all duration-200 ${currentConversationId === conv.id && activeView === "chat" ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-white dark:bg-white/[0.02] border-gray-200/50 dark:border-white/[0.08] text-gray-400 group-hover:text-accent group-hover:border-accent/20'}`}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={currentConversationId === conv.id && activeView === "chat" ? 2 : 1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                {isSidebarOpen && (
                  <>
                    {renamingChatId === conv.id ? (
                      <input
                        autoFocus
                        type="text"
                        className="flex-1 min-w-0 bg-white dark:bg-[#1E1E1E] border border-accent rounded px-2 py-0.5 text-[13px] text-gray-900 dark:text-white outline-none"
                        value={editingChatTitle}
                        onChange={(e) => setEditingChatTitle(e.target.value)}
                        onBlur={handleRenameChat}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            handleRenameChat();
                          } else if (e.key === "Escape") {
                            setRenamingChatId(null);
                          }
                        }}
                      />
                    ) : (
                      <span className="flex-1 text-left truncate text-[13px]">
                        {conv.title}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingChatId(conv.id);
                          setEditingChatTitle(conv.title);
                        }}
                        className="p-1 rounded hover:bg-gray-300 dark:hover:bg-white/10"
                        title="Renombrar"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 hover:text-accent"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovingChatId(conv.id);
                        }}
                        className="p-1 rounded hover:bg-gray-300 dark:hover:bg-white/10"
                        title="Mover a carpeta"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 text-gray-400 dark:text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="p-1 rounded hover:bg-gray-300 dark:hover:bg-white/10"
                        title="Eliminar"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 hover:text-danger"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </button>
            ))
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="h-[73px] px-2 border-t border-gray-200 dark:border-white/10 relative flex-shrink-0 flex items-center box-border bg-gray-50 dark:bg-transparent">
          <div
            className={`w-full flex items-center ${isSidebarOpen ? "gap-3 px-2" : "justify-center px-0"} text-sm text-gray-700 dark:text-gray-300`}
          >
            {/* User Dropdown Trigger */}
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex items-center gap-3 w-full text-left hover:bg-gray-200 dark:hover:bg-white/5 rounded-lg p-1.5 transition-colors ${!isSidebarOpen && "justify-center"}`}
            >
              {sofiaContext?.currentOrganization?.brand_favicon_url ? (
                <img
                  src={sofiaContext.currentOrganization.brand_favicon_url}
                  alt="Org Logo"
                  className="w-8 h-8 object-contain shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0 overflow-hidden"
                  title={displayName}
                >
                  {sofiaContext?.user?.avatar_url ||
                  (sofiaContext?.user as any)?.profile_picture_url ||
                  user?.user_metadata?.avatar_url ||
                  (user?.user_metadata as any)?.profile_picture_url ||
                  (userSettings as any)?.profile_picture_url ? (
                    <img
                      src={
                        sofiaContext?.user?.avatar_url ||
                        (sofiaContext?.user as any)?.profile_picture_url ||
                        user?.user_metadata?.avatar_url ||
                        (user?.user_metadata as any)?.profile_picture_url ||
                        (userSettings as any)?.profile_picture_url
                      }
                      alt="User"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
              )}

              {isSidebarOpen && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {displayName}
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-gray-400 dark:text-gray-500 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              )}
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <>
                {/* Backdrop to close */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                ></div>

                {/* Menu */}
                <div className="absolute bottom-full left-2 w-[calc(100%-16px)] mb-2 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 min-w-[200px]">
                  {!isSidebarOpen && (
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                      <div className="font-medium text-gray-900 dark:text-white truncate text-sm">
                        {displayName}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {user?.email}
                      </div>
                    </div>
                  )}

                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setIsSettingsOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Configuración
                    </button>

                    {sofiaContext?.currentOrganization && (
                      <button
                        onClick={() => {
                          setIsUserManagementOpen(true);
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                          />
                          <circle cx="9" cy="7" r="4" />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M23 21v-2a4 4 0 00-3-3.87"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16 3.13a4 4 0 010 7.75"
                          />
                        </svg>
                        Administrar Miembros
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsWhatsAppOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <svg
                        className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </button>

                    <button
                      onClick={() => {
                        setActiveView("screen");
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      Ver Pantalla
                    </button>

                    <button
                      onClick={() => {
                        setActiveView("productivity");
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      Productividad
                    </button>

                    <button
                      onClick={() => {
                        setIsAutoDevOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                        />
                      </svg>
                      AutoDev
                    </button>

                    <div className="h-px bg-gray-200 dark:bg-white/10 my-1 mx-1.5"></div>

                    {/* Theme Switcher */}
                    <div className="px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 ml-1">
                        Tema
                      </div>
                      <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-lg border border-gray-200 dark:border-white/5">
                        <button
                          onClick={() => setTheme("light")}
                          className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${theme === "light" ? "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white" : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"}`}
                          title="Claro"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setTheme("system")}
                          className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${theme === "system" ? "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white" : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"}`}
                          title="Sistema"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setTheme("dark")}
                          className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${theme === "dark" ? "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white" : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"}`}
                          title="Oscuro"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-gray-200 dark:bg-white/10 my-1 mx-1.5"></div>

                    <button
                      onClick={signOut}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4.5 w-4.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen">
        {activeView === "chat" && (
          <ChatUI
            messages={currentMessages}
            onMessagesChange={handleMessagesChange}
            externalPrompt={externalPrompt}
            onExternalPromptProcessed={() => setExternalPrompt(null)}
            personalization={
              userSettings
                ? {
                    nickname: userSettings.nickname,
                    occupation: userSettings.occupation,
                    tone: userSettings.tone_style,
                    instructions: userSettings.custom_instructions,
                  }
                : undefined
            }
            userAvatar={
              sofiaContext?.user?.avatar_url ||
              (sofiaContext?.user as any)?.profile_picture_url ||
              user?.user_metadata?.avatar_url ||
              (user?.user_metadata as any)?.profile_picture_url ||
              (userSettings as any)?.profile_picture_url
            }
          />
        )}
        {activeView === "screen" && <ScreenViewer />}
        {activeView === "productivity" && userId && (
          <ProductivityDashboard userId={userId} />
        )}
        {activeView === "project" && currentFolder && (
          <ProjectHub
            folder={currentFolder}
            chats={folderChats(currentFolder.id)}
            onOpenChat={handleSelectConversation}
            onNewChat={() => handleNewChatInProject(currentFolder.id)}
            onDeleteChat={handleDeleteConversation}
            onRenameFolder={(newName) =>
              handleRenameFolder(currentFolder.id, newName)
            }
            onRenameChat={handleRenameChatFromHub}
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
      {userId && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          userId={userId}
          onSave={(settings) => setUserSettings(settings)}
        />
      )}
      <WhatsAppSetup
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        apiKey={GOOGLE_API_KEY}
      />
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        organization={sofiaContext?.currentOrganization || null}
        currentUserRole={
          (sofiaContext?.memberships.find(
            (m) => m.organization_id === sofiaContext?.currentOrganization?.id,
          )?.role as any) || "member"
        }
      />
      <AutoDevPanel
        isOpen={isAutoDevOpen}
        onClose={() => setIsAutoDevOpen(false)}
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
