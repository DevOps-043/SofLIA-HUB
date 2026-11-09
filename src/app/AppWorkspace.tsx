import { MeetingOpsPanel } from '../components/meetings/MeetingOpsPanel';
import { ProductivityDashboard } from '../components/ProductivityDashboard';
import { BrowserWorkspaceLayout } from '../components/browser/BrowserWorkspaceLayout';
import { PresentationWorkspacePanel } from '../components/presentation/PresentationWorkspacePanel';
import { ArtifactViewerPanel } from '../components/artifacts/ArtifactViewerPanel';
import { useArtifactViewer } from '../components/artifacts/artifact-viewer-context';
import { usePresentationWorkspaceContext } from '../contexts/presentation-workspace-context';
import { useCallback, useRef, useState, type MouseEvent } from 'react';
import { FloatingSofliaChat } from '../components/floating-chat/FloatingSofliaChat';
import { FloatingProjectChatStart } from '../components/floating-chat/FloatingProjectChatStart';
import { FloatingArtifactPreview } from '../components/floating-chat/FloatingArtifactPreview';
import { appFloatingContext, browserFloatingContext } from '../services/floating-chat-context';
import { LiaDegradedNotice, ShareLinkNoticeBanner } from './AppNotices';
import { AppChatView } from './AppChatView';
import { FolderProjectPanel } from '../components/project-workspace/FolderProjectPanel';
import type { useProjectWorkspace } from './useProjectWorkspace';
import { Button } from '../components/ui/Button';
import { UnifiedProjectHub } from '../components/project-hub/UnifiedProjectHub';
import type { ActiveView, ChatState, FolderState, ShareLinkNotice, ShareTarget } from './app-types';
import type { UserAISettings } from '../services/settings-service';
import type { BrowserSelectionActionRequest } from '../services/integrated-browser-service';

interface AppWorkspaceProps {
  projectWorkspace?: ReturnType<typeof useProjectWorkspace>;
  accessUserIds?: string[];
  activeView: ActiveView;
  browserWorkspaceOpen?: boolean;
  onCloseBrowserWorkspace?: () => void;
  avatarUrl?: string;
  chat: ChatState;
  currentConversation: ChatState['conversations'][number] | null;
  currentFolder?: FolderState['folders'][number];
  unifiedProject?: { workspaceId: string; projectId: string } | null;
  externalPrompt: string | null;
  externalSelection: BrowserSelectionActionRequest | null;
  onExternalSelectionProcessed: () => void;
  folder: FolderState;
  liaDegraded: boolean;
  liaStatusMessage?: string | null;
  onRetryConversations?: () => Promise<boolean>;
  onDeleteConversation: (conversationId: string, event: MouseEvent) => Promise<void>;
  onExternalPromptProcessed: () => void;
  onMessagesChange: (messages: ChatState['currentMessages']) => void;
  onNewChat: () => Promise<void>;
  onNewChatInProject: (folderId: string) => Promise<void>;
  onNewChatWithMessage: (folderId: string, message: string) => Promise<void>;
  onSelectConversation: (conversationId: string) => Promise<void>;
  onOpenBrowser?: () => void;
  onOpenMeetings?: () => void;
  onOpenLiveSessions?: () => void;
  orgId: string;
  setShareTarget: (target: ShareTarget | null) => void;
  shareLinkNotice: ShareLinkNotice | null;
  userId?: string;
  userSettings: UserAISettings | null;
}

export function AppWorkspace(props: AppWorkspaceProps) {
  const canShareConversation = Boolean(props.currentConversation?.can_share && props.orgId);
  const presentation = usePresentationWorkspaceContext();
  const artifactViewer = useArtifactViewer();

  const navigation = props.projectWorkspace?.navigation;
  const surface = useRef<HTMLElement>(null);
  const [floatingRevision, setFloatingRevision] = useState(0);
  const creatingFloating = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const floating = !!props.browserWorkspaceOpen || (props.activeView !== 'chat' && navigation?.section !== 'chat');
  const surfaceKey = `${props.userId}/${props.orgId}/${props.projectWorkspace?.key || ''}/${props.activeView}/${navigation?.section || ''}`;
  const readVisibleContext = useCallback((signal: AbortSignal) => props.browserWorkspaceOpen ? browserFloatingContext(signal) : appFloatingContext(() => surface.current, `${props.activeView} ${navigation?.name || ''} ${navigation?.section || ''}`)(signal), [props.browserWorkspaceOpen, props.activeView, navigation?.name, navigation?.section]);
  const prepareFloatingChat = async () => {
    if (!navigation || props.projectWorkspace?.canShowChat) return;
    if (!navigation.canCreateChat || !navigation.onBrowserNewChat) throw new Error('No hay un chat editable en este proyecto.');
    await navigation.onBrowserNewChat();
  };
  const newFloatingChat = () => {
    if (creatingFloating.current?.key === surfaceKey) return creatingFloating.current.promise;
    const create = async () => {
      if (navigation) {
        if (!navigation.canCreateChat || !navigation.onBrowserNewChat) throw new Error('No hay permiso para crear un chat.');
        await navigation.onBrowserNewChat();
      } else {
        await props.chat.handleNewChat();
        props.folder.setCurrentFolderId(null);
      }
      setFloatingRevision(value => value + 1);
    };
    const promise: Promise<void> = create().finally(() => { if (creatingFloating.current?.promise === promise) creatingFloating.current = null; });
    creatingFloating.current = { key: surfaceKey, promise };
    return promise;
  };
  const chatView = navigation && !props.projectWorkspace?.canShowChat ? floating ? <FloatingProjectChatStart key={surfaceKey} canCreate={navigation.canCreateChat} message={navigation.chatMessage} onStart={newFloatingChat} /> : <div className="grid h-full place-items-center p-6 text-sm text-secondary">{navigation.chatMessage || 'Selecciona o crea un chat de este proyecto.'}</div> : (
    <AppChatView
      scopeKey={floating ? `${surfaceKey}/${floatingRevision}` : surfaceKey}
      floating={floating}
      browserOpen={!!props.browserWorkspaceOpen}
      readVisibleContext={floating ? readVisibleContext : undefined}
      onBackToProject={navigation ? () => navigation.onNavigate('chats') : undefined}
      canWriteProjectChat={navigation?.canCreateChat}
      compact={floating}
      avatarUrl={props.avatarUrl}
      canShareConversation={canShareConversation}
      chat={props.chat}
      currentConversation={props.currentConversation}
      externalPrompt={props.externalPrompt}
      externalSelection={props.externalSelection}
      onExternalSelectionProcessed={props.onExternalSelectionProcessed}
      onExternalPromptProcessed={props.onExternalPromptProcessed}
      onMessagesChange={props.onMessagesChange}
      onRetryConversations={props.onRetryConversations}
      onShareConversation={canShareConversation ? () => props.setShareTarget({ targetId: props.currentConversation!.id, targetType: 'conversation', targetName: props.currentConversation!.title }) : undefined}
      userId={props.userId}
      userSettings={props.userSettings}
      onOpenBrowser={props.onOpenBrowser}
      onOpenMeetings={props.onOpenMeetings}
      onOpenLiveSessions={props.onOpenLiveSessions}
    />
  );

  if (props.browserWorkspaceOpen) {
    return (
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {props.shareLinkNotice && <ShareLinkNoticeBanner notice={props.shareLinkNotice} />}
        {props.liaDegraded && !props.userId && props.activeView !== 'chat' && <LiaDegradedNotice message={props.liaStatusMessage || undefined} />}
        <BrowserWorkspaceLayout
          key={surfaceKey}
          floating
          floatingTitle={props.currentConversation?.title || navigation?.name}
          onPrepareFloating={prepareFloatingChat}
          projectTarget={navigation?.browserProject}
          chat={chatView}
          conversations={navigation?.conversations ?? props.chat.conversations}
          currentConversationId={navigation ? navigation.currentConversationId : props.chat.currentConversationId}
          externalSelection={props.externalSelection}
          onClose={props.onCloseBrowserWorkspace ?? (() => undefined)}
          onNewChat={newFloatingChat}
          onSelectConversation={navigation?.onBrowserOpenChat ?? (async id => { await props.chat.handleSelectConversation(id); setFloatingRevision(value => value + 1); })}
        />
      </main>
    );
  }

  return (
    <main ref={surface} className="relative flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
      {props.shareLinkNotice && <ShareLinkNoticeBanner notice={props.shareLinkNotice} />}
      {props.liaDegraded && !props.userId && props.activeView !== 'chat' && <LiaDegradedNotice message={props.liaStatusMessage || undefined} />}
      {props.activeView === 'chat' && (
        // El panel de la presentacion convive con el chat en lugar de
        // sustituirlo: el usuario debe poder pedir cambios mientras ve el
        // codigo escribirse.
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden animate-view-in">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {chatView}
          </div>
          {artifactViewer?.selected ? <ArtifactViewerPanel /> : presentation.visible && presentation.workspaceId && (
            // El panel gestiona su propio ancho (ajustable y recordado), asi
            // que aqui no se le impone uno.
            // La clave lo remonta al cambiar de presentacion, para que nunca
            // muestre los archivos de la anterior.
            <PresentationWorkspacePanel
              key={presentation.workspaceId}
              workspaceId={presentation.workspaceId}
              onHide={presentation.hide}
            />
          )}
        </div>
      )}
      {props.activeView === 'productivity' && props.userId && <ProductivityDashboard userId={props.userId} />}
      {props.activeView === 'meetings' && props.userId && (
        <div className="flex-1 min-h-0 overflow-hidden animate-view-in">
          <MeetingOpsPanel userId={props.userId} organizationId={props.orgId || null} accessUserIds={props.accessUserIds} />
        </div>
      )}
      {(props.activeView === 'project' || props.activeView === 'project-hub') && !navigation && <div className="grid h-full place-items-center p-6"><div><p className="text-sm text-secondary">Selecciona un proyecto de la organización actual.</p><Button size="sm" variant="ghost" onClick={props.projectWorkspace?.exit}>Volver a proyectos</Button></div></div>}
      {navigation?.section === 'chat' && <div className="flex min-h-0 flex-1 flex-col">{chatView}</div>}
      {props.activeView === 'project' && props.currentFolder && props.userId && navigation && navigation.section !== 'chat' && <FolderProjectPanel key={props.currentFolder.id} folder={props.currentFolder} navigation={navigation} userId={props.userId} orgId={props.orgId} />}
      {props.activeView === 'project-hub' && props.unifiedProject && navigation && navigation.section !== 'chat' && <UnifiedProjectHub workspaceId={props.unifiedProject.workspaceId} projectId={props.unifiedProject.projectId} section={navigation?.section} navigation={navigation} onNavigate={navigation?.onNavigate} onProjectReady={props.projectWorkspace?.onProjectReady} onOpenWeb={props.projectWorkspace?.onOpenWeb} />}
      {floating && props.userId && <FloatingSofliaChat key={surfaceKey} title={props.currentConversation?.title || navigation?.name} onPrepare={prepareFloatingChat} onNewChat={!navigation || navigation.canCreateChat ? newFloatingChat : undefined}>{chatView}</FloatingSofliaChat>}
      {floating && props.userId && <FloatingArtifactPreview />}
    </main>
  );
}
