import { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "./hooks/useTheme";
import { useChatManager } from "./hooks/useChatManager";
import { useFolderManager } from "./hooks/useFolderManager";
import { useIrisData } from "./hooks/useIrisData";
import { ChatUI } from "./adapters/desktop_ui/ChatUI";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Auth } from "./components/Auth";
import { ProjectHub } from "./components/ProjectHub";
import { CreateFolderModal, MoveChatModal } from "./components/FolderModals";
import { ShareModal } from "./components/ShareModal";
import { UnifiedSettingsModal, SettingsTab } from "./components/UnifiedSettingsModal";
import { Sidebar } from "./components/Sidebar";
import {
  loadSettings,
  getCachedSettings,
  migrateLegacySettingsCache,
  type UserAISettings,
} from "./services/settings-service";
import { FlowMode } from "./components/FlowMode";
import { ProductivityDashboard } from "./components/ProductivityDashboard";
import { UpdateNotification } from "./components/UpdateNotification";
import { GOOGLE_API_KEY } from "./config";
import { migrateLegacyChatCache } from "./services/chat-service";
import { migrateLegacyFolderCache } from "./services/folder-service";
import { resolveShareTargetByToken, type ShareTargetType } from "./services/share-service";
import { handleAppMeetingTrigger } from "./services/app-meeting-trigger-service";
import type { BrowserMeetingTriggerPayload } from "./services/meeting-auto-session-store";
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
  const [pendingShareLink, setPendingShareLink] = useState<string | null>(null);
  const [pendingMeetingTrigger, setPendingMeetingTrigger] = useState<BrowserMeetingTriggerPayload | null>(null);
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

  useEffect(() => {
    const legacyUserId = user?.id;
    if (!legacyUserId || !userId || legacyUserId === userId) return;

    migrateLegacyChatCache(legacyUserId, userId);
    migrateLegacyFolderCache(legacyUserId, userId);
    migrateLegacySettingsCache(legacyUserId, userId);

    const legacyCurrentChatKey = `lia_current_chat_id_${legacyUserId}`;
    const syncedCurrentChatKey = `lia_current_chat_id_${userId}`;
    const legacyCurrentChatId = localStorage.getItem(legacyCurrentChatKey);
    if (legacyCurrentChatId && !localStorage.getItem(syncedCurrentChatKey)) {
      localStorage.setItem(syncedCurrentChatKey, legacyCurrentChatId);
    }
    localStorage.removeItem(legacyCurrentChatKey);
  }, [user?.id, userId]);

  // ── Hooks ──────────────────────────────────────────────────────────
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
    const handleShareLink = (_event: any, shareLink: string) => {
      setPendingShareLink(shareLink);
    };
    const handleMeetingTrigger = (_event: any, payload: BrowserMeetingTriggerPayload) => {
      setPendingMeetingTrigger(payload);
    };

    if (ipc) {
      ipc.on("flow-message-received", (_event: any, text: string) => {
        setExternalPrompt(text);
      });
      ipc.on("app:share-link", handleShareLink);
      ipc.on("app:meeting-trigger", handleMeetingTrigger);
      if (isFlowWindow) {
        ipc.on("flow-window-shown", () => {
          setFlowKey((prev) => prev + 1);
        });
      }

      void ipc.invoke("app:get-pending-share-link")
        .then((shareLink: string | null) => {
          if (shareLink) {
            setPendingShareLink(shareLink);
          }
        })
        .catch((error: unknown) => {
          console.warn("[App] No pude recuperar el share link pendiente:", error);
        });

      void ipc.invoke("app:get-pending-meeting-trigger")
        .then((payload: BrowserMeetingTriggerPayload | null) => {
          if (payload) {
            setPendingMeetingTrigger(payload);
          }
        })
        .catch((error: unknown) => {
          console.warn("[App] No pude recuperar el trigger de reunion pendiente:", error);
        });
    }
    return () => {
      if (ipc && ipc.off) {
        ipc.off("flow-message-received", () => {});
        ipc.off("app:share-link", handleShareLink);
        ipc.off("app:meeting-trigger", handleMeetingTrigger);
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
    return (
      <div className="h-screen w-screen bg-transparent flex items-end justify-center pb-0 overflow-visible border-none shadow-none">
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
        {shareLinkNotice && (
          <div className={`mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm ${
            shareLinkNotice.tone === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-100"
              : "border-accent/30 bg-accent/10 text-white"
          }`}>
            {shareLinkNotice.message}
          </div>
        )}

        {liaDegraded && !userId && (
          <div className="mx-6 mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <div className="font-semibold text-amber-50">Sincronizacion de chats no disponible</div>
            <div className="mt-1 text-amber-100/90">
              {liaStatusMessage || "Esta sesion no pudo abrir la base de datos de conversaciones. Cierra sesion e inicia nuevamente para restaurar la sincronizacion entre dispositivos."}
            </div>
          </div>
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
                userAvatar={avatarUrl}
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
                    : null
                }
              />
            ) : (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
                  <h2 className="text-xl font-semibold text-white">La base de datos de conversaciones no esta lista</h2>
                  <p className="mt-3 text-sm leading-6 text-gray-300">
                    SofLIA solo habilita el chat cuando puede usar la identidad compartida de Lia.
                    {` `}
                    Cierra sesion e inicia nuevamente para restaurar la sincronizacion entre tu laptop y tu PC.
                  </p>
                </div>
              </div>
            )}
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

      {/* Modals */}
      <CreateFolderModal
        isOpen={folder.isFolderModalOpen}
        onClose={() => folder.setIsFolderModalOpen(false)}
        onCreate={folder.handleCreateFolder}
      />
      <MoveChatModal
        isOpen={folder.movingChatId !== null}
        onClose={() => folder.setMovingChatId(null)}
        folders={folder.folders.filter((item) => item.can_edit)}
        currentFolderId={movingChat?.folder_id}
        onMove={(folderId) => folder.handleMoveChat(folder.movingChatId!, folderId)}
      />

      {userId && orgId && shareTarget && (
        <ShareModal
          isOpen={true}
          onClose={() => setShareTarget(null)}
          targetId={shareTarget.targetId}
          targetType={shareTarget.targetType}
          targetName={shareTarget.targetName}
          userId={userId}
          orgId={orgId}
          currentSofiaUserId={user?.id}
          currentUserEmail={user?.email}
        />
      )}

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
