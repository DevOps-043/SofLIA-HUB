import type { ShareAccessLevel } from '../share-service';

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  org_id?: string;
  created_at: string;
  updated_at: string;
  is_shared?: boolean;
  share_permission?: ShareAccessLevel;
  can_edit?: boolean;
  can_share?: boolean;
  shared_by_user_id?: string;
  share_token?: string | null;
  shared_at?: string;
}

export interface OutgoingFolderShareSnapshot {
  share_token?: string | null;
  created_at: string;
}

export interface SharedFolderAccessSnapshot {
  permission: 'view' | 'edit';
  shared_by_user_id: string;
  share_token?: string | null;
  created_at: string;
}
