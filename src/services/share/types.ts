export type ShareTargetType = 'conversation' | 'folder';
export type SharePermission = 'view' | 'edit';
export type ShareAccessLevel = 'owner' | SharePermission;

export interface LiaProfile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
}

export interface ShareRecordBase {
  id: string;
  shared_by_user_id: string;
  shared_with_user_id: string | null;
  org_id: string;
  permission: SharePermission;
  share_token?: string | null;
  is_active: boolean;
  created_at: string;
  revoked_at?: string | null;
}

export interface ConversationShare extends ShareRecordBase {
  conversation_id: string;
}

export interface FolderShare extends ShareRecordBase {
  folder_id: string;
}

export interface AccessibleConversationShare extends ConversationShare {
  conversation?: Record<string, any> | null;
}

export interface AccessibleFolderShare extends FolderShare {
  folder?: Record<string, any> | null;
}

export interface ResolvedShareTarget {
  targetType: ShareTargetType;
  targetId: string;
  permission: SharePermission;
  shareToken: string;
  orgId: string;
}
