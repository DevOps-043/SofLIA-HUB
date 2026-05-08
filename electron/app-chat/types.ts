export interface AppChatConversationRow {
  id: string;
  user_id: string;
  title: string;
  folder_id?: string | null;
  org_id?: string | null;
  is_pinned?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface AppChatConversationSummary {
  id: string;
  title: string;
  folder_id?: string | null;
  org_id?: string | null;
  created_at: string;
  updated_at: string;
  permission: 'owner' | 'edit' | 'view';
  is_shared: boolean;
  owner_user_id: string;
}

export interface AppChatContextMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  created_at: string;
  sources_count: number;
  images_count: number;
  feedback?: 'like' | 'dislike';
}

export interface AppChatAssetSummary {
  asset_ref: string;
  file_name: string;
  created_at: string;
  kind: 'workspace_source' | 'message_image';
  sendable: boolean;
  source_type?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  external_url?: string | null;
}

export interface ResolvedWhatsAppUser {
  userId: string;
  email: string | null;
  fullName: string | null;
  orgIds: string[];
}

export interface PreparedAppChatAsset {
  localPath: string;
  caption: string;
  cleanupAfterSend: boolean;
}

export interface InternalAssetRecord extends AppChatAssetSummary {
  message_id?: string;
  image_data?: string | null;
  storage_path?: string | null;
  external_file_id?: string | null;
}
