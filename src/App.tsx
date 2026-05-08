import { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "./hooks/useTheme";
import { useChatManager } from "./hooks/useChatManager";
import { useFolderManager } from "./hooks/useFolderManager";
import { useIrisData } from "./hooks/useIrisData";
import { ChatUI } from "./adapters/desktop_ui/ChatUI";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Auth } from "./components/Auth";
import { ProjectHub } from "./components/ProjectHub";
import type { SettingsTab } from "./components/UnifiedSettingsModal";
import { Sidebar } from "./components/Sidebar";
import {
  loadSettings,
  getCachedSettings,
  type UserAISettings,
} from "./services/settings-service";
import { ProductivityDashboard } from "./components/ProductivityDashboard";
import { UpdateNotification } from "./components/UpdateNotification";
import { resolveShareTargetByToken, type ShareTargetType } from "./services/share-service";
import { handleAppMeetingTrigger } from "./services/app-meeting-trigger-service";
import { AppLoadingScreen } from "./app/AppLoadingScreen";
import { FlowWindowRoot } from "./app/FlowWindowRoot";
import { LiaDegradedNotice, ShareLinkNoticeBanner } from "./app/AppNotices";
import { AppModals } from "./app/AppModals";
import { ChatUnavailableState } from "./app/ChatUnavailableState";
import { useCloseActiveChatMenu } from "./app/useCloseActiveChatMenu";
import { useAppIpcTriggers } from "./app/useAppIpcTriggers";
import { useLegacyUserMigration } from "./app/useLegacyUserMigration";
type ActiveView = "chat" | "project" | "productivity";

function AppContent() {
  const { user, dataUserId, loading, signOut, sofiaContext, liaDegraded, liaStatusMessage } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    targetId: string;
    targetType: ShareTargetType;
    targetName: string;
  } | null>(null);
  const [shareLinkNotice, setShareLinkNotice] = useState<{ tone: "info" | "error"; message: string } | null>(null);

  const dismissShareLinkNotice = useCallback(() => {
    setShareLinkNotice(null);
  }, []);

  const userId = dataUserId ?? undefined;
  const orgId = sofiaContext?.currentOrganization?.id || "";
  const accessUserIds = useMemo(
    () => Array.from(new Set([dataUserId, user?.id].filter((value): value is string => Boolean(value)))),
    [dataUserId, user?.id],
  );

  useLegacyUserMigration(user?.id, userId);

  const chat = useChatManager({ userId, orgId, accessUserIds });
  const folder = useFolderManager({
    userId,
    orgId,
    accessUserIds,
    conversations: chat.conversations,
    setConversations: chat.setConversations,
  });
  const iris = useIrisData();
  const { theme, setTheme } = useTheme();

  const [userSettings, setUserSettings] = useState<UserAISettings | null>(null);
  const [isUnifiedSettingsOpen, setIsUnifiedSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("ai");

  // ── Flow Window Detection ──────────────────────────────────────────
  const isFlowWindow =
    window.location.href.includes("view=flow") ||
    (window.process as any)?.argv?.includes("--view-mode=flow");
  const {
    flowKey,
    pendingShareLink,
    setPendingShareLink,
    pendingMeetingTrigger,
    setPendingMeetingTrigger,
  } = useAppIpcTriggers({ isFlowWindow, onExternalPrompt: setExternalPrompt });

  // ── Click outside to close menu ────────────────────────────────────
  useCloseActiveChatMenu(chat.activeMenuChatId, chat.setActiveMenuChatId);

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
  }, [orgId, userId]);

  // ── Scoped messages handler ────────────────────────────────────────
  const scopedMessagesHandler = useMemo(
    () => chat.getScopedMessagesHandler(folder.currentFolderId),
    [chat.currentConversationId, folder.currentFolderId, chat.getScopedMessagesHandler],
  );

  // ── View-aware handlers ────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    await chat.handleNewChat();
    folder.setCurrentFolderId(null);
    setActiveView("chat");
  }, [chat, folder]);

  const handleNewChatInProject = useCallback(
    async (folderId: string) => {
      await chat.handleNewChat(folderId);
      folder.setCurrentFolderId(folderId);
      setActiveView("chat");
    },
    [chat, folder],
  );

  const handleNewChatWithMessage = useCallback(
    async (folderId: string, message: string) => {
      await chat.handleNewChat(folderId);
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

  const handlePendingShareLink = useCallback(async (shareLink: string) => {
    if (!orgId) {
      return;
    }

    const sharedTarget = await resolveShareTargetByToken(shareLink, orgId);
    if (!sharedTarget) {
      setShareLinkNotice({
        tone: "error",
        message: "No encontre un recurso compartido valido para ese enlace.",
      });
      return;
    }

    if (sharedTarget.targetType === "conversation") {
      const conversations = await chat.loadInitialConversations();
      const hasConversation = conversations.some((conversation) => conversation.id === sharedTarget.targetId);

      if (!hasConversation) {
        setShareLinkNotice({
          tone: "error",
          message: "Ese chat compartido todavia no esta disponible para esta cuenta u organizacion.",
        });
        return;
      }

      await handleSelectConversation(sharedTarget.targetId);
      setShareLinkNotice({
        tone: "info",
        message: sharedTarget.permission === "edit"
          ? "Chat compartido abierto en modo colaborativo."
          : "Chat compartido abierto en modo solo lectura.",
      });
      return;
    }

    const folders = await folder.loadInitialFolders();
    const hasFolder = folders.some((item) => item.id === sharedTarget.targetId);

    if (!hasFolder) {
      setShareLinkNotice({
        tone: "error",
        message: "La carpeta compartida no esta disponible para esta cuenta u organizacion.",
      });
      return;
    }

    handleOpenProject(sharedTarget.targetId);
    setShareLinkNotice({
      tone: "info",
      message: sharedTarget.permission === "edit"
        ? "Carpeta compartida abierta en modo colaborativo."
        : "Carpeta compartida abierta en modo solo lectura.",
    });
  }, [chat, folder, handleOpenProject, handleSelectConversation, orgId]);

  useEffect(() => {
    if (!pendingShareLink || !userId || !orgId) {
      return;
    }

    void handlePendingShareLink(pendingShareLink)
      .catch((error) => {
        console.error("[App] Error abriendo shared link:", error);
        setShareLinkNotice({
          tone: "error",
          message: "No pude abrir el recurso compartido desde el enlace.",
        });
      })
      .finally(() => {
        setPendingShareLink(null);
      });
  }, [handlePendingShareLink, orgId, pendingShareLink, userId]);

  useEffect(() => {
    if (!pendingMeetingTrigger || !userId) {
      return;
    }

    void handleAppMeetingTrigger(userId, pendingMeetingTrigger)
      .then((result) => {
        setShareLinkNotice({
          tone: result.kind === "error" ? "error" : "info",
          message: result.message,
        });
      })
      .catch((error) => {
        console.error("[App] Error procesando el trigger de reunion:", error);
        setShareLinkNotice({
          tone: "error",
          message: "No pude procesar el trigger de reunion enviado por la extension.",
        });
      })
      .finally(() => {
        setPendingMeetingTrigger(null);
      });
  }, [pendingMeetingTrigger, userId]);

  useEffect(() => {
    if (!shareLinkNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      dismissShareLinkNotice();
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [dismissShareLinkNotice, shareLinkNotice]);

  // ── IRIS handlers ──────────────────────────────────────────────────
  const handleIrisProjectClick = useCallback(
    async (project: { project_name: string; project_key: string; project_status: string; completion_percentage: number }) => {
      await handleNewChat();
      setExternalPrompt(
        `Dame un resumen del estado del proyecto "${project.project_name}" [${project.project_key}]. Estado: ${project.project_status}, Progreso: ${project.completion_percentage}%.`,
      );
    },
    [handleNewChat],
  );

  const handleIrisIssueClick = useCallback(
    async (issue: { issue_number: number; title: string; description?: string | null; status?: { name: string } | null }) => {
      await handleNewChat();
      const statusName = issue.status?.name || "Sin estado";
      setExternalPrompt(
        `Dame detalles sobre la tarea #${issue.issue_number}: "${issue.title}". Estado: ${statusName}.${issue.description ? ` Descripción: ${issue.description}` : ""}`,
      );
    },
    [handleNewChat],
  );

  // ── Loading / Auth gates ───────────────────────────────────────────
  if (loading) {
    return <AppLoadingScreen isFlowWindow={isFlowWindow} />;
  }

  if (!user && !isFlowWindow) return <Auth />;

  // ── Derived data ───────────────────────────────────────────────────
  const displayName =
    sofiaContext?.user?.full_name || user?.user_metadata?.first_name || user?.email || "Usuario";
  const initials = displayName.charAt(0).toUpperCase();
  const currentFolder = folder.folders.find((f) => f.id === folder.currentFolderId);
  const currentConversation = chat.currentConversationId
    ? chat.conversations.find((conversation) => conversation.id === chat.currentConversationId) || null
    : null;
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
    return <FlowWindowRoot flowKey={flowKey} />;
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
          avatarUrl={avatarUrl ?? undefined}
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
        {shareLinkNotice && <ShareLinkNoticeBanner notice={shareLinkNotice} />}

        {liaDegraded && !userId && (
          <LiaDegradedNotice message={liaStatusMessage || undefined} />
        )}

        {activeView === "chat" && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden animate-view-in">
            {userId ? (
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
                userAvatar={avatarUrl ?? undefined}
                onShare={
                  currentConversation?.can_share && orgId
                    ? () =>
                        setShareTarget({
                          targetId: currentConversation.id,
                          targetType: "conversation",
                          targetName: currentConversation.title,
                        })
                    : undefined
                }
                canSendMessages={currentConversation?.can_edit !== false}
                readOnlyReason={
                  currentConversation && currentConversation.can_edit === false
                    ? "Esta conversacion fue compartida contigo en modo solo lectura."
                    : undefined
                }
              />
            ) : <ChatUnavailableState />}
          </div>
        )}

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
            onShareFolder={
              currentFolder.can_share && orgId
                ? () =>
                    setShareTarget({
                      targetId: currentFolder.id,
                      targetType: "folder",
                      targetName: currentFolder.name,
                    })
                : undefined
            }
            userId={userId}
            orgId={orgId}
          />
        )}
      </main>

      <AppModals
        folder={folder}
        movingChat={movingChat}
        shareTarget={shareTarget}
        userId={userId}
        orgId={orgId}
        user={user}
        userSettings={userSettings}
        sofiaContext={sofiaContext}
        isUnifiedSettingsOpen={isUnifiedSettingsOpen}
        activeSettingsTab={activeSettingsTab}
        onSetShareTarget={setShareTarget}
        onSetUserSettings={setUserSettings}
        onSetUnifiedSettingsOpen={setIsUnifiedSettingsOpen}
      />
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
