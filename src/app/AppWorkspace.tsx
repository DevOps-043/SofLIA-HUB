import { ProductivityDashboard } from '../components/ProductivityDashboard';
import type { MouseEvent } from 'react';
import { LiaDegradedNotice, ShareLinkNoticeBanner } from './AppNotices';
import { AppChatView } from './AppChatView';
import { AppProjectView } from './AppProjectView';
import type { ActiveView, ChatState, FolderState, ShareLinkNotice, ShareTarget } from './app-types';
import type { UserAISettings } from '../services/settings-service';

interface AppWorkspaceProps {
  activeView: ActiveView;
  avatarUrl?: string;
  chat: ChatState;
  currentConversation: ChatState['conversations'][number] | null;
  currentFolder?: FolderState['folders'][number];
  externalPrompt: string | null;
  folder: FolderState;
  liaDegraded: boolean;
  liaStatusMessage?: string | null;
  onDeleteConversation: (conversationId: string, event: MouseEvent) => Promise<void>;
  onExternalPromptProcessed: () => void;
  onMessagesChange: (messages: any) => void;
  onNewChatInProject: (folderId: string) => Promise<void>;
  onNewChatWithMessage: (folderId: string, message: string) => Promise<void>;
  onSelectConversation: (conversationId: string) => Promise<void>;
  orgId: string;
  setShareTarget: (target: ShareTarget | null) => void;
  shareLinkNotice: ShareLinkNotice | null;
  userId?: string;
  userSettings: UserAISettings | null;
}

export function AppWorkspace(props: AppWorkspaceProps) {
  const canShareConversation = Boolean(props.currentConversation?.can_share && props.orgId);

  return (
    <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
      {props.shareLinkNotice && <ShareLinkNoticeBanner notice={props.shareLinkNotice} />}
      {props.liaDegraded && !props.userId && <LiaDegradedNotice message={props.liaStatusMessage || undefined} />}
      {props.activeView === 'chat' && (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden animate-view-in">
          <AppChatView
            avatarUrl={props.avatarUrl}
            canShareConversation={canShareConversation}
            chat={props.chat}
            currentConversation={props.currentConversation}
            externalPrompt={props.externalPrompt}
            onExternalPromptProcessed={props.onExternalPromptProcessed}
            onMessagesChange={props.onMessagesChange}
            onShareConversation={canShareConversation ? () => props.setShareTarget({ targetId: props.currentConversation!.id, targetType: 'conversation', targetName: props.currentConversation!.title }) : undefined}
            userId={props.userId}
            userSettings={props.userSettings}
          />
        </div>
      )}
      {props.activeView === 'productivity' && props.userId && <ProductivityDashboard userId={props.userId} />}
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
