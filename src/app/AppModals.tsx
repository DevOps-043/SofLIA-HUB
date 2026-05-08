import { GOOGLE_API_KEY } from "../config";
import { CreateFolderModal, MoveChatModal } from "../components/FolderModals";
import { ShareModal } from "../components/ShareModal";
import { UnifiedSettingsModal, type SettingsTab } from "../components/UnifiedSettingsModal";
import type { ShareTargetType } from "../services/share-service";

interface AppModalsProps {
  folder: any;
  movingChat: any;
  shareTarget: { targetId: string; targetType: ShareTargetType; targetName: string } | null;
  userId?: string;
  orgId: string;
  user: any;
  userSettings: any;
  sofiaContext: any;
  isUnifiedSettingsOpen: boolean;
  activeSettingsTab: SettingsTab;
  onSetShareTarget: (target: AppModalsProps["shareTarget"]) => void;
  onSetUserSettings: (settings: any) => void;
  onSetUnifiedSettingsOpen: (open: boolean) => void;
}

export function AppModals(props: AppModalsProps) {
  return (
    <>
      <CreateFolderModal
        isOpen={props.folder.isFolderModalOpen}
        onClose={() => props.folder.setIsFolderModalOpen(false)}
        onCreate={props.folder.handleCreateFolder}
      />
      <MoveChatModal
        isOpen={props.folder.movingChatId !== null}
        onClose={() => props.folder.setMovingChatId(null)}
        folders={props.folder.folders.filter((item: any) => item.can_edit)}
        currentFolderId={props.movingChat?.folder_id}
        onMove={(folderId) => props.folder.handleMoveChat(props.folder.movingChatId!, folderId)}
      />
      {props.userId && props.orgId && props.shareTarget && (
        <ShareModal
          isOpen={true}
          onClose={() => props.onSetShareTarget(null)}
          targetId={props.shareTarget.targetId}
          targetType={props.shareTarget.targetType}
          targetName={props.shareTarget.targetName}
          userId={props.userId}
          orgId={props.orgId}
          currentSofiaUserId={props.user?.id}
          currentUserEmail={props.user?.email}
        />
      )}
      {props.userId && (
        <UnifiedSettingsModal
          isOpen={props.isUnifiedSettingsOpen}
          onClose={() => props.onSetUnifiedSettingsOpen(false)}
          userId={props.userId}
          userSettings={props.userSettings}
          onSaveSettings={props.onSetUserSettings}
          sofiaContext={props.sofiaContext}
          apiKey={GOOGLE_API_KEY}
          initialTab={props.activeSettingsTab}
        />
      )}
    </>
  );
}
