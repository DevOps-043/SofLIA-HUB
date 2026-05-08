import type { ConversationShare, FolderShare, LiaProfile } from './types';

export function normalizeEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function normalizeShareToken(shareTokenOrUrl: string): string | null {
  const rawValue = shareTokenOrUrl?.trim();
  if (!rawValue) return null;
  if (rawValue.startsWith('soflia://share/')) {
    return rawValue.slice('soflia://share/'.length).trim() || null;
  }
  return rawValue;
}

export function normalizeUserIds(userIds: string | string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [userIds])
        .map((userId) => userId?.trim())
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );
}

export function normalizeProfile(raw: any): LiaProfile {
  return {
    id: raw.id,
    email: raw.email ?? null,
    full_name: raw.full_name ?? null,
    avatar_url: raw.avatar_url ?? null,
    username: raw.username ?? null,
  };
}

export function normalizeConversationShare(raw: any): ConversationShare {
  return {
    id: raw.id,
    conversation_id: raw.conversation_id,
    shared_by_user_id: raw.shared_by_user_id ?? raw.shared_by,
    shared_with_user_id: raw.shared_with_user_id ?? null,
    org_id: raw.org_id,
    permission: raw.permission === 'edit' ? 'edit' : 'view',
    share_token: raw.share_token ?? null,
    is_active: raw.is_active ?? true,
    created_at: raw.created_at,
    revoked_at: raw.revoked_at ?? null,
  };
}

export function normalizeFolderShare(raw: any): FolderShare {
  return {
    id: raw.id,
    folder_id: raw.folder_id,
    shared_by_user_id: raw.shared_by_user_id ?? raw.shared_by,
    shared_with_user_id: raw.shared_with_user_id ?? null,
    org_id: raw.org_id,
    permission: raw.permission === 'edit' ? 'edit' : 'view',
    share_token: raw.share_token ?? null,
    is_active: raw.is_active ?? true,
    created_at: raw.created_at,
    revoked_at: raw.revoked_at ?? null,
  };
}
