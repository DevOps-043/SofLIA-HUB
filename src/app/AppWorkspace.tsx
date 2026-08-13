import { MeetingOpsPanel } from '../components/meetings/MeetingOpsPanel';
import { ProductivityDashboard } from '../components/ProductivityDashboard';
import { BrowserWorkspaceLayout } from '../components/browser/BrowserWorkspaceLayout';
import { PresentationWorkspacePanel } from '../components/presentation/PresentationWorkspacePanel';
import { usePresentationWorkspaceContext } from '../contexts/presentation-workspace-context';
import type { MouseEvent } from 'react';
import { LiaDegradedNotice, ShareLinkNoticeBanner } from './AppNotices';
import { AppChatView } from './AppChatView';
import { AppProjectView } from './AppProjectView';
import type { ActiveView, ChatState, FolderState, ShareLinkNotice, ShareTarget } from './app-types';
import type { UserAISettings } from '../services/settings-service';
import type { BrowserSelectionActionRequest } from '../services/integrated-browser-service';

interface AppWorkspaceProps {
  accessUserIds?: string[];
  activeView: ActiveView;
  browserWorkspaceOpen?: boolean;
  onCloseBrowserWorkspace?: () => void;
  avatarUrl?: string;
  chat: ChatState;
  currentConversation: ChatState['conversations'][number] | null;
  currentFolder?: FolderState['folders'][number];
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
  orgId: string;
  setShareTarget: (target: ShareTarget | null) => void;
  shareLinkNotice: ShareLinkNotice | null;
  userId?: string;
  userSettings: UserAISettings | null;
}

export function AppWorkspace(props: AppWorkspaceProps) {
  const canShareConversation = Boolean(props.currentConversation?.can_share && props.orgId);
  const presentation = usePresentationWorkspaceContext();

  const chatView = (
    <AppChatView
      compact={props.browserWorkspaceOpen}
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
    />
  );

  if (props.browserWorkspaceOpen) {
    return (
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {props.shareLinkNotice && <ShareLinkNoticeBanner notice={props.shareLinkNotice} />}
        {props.liaDegraded && !props.userId && <LiaDegradedNotice message={props.liaStatusMessage || undefined} />}
        <BrowserWorkspaceLayout
          chat={chatView}
          conversations={props.chat.conversations}
          currentConversationId={props.chat.currentConversationId}
          externalSelection={props.externalSelection}
          onClose={props.onCloseBrowserWorkspace ?? (() => undefined)}
          onNewChat={props.onNewChat}
          onSelectConversation={props.onSelectConversation}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
      {props.shareLinkNotice && <ShareLinkNoticeBanner notice={props.shareLinkNotice} />}
      {props.liaDegraded && !props.userId && <LiaDegradedNotice message={props.liaStatusMessage || undefined} />}
      {props.activeView === 'chat' && (
        // El panel de la presentacion convive con el chat en lugar de
        // sustituirlo: el usuario debe poder pedir cambios mientras ve el
        // codigo escribirse.
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden animate-view-in">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {chatView}
          </div>
          {presentation.visible && presentation.workspaceId && (
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
      {props.activeView === 'project' && props.currentFolder && props.userId && (
        <AppProjectView
          chat={props.chat}
          currentFolder={props.currentFolder}
          folder={props.folder}
          onDeleteConversation={props.onDeleteConversation}
          onNewChatInProject={props.onNewChatInProject}
          onNewChatWithMessage={props.onNewChatWithMessage}
          onSelectConversation={props.onSelectConversation}
          orgId={props.orgId}
          setShareTarget={props.setShareTarget}
          userId={props.userId}
        />
      )}
    </main>
  );
}
