import { Sidebar } from '../components/Sidebar';
import type { MouseEvent } from 'react';
import type { ThemeMode } from '../hooks/useTheme';
import type { IrisIssue, IrisProject } from '../lib/iris-client';
import type { ActiveView, AuthState, ChatState, FolderState, IrisState } from './app-types';

interface AppSidebarProps {
  activeView: ActiveView;
  browserOpen?: boolean;
  auth: AuthState;
  avatarUrl?: string;
  chat: ChatState;
  displayName: string;
  folder: FolderState;
  initials: string;
  iris: IrisState;
  isSidebarOpen: boolean;
  position?: 'left' | 'right' | 'bottom';
  onDeleteConversation: (conversationId: string, event: MouseEvent) => Promise<void>;
  onDeleteFolder: (folderId: string, event: MouseEvent) => Promise<void>;
  onIrisIssueClick: (issue: IrisIssue) => Promise<void>;
  onIrisProjectClick: (project: IrisProject) => Promise<void>;
  onNewChat: () => Promise<void>;
  onOpenProject: (folderId: string) => void;
  onOpenUnifiedProject: (workspaceId: string, projectId: string) => void;
  activeUnifiedProjectId?: string | null;
  onOpenMeetings?: () => void;
  onOpenBrowser?: () => void;
  onSelectConversation: (conversationId: string) => Promise<void>;
  onSignOut: AuthState['signOut'];
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  setTheme: (theme: ThemeMode) => void;
  theme: ThemeMode;
}

export function AppSidebar(props: AppSidebarProps) {
  const { auth, chat, folder, iris } = props;

  return (
    <Sidebar
      isOpen={props.isSidebarOpen}
      position={props.position}
      onToggle={props.onToggleSidebar}
      activeView={props.activeView}
      browserOpen={props.browserOpen}
      conversations={chat.conversations}
      currentConversationId={chat.currentConversationId}
      loadingConversations={chat.loadingConversations}
      conversationsUnavailableMessage={auth.liaDegraded ? auth.liaStatusMessage : null}
      onRetryConversations={auth.retryConversations}
      onNewChat={props.onNewChat}
      onSelectConversation={props.onSelectConversation}
      onDeleteConversation={props.onDeleteConversation}
      onTogglePinConversation={chat.handleTogglePinChat}
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
      onOpenProject={props.onOpenProject}
      onOpenUnifiedProject={props.onOpenUnifiedProject}
      activeUnifiedProjectId={props.activeUnifiedProjectId}
      onOpenMeetings={props.onOpenMeetings}
      onOpenBrowser={props.onOpenBrowser}
      onDeleteFolder={props.onDeleteFolder}
      renamingFolderId={folder.renamingFolderId}
      editingFolderName={folder.editingFolderName}
      onSetEditingFolderName={folder.setEditingFolderName}
      onStartRenameFolder={folder.startFolderRename}
      onFinishRenameFolder={folder.commitFolderRename}
      onCancelRenameFolder={folder.cancelFolderRename}
      irisTeams={iris.irisTeams}
      irisProjects={iris.irisProjects}
      irisIssues={iris.irisIssues}
      expandedTeams={iris.expandedTeams}
      expandedProjects={iris.expandedProjects}
      onToggleTeam={iris.toggleTeam}
      onToggleProject={iris.toggleProject}
      onIrisProjectClick={props.onIrisProjectClick}
      onIrisIssueClick={props.onIrisIssueClick}
      onRefreshIris={iris.refreshData}
      displayName={props.displayName}
      initials={props.initials}
      userEmail={auth.user?.email}
      avatarUrl={props.avatarUrl}
      orgName={auth.sofiaContext?.currentOrganization?.name}
      orgLogoUrl={auth.sofiaContext?.currentOrganization?.brand_favicon_url}
      organizations={auth.sofiaContext?.organizations}
      currentOrgId={auth.sofiaContext?.currentOrganization?.id}
      onSelectOrganization={auth.setCurrentOrganization}
      theme={props.theme}
      onSetTheme={props.setTheme}
      onOpenSettings={props.onOpenSettings}
      onSignOut={props.onSignOut}
    />
  );
}
