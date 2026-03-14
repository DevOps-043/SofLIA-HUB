import { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "./hooks/useTheme";
import { useChatManager } from "./hooks/useChatManager";
import { useFolderManager } from "./hooks/useFolderManager";
import { useIrisData } from "./hooks/useIrisData";
import { ChatUI } from "./adapters/desktop_ui/ChatUI";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Auth } from "./components/Auth";
import { ScreenViewer } from "./components/ScreenViewer";
import { ProjectHub } from "./components/ProjectHub";
import { CreateFolderModal, MoveChatModal } from "./components/FolderModals";
import { UnifiedSettingsModal, SettingsTab } from "./components/UnifiedSettingsModal";
import { Sidebar } from "./components/Sidebar";
import {
  loadSettings,
  getCachedSettings,
  type UserAISettings,
} from "./services/settings-service";
import { FlowMode } from "./components/FlowMode";
import { ProductivityDashboard } from "./components/ProductivityDashboard";
import { UpdateNotification } from "./components/UpdateNotification";
import { GOOGLE_API_KEY } from "./config";
type ActiveView = "chat" | "screen" | "project" | "productivity";

function AppContent() {
  const { user, loading, signOut, sofiaContext } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);

  const userId = user?.id;

  // ── Hooks ──────────────────────────────────────────────────────────
  const chat = useChatManager({ userId });
  const folder = useFolderManager({ userId, setConversations: chat.setConversations });
  const iris = useIrisData();
  const { theme, setTheme } = useTheme();

  // ── Settings ───────────────────────────────────────────────────────
  const [userSettings, setUserSettings] = useState<UserAISettings | null>(null);
  const [isUnifiedSettingsOpen, setIsUnifiedSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("ai");

  // ── Flow Window Detection ──────────────────────────────────────────
  const isFlowWindow =
    window.location.href.includes("view=flow") ||
    (window.process as any)?.argv?.includes("--view-mode=flow");
  const [flowKey, setFlowKey] = useState(0);

  // ── Click outside to close menu ────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = () => chat.setActiveMenuChatId(null);
    if (chat.activeMenuChatId) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [chat.activeMenuChatId]);

  // ── Electron IPC ───────────────────────────────────────────────────
  useEffect(() => {
    const ipc = (window as any).ipcRenderer;
    if (ipc) {
      ipc.on("flow-message-received", (_event: any, text: string) => {
        setExternalPrompt(text);
      });
      if (isFlowWindow) {
        ipc.on("flow-window-shown", () => {
          setFlowKey((prev) => prev + 1);
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

  // ── Init data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const init = async () => {
      const cached = getCachedSettings();
      if (cached && cached.user_id === userId) setUserSettings(cached);

      const [, , settings] = await Promise.all([
        chat.loadInitialConversations(),
        folder.loadInitialFolders(),
        loadSettings(userId),
      ]);
      setUserSettings(settings);

      iris.loadInitialData();
    };

    init();
  }, [userId]);

  // ── Scoped messages handler ────────────────────────────────────────
  const scopedMessagesHandler = useMemo(
    () => chat.getScopedMessagesHandler(folder.currentFolderId),
    [chat.currentConversationId, folder.currentFolderId, chat.getScopedMessagesHandler],
  );

  // ── View-aware handlers ────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    chat.handleNewChat();
    folder.setCurrentFolderId(null);
    setActiveView("chat");
  }, [chat, folder]);

  const handleNewChatInProject = useCallback(
    (folderId: string) => {
      chat.handleNewChat(folderId);
      folder.setCurrentFolderId(folderId);
      setActiveView("chat");
    },
    [chat, folder],
  );

  const handleNewChatWithMessage = useCallback(
    (folderId: string, message: string) => {
      chat.handleNewChat(folderId);
      folder.setCurrentFolderId(folderId);
      setExternalPrompt(message);
      setActiveView("chat");
    },
    [chat, folder],
  );

  const handleSelectConversation = useCallback(
    async (convId: string) => {
      if (convId === chat.currentConversationId && activeView === "chat") return;
      await chat.handleSelectConversation(convId);
      setActiveView("chat");
    },
    [chat, activeView],
  );

  const handleDeleteConversation = useCallback(
    async (convId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await chat.handleDeleteConversation(convId);
    },
    [chat],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await folder.handleDeleteFolder(folderId);
      if (folder.currentFolderId === folderId) {
        folder.setCurrentFolderId(null);
        setActiveView("chat");
      }
    },
    [folder],
  );

  const handleOpenProject = useCallback(
    (folderId: string) => {
      folder.setCurrentFolderId(folderId);
      setActiveView("project");
    },
    [folder],
  );

  // ── IRIS handlers ──────────────────────────────────────────────────
  const handleIrisProjectClick = useCallback(
    (project: { project_name: string; project_key: string; project_status: string; completion_percentage: number }) => {
      handleNewChat();
      setExternalPrompt(
        `Dame un resumen del estado del proyecto "${project.project_name}" [${project.project_key}]. Estado: ${project.project_status}, Progreso: ${project.completion_percentage}%.`,
      );
    },
    [handleNewChat],
  );

  const handleIrisIssueClick = useCallback(
    (issue: { issue_number: number; title: string; description?: string | null; status?: { name: string } | null }) => {
      handleNewChat();
      const statusName = issue.status?.name || "Sin estado";
      setExternalPrompt(
        `Dame detalles sobre la tarea #${issue.issue_number}: "${issue.title}". Estado: ${statusName}.${issue.description ? ` Descripción: ${issue.description}` : ""}`,
      );
    },
    [handleNewChat],
  );

  // ── Loading / Auth gates ───────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex h-screen w-screen items-center justify-center ${isFlowWindow ? "bg-transparent" : "bg-background dark:bg-background-dark"}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 flex items-center justify-center">
            <img src="./assets/Icono.png" alt="Loading" className="w-full h-full object-contain dark:filter-none filter-accent-themed" />
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user && !isFlowWindow) return <Auth />;

  // ── Derived data ───────────────────────────────────────────────────
  const displayName =
    sofiaContext?.user?.full_name || user?.user_metadata?.first_name || user?.email || "Usuario";
  const initials = displayName.charAt(0).toUpperCase();
  const orgId = sofiaContext?.currentOrganization?.id || "";
  const currentFolder = folder.folders.find((f) => f.id === folder.currentFolderId);
  const movingChat = folder.movingChatId
    ? chat.conversations.find((c) => c.id === folder.movingChatId)
    : null;

  const avatarUrl =
    sofiaContext?.user?.avatar_url ||
    (sofiaContext?.user as any)?.profile_picture_url ||
    user?.user_metadata?.avatar_url ||
    (user?.user_metadata as any)?.profile_picture_url ||
    (userSettings as any)?.profile_picture_url;

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

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background dark:bg-background-dark">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        activeView={activeView}
        conversations={chat.conversations}
        currentConversationId={chat.currentConversationId}
        loadingConversations={chat.loadingConversations}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        renamingChatId={chat.renamingChatId}
        onSetRenamingChatId={chat.setRenamingChatId}
        editingChatTitle={chat.editingChatTitle}
        onSetEditingChatTitle={chat.setEditingChatTitle}
        onRenameChat={chat.handleRenameChat}
        activeMenuChatId={chat.activeMenuChatId}
        onSetActiveMenuChatId={chat.setActiveMenuChatId}
        onSetMovingChatId={folder.setMovingChatId}
        folders={folder.folders}
        expandedFolders={folder.expandedFolders}
        currentFolderId={folder.currentFolderId}
        onCreateFolderClick={() => folder.setIsFolderModalOpen(true)}
        onToggleFolder={folder.toggleFolder}
        onOpenProject={handleOpenProject}
        onDeleteFolder={handleDeleteFolder}
        irisTeams={iris.irisTeams}
        irisProjects={iris.irisProjects}
        irisIssues={iris.irisIssues}
        expandedTeams={iris.expandedTeams}
        expandedProjects={iris.expandedProjects}
        onToggleTeam={iris.toggleTeam}
        onToggleProject={iris.toggleProject}
        onIrisProjectClick={handleIrisProjectClick}
        onIrisIssueClick={handleIrisIssueClick}
        onRefreshIris={iris.refreshData}
        displayName={displayName}
        initials={initials}
        userEmail={user?.email}
        avatarUrl={avatarUrl}
        orgLogoUrl={sofiaContext?.currentOrganization?.brand_favicon_url}
        theme={theme}
        onSetTheme={setTheme}
        onOpenSettings={() => {
          setActiveSettingsTab("ai");
          setIsUnifiedSettingsOpen(true);
        }}
        onSignOut={signOut}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {activeView === "chat" && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden animate-view-in">
            <ChatUI
              messages={chat.currentMessages}
              onMessagesChange={scopedMessagesHandler}
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
              userAvatar={avatarUrl}
            />
          </div>
        )}
        {activeView === "screen" && <ScreenViewer />}
        {activeView === "productivity" && userId && (
          <ProductivityDashboard userId={userId} />
        )}
        {activeView === "project" && currentFolder && (
          <ProjectHub
            folder={currentFolder}
            chats={chat.conversations.filter((c) => c.folder_id === currentFolder.id)}
            onOpenChat={handleSelectConversation}
            onNewChat={() => handleNewChatInProject(currentFolder.id)}
            onNewChatWithMessage={(message) =>
              handleNewChatWithMessage(currentFolder.id, message)
            }
            onDeleteChat={handleDeleteConversation}
            onRenameFolder={(newName) =>
              folder.handleRenameFolder(currentFolder.id, newName)
            }
            onRenameChat={chat.handleRenameChatFromHub}
            userId={userId}
            orgId={orgId}
          />
        )}
      </main>

      {/* Modals */}
      <CreateFolderModal
        isOpen={folder.isFolderModalOpen}
        onClose={() => folder.setIsFolderModalOpen(false)}
        onCreate={folder.handleCreateFolder}
      />
      <MoveChatModal
        isOpen={folder.movingChatId !== null}
        onClose={() => folder.setMovingChatId(null)}
        folders={folder.folders}
        currentFolderId={movingChat?.folder_id}
        onMove={(folderId) => folder.handleMoveChat(folder.movingChatId!, folderId)}
      />

      {userId && (
        <UnifiedSettingsModal
          isOpen={isUnifiedSettingsOpen}
          onClose={() => setIsUnifiedSettingsOpen(false)}
          userId={userId}
          userSettings={userSettings}
          onSaveSettings={(settings) => setUserSettings(settings)}
          sofiaContext={sofiaContext}
          apiKey={GOOGLE_API_KEY}
          initialTab={activeSettingsTab}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <UpdateNotification />
    </AuthProvider>
  );
}

export default App;
