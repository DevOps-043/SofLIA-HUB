import type { OrgMember } from '../../services/org-service';
import type {
  ConversationShare,
  FolderShare,
  SharePermission,
  ShareTargetType,
} from '../../services/share-service';

export type ShareTab = 'members' | 'link';
export type ShareRecord = ConversationShare | FolderShare;

export type MemberWithLia = OrgMember & {
  shareTargetUserId?: string;
  liaisonUserId?: string;
  liaisonEmail?: string;
};

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ShareTargetType;
  targetName: string;
  userId: string;
  orgId: string;
  currentSofiaUserId?: string | null;
  currentUserEmail?: string | null;
}

export type SharePermissionState = SharePermission;
