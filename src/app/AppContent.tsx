import { useCallback, useMemo, useState } from 'react';
import { Auth } from '../components/Auth';
import { AppLoadingScreen } from './AppLoadingScreen';
import { AppModals } from './AppModals';
import { AppSidebar } from './AppSidebar';
import { AppWorkspace } from './AppWorkspace';
import { FlowWindowRoot } from './FlowWindowRoot';
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
  const dismissShareLinkNotice = useCallback(() => setShareLinkNotice(null), []);
  const userId = dataUserId ?? undefined;
  const orgId = sofiaContext?.currentOrganization?.id || '';
  const accessUserIds = useMemo(() => Array.from(new Set([dataUserId, user?.id].filter((value): value is string => Boolean(value)))), [dataUserId, user?.id]);
  const chat = useChatManager({ userId, orgId, accessUserIds });
  const folder = useFolderManager({ userId, orgId, accessUserIds, conversations: chat.conversations, setConversations: chat.setConversations });
  const iris = useIrisData();
  const { theme, setTheme } = useTheme();
  const isFlowWindow = window.location.href.includes('view=flow') || (window.process as any)?.argv?.includes('--view-mode=flow');
  const ipc = useAppIpcTriggers({ isFlowWindow, onExternalPrompt: setExternalPrompt });
  const scopedMessagesHandler = useMemo(() => chat.getScopedMessagesHandler(folder.currentFolderId), [chat.currentConversationId, folder.currentFolderId, chat.getScopedMessagesHandler]);
  const handlers = useAppViewHandlers({ activeView, chat, folder, setActiveView, setExternalPrompt });
  const derived = useAppDerivedData({ auth, chat, folder, userSettings });

  useLegacyUserMigration(user?.id, userId);
  useCloseActiveChatMenu(chat.activeMenuChatId, chat.setActiveMenuChatId);
  useAppBootstrap({ chat, folder, iris, orgId, setUserSettings, userId });
  useShareLinkRouting({ chat: { loadInitialConversations: chat.loadInitialConversations }, folder: { loadInitialFolders: folder.loadInitialFolders }, handleOpenProject: handlers.handleOpenProject, handleSelectConversation: handlers.handleSelectConversation, orgId, pendingShareLink: ipc.pendingShareLink, setPendingShareLink: ipc.setPendingShareLink, setShareLinkNotice, userId });
  useMeetingTriggerNotice({ pendingMeetingTrigger: ipc.pendingMeetingTrigger, setPendingMeetingTrigger: ipc.setPendingMeetingTrigger, setShareLinkNotice, userId });
  useAutoDismissNotice(shareLinkNotice, dismissShareLinkNotice);

  if (loading) return <AppLoadingScreen isFlowWindow={isFlowWindow} />;
  if (!user && !isFlowWindow) return <Auth />;
  if (isFlowWindow) return <FlowWindowRoot flowKey={ipc.flowKey} />;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background dark:bg-background-dark">
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
        onDeleteConversation={handlers.handleDeleteConversation}
        onDeleteFolder={handlers.handleDeleteFolder}
        onIrisIssueClick={handlers.handleIrisIssueClick}
        onIrisProjectClick={handlers.handleIrisProjectClick}
        onNewChat={handlers.handleNewChat}
        onOpenProject={handlers.handleOpenProject}
        onOpenSettings={() => { setActiveSettingsTab('ai'); setIsUnifiedSettingsOpen(true); }}
        onSelectConversation={handlers.handleSelectConversation}
        onSignOut={signOut}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        setTheme={setTheme}
        theme={theme}
      />
      <AppWorkspace activeView={activeView} avatarUrl={derived.avatarUrl ?? undefined} chat={chat} currentConversation={derived.currentConversation} currentFolder={derived.currentFolder} externalPrompt={externalPrompt} folder={folder} liaDegraded={liaDegraded} liaStatusMessage={liaStatusMessage} onDeleteConversation={handlers.handleDeleteConversation} onExternalPromptProcessed={() => setExternalPrompt(null)} onMessagesChange={scopedMessagesHandler} onNewChatInProject={handlers.handleNewChatInProject} onNewChatWithMessage={handlers.handleNewChatWithMessage} onSelectConversation={handlers.handleSelectConversation} orgId={orgId} setShareTarget={setShareTarget} shareLinkNotice={shareLinkNotice} userId={userId} userSettings={userSettings} />
      <AppModals folder={folder} movingChat={derived.movingChat} shareTarget={shareTarget} userId={userId} orgId={orgId} user={user} userSettings={userSettings} sofiaContext={sofiaContext} isUnifiedSettingsOpen={isUnifiedSettingsOpen} activeSettingsTab={activeSettingsTab} onSetShareTarget={setShareTarget} onSetUserSettings={setUserSettings} onSetUnifiedSettingsOpen={setIsUnifiedSettingsOpen} />
    </div>
  );
}
