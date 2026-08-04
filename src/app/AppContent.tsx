import { useCallback, useEffect, useMemo, useState } from 'react';
import { Auth } from '../components/Auth';
import { AppLoadingScreen, type StartupLogoExitTarget } from './AppLoadingScreen';
import { AppModals } from './AppModals';
import { AppSidebar } from './AppSidebar';
import { AppWorkspace } from './AppWorkspace';
import { OrbWindowRoot } from './OrbWindowRoot';
import type { ActiveView, ShareLinkNotice, ShareTarget } from './app-types';
import type { SettingsTab } from '../components/UnifiedSettingsModal';
import type { UserAISettings } from '../services/settings-service';
import { useAppBootstrap } from './useAppBootstrap';
import { useAppDerivedData } from './useAppDerivedData';
import { useAppIpcTriggers } from './useAppIpcTriggers';
import { useAppViewHandlers } from './useAppViewHandlers';
import { useAutoDismissNotice } from './useAutoDismissNotice';
import { useCloseActiveChatMenu } from './useCloseActiveChatMenu';
import { useLegacyUserMigration } from './useLegacyUserMigration';
import { useMeetingTriggerNotice } from './useMeetingTriggerNotice';
import { useShareLinkRouting } from './useShareLinkRouting';
import { useAuth } from '../contexts/AuthContext';
import { useChatManager } from '../hooks/useChatManager';
import { useFolderManager } from '../hooks/useFolderManager';
import { useIrisData } from '../hooks/useIrisData';
import { useTheme } from '../hooks/useTheme';
import { integratedBrowserService } from '../services/integrated-browser-service';

const STARTUP_INTRO_DURATION_MS = 4200;
const STARTUP_AUTH_GRACE_MS = 700;
const STARTUP_OVERLAY_EXIT_MS = 1250;

type SidebarPosition = 'left' | 'right' | 'bottom';

function resolveStoredSidebarPosition(value: string | null): SidebarPosition {
  return value === 'right' || value === 'bottom' || value === 'left' ? value : 'left';
}

function getWindowArgv(): string[] {
  const maybeProcess = (window as Window & { process?: { argv?: unknown } }).process;
  if (!Array.isArray(maybeProcess?.argv)) return [];
  return maybeProcess.argv.filter((arg): arg is string => typeof arg === 'string');
}

export function AppContent() {
  const auth = useAuth();
  const { user, dataUserId, loading, signOut, sofiaContext, liaDegraded, liaStatusMessage } = auth;
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [shareLinkNotice, setShareLinkNotice] = useState<ShareLinkNotice | null>(null);
  const [userSettings, setUserSettings] = useState<UserAISettings | null>(null);
  const [isUnifiedSettingsOpen, setIsUnifiedSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('ai');
  const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>(() => {
    return resolveStoredSidebarPosition(localStorage.getItem('sofLia_sidebarPosition'));
  });
  const dismissShareLinkNotice = useCallback(() => setShareLinkNotice(null), []);
  const userId = dataUserId ?? undefined;
  const orgId = sofiaContext?.currentOrganization?.id || '';
  // Equipos de la organizacion activa (equipos SOFIA = equipos IRIS por id) para segmentar IRIS.
  const orgTeamIds = useMemo(
    () => (sofiaContext?.teams || []).filter((team) => team.organization_id === orgId).map((team) => team.id),
    [sofiaContext?.teams, orgId],
  );
  const accessUserIds = useMemo(() => Array.from(new Set([dataUserId, user?.id].filter((value): value is string => Boolean(value)))), [dataUserId, user?.id]);
  const chat = useChatManager({ userId, orgId, accessUserIds });
  const folder = useFolderManager({ userId, orgId, accessUserIds, conversations: chat.conversations, setConversations: chat.setConversations });
  const iris = useIrisData(orgTeamIds);
  const { theme, setTheme } = useTheme();
  const isOrbWindow = window.location.href.includes('view=orb') || getWindowArgv().includes('--view-mode=orb');
  const [showStartupIntro, setShowStartupIntro] = useState(() => !isOrbWindow);
  const [startupAuthGraceElapsed, setStartupAuthGraceElapsed] = useState(() => isOrbWindow);
  const [renderStartupOverlay, setRenderStartupOverlay] = useState(() => !isOrbWindow);
  const [isStartupOverlayExiting, setIsStartupOverlayExiting] = useState(false);
  const ipc = useAppIpcTriggers({ isOrbWindow });
  const { getScopedMessagesHandler } = chat;
  const scopedMessagesHandler = useMemo(() => getScopedMessagesHandler(folder.currentFolderId), [folder.currentFolderId, getScopedMessagesHandler]);
  const handlers = useAppViewHandlers({ activeView, chat, folder, setActiveView, setExternalPrompt });
  const derived = useAppDerivedData({ auth, chat, folder, userSettings });

  useLegacyUserMigration(user?.id, userId);
  useCloseActiveChatMenu(chat.activeMenuChatId, chat.setActiveMenuChatId);
  useAppBootstrap({ chat, folder, iris, orgId, setUserSettings, userId });
  useShareLinkRouting({ chat: { loadInitialConversations: chat.loadInitialConversations }, folder: { loadInitialFolders: folder.loadInitialFolders }, handleOpenProject: handlers.handleOpenProject, handleSelectConversation: handlers.handleSelectConversation, orgId, pendingShareLink: ipc.pendingShareLink, setPendingShareLink: ipc.setPendingShareLink, setShareLinkNotice, userId });
  useMeetingTriggerNotice({ pendingMeetingTrigger: ipc.pendingMeetingTrigger, setPendingMeetingTrigger: ipc.setPendingMeetingTrigger, setShareLinkNotice, userId });
  useAutoDismissNotice(shareLinkNotice, dismissShareLinkNotice);

  useEffect(() => {
    if (!user || !integratedBrowserService.isAvailable()) return undefined;
    return integratedBrowserService.subscribe({
      onOpenRequested: () => setActiveView('browser'),
    });
  }, [user]);

  useEffect(() => {
    if (isOrbWindow) {
      setShowStartupIntro(false);
      setStartupAuthGraceElapsed(true);
      return undefined;
    }

    const introTimer = window.setTimeout(() => {
      setShowStartupIntro(false);
    }, STARTUP_INTRO_DURATION_MS);
    const authGraceTimer = window.setTimeout(() => {
      setStartupAuthGraceElapsed(true);
    }, STARTUP_INTRO_DURATION_MS + STARTUP_AUTH_GRACE_MS);

    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(authGraceTimer);
    };
  }, [isOrbWindow]);

  useEffect(() => {
    const loadSidebarPosition = async () => {
      try {
        if (window.computerUse?.getSidebarPosition) {
          const pos = await window.computerUse.getSidebarPosition();
          if (pos === 'left' || pos === 'right' || pos === 'bottom') {
            setSidebarPosition(pos);
            localStorage.setItem('sofLia_sidebarPosition', pos);
          }
        }
      } catch (err) {
        console.error('Error loading sidebar position from backend:', err);
      }
    };
    loadSidebarPosition();

    const handleUpdate = () => {
      setSidebarPosition(resolveStoredSidebarPosition(localStorage.getItem('sofLia_sidebarPosition')));
    };
    window.addEventListener('sofLia_sidebarPositionChanged', handleUpdate);
    return () => window.removeEventListener('sofLia_sidebarPositionChanged', handleUpdate);
  }, []);

  const shouldWaitForAuthDuringIntro = loading && !startupAuthGraceElapsed && !user;
  const shouldShowStartupIntro = !isOrbWindow && (showStartupIntro || shouldWaitForAuthDuringIntro);
  const startupLogoExitTarget: StartupLogoExitTarget = user
    ? sidebarPosition === 'right'
      ? 'workspace-right'
      : sidebarPosition === 'bottom'
        ? 'workspace-bottom'
        : 'workspace-left'
    : 'login';

  useEffect(() => {
    if (shouldShowStartupIntro) {
      setRenderStartupOverlay(true);
      setIsStartupOverlayExiting(false);
      return undefined;
    }

    if (!renderStartupOverlay) return undefined;

    setIsStartupOverlayExiting(true);
    const overlayTimer = window.setTimeout(() => {
      setRenderStartupOverlay(false);
      setIsStartupOverlayExiting(false);
    }, STARTUP_OVERLAY_EXIT_MS);

    return () => window.clearTimeout(overlayTimer);
  }, [renderStartupOverlay, shouldShowStartupIntro]);

  const appShell = !user && !isOrbWindow ? (
    <Auth key="auth" />
  ) : isOrbWindow ? (
    <OrbWindowRoot key="orb-window" />
  ) : (
    <div key="app-workspace" className={`flex h-screen w-screen overflow-hidden bg-background dark:bg-background-dark ${
      sidebarPosition === 'bottom' ? 'flex-col-reverse' : sidebarPosition === 'right' ? 'flex-row-reverse' : 'flex-row'
    }`}>
        <AppSidebar
          activeView={activeView}
          auth={auth}
          avatarUrl={derived.avatarUrl ?? undefined}
          chat={chat}
          displayName={derived.displayName}
          folder={folder}
          initials={derived.initials}
          iris={iris}
          isSidebarOpen={isSidebarOpen}
          position={sidebarPosition}
          onDeleteConversation={handlers.handleDeleteConversation}
          onDeleteFolder={handlers.handleDeleteFolder}
          onIrisIssueClick={handlers.handleIrisIssueClick}
          onIrisProjectClick={handlers.handleIrisProjectClick}
          onNewChat={handlers.handleNewChat}
          onOpenProject={handlers.handleOpenProject}
          onOpenSdo={() => setActiveView('sdo')}
          onOpenMeetings={() => setActiveView('meetings')}
          onOpenBrowser={() => setActiveView('browser')}
          onOpenSettings={() => { setActiveSettingsTab('ai'); setIsUnifiedSettingsOpen(true); }}
          onSelectConversation={handlers.handleSelectConversation}
          onSignOut={signOut}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          setTheme={setTheme}
          theme={theme}
        />
        <AppWorkspace accessUserIds={accessUserIds} activeView={activeView} avatarUrl={derived.avatarUrl ?? undefined} chat={chat} currentConversation={derived.currentConversation} currentFolder={derived.currentFolder} externalPrompt={externalPrompt} folder={folder} liaDegraded={liaDegraded} liaStatusMessage={liaStatusMessage} onDeleteConversation={handlers.handleDeleteConversation} onExternalPromptProcessed={() => setExternalPrompt(null)} onMessagesChange={scopedMessagesHandler} onNewChatInProject={handlers.handleNewChatInProject} onNewChatWithMessage={handlers.handleNewChatWithMessage} onSelectConversation={handlers.handleSelectConversation} orgId={orgId} setShareTarget={setShareTarget} shareLinkNotice={shareLinkNotice} userId={userId} userSettings={userSettings} />
        <AppModals folder={folder} movingChat={derived.movingChat} shareTarget={shareTarget} userId={userId} orgId={orgId} user={user} userSettings={userSettings} sofiaContext={sofiaContext} isUnifiedSettingsOpen={isUnifiedSettingsOpen} activeSettingsTab={activeSettingsTab} onSetShareTarget={setShareTarget} onSetUserSettings={setUserSettings} onSetUnifiedSettingsOpen={setIsUnifiedSettingsOpen} />
      </div>
  );

  return (
    <div className={`h-screen w-screen overflow-hidden ${isOrbWindow ? 'bg-transparent' : 'bg-[#f4faf9] dark:bg-[#080b11]'}`}>
      <div className="h-full w-full" aria-hidden={shouldShowStartupIntro}>
        {appShell}
      </div>
      {renderStartupOverlay && (
        <AppLoadingScreen
          isExiting={isStartupOverlayExiting}
          isOrbWindow={isOrbWindow}
          logoExitTarget={startupLogoExitTarget}
          playIntroSound={!isStartupOverlayExiting}
          themeMode={theme}
        />
      )}
    </div>
  );
}
