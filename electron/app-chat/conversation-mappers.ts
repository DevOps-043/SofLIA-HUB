import type { AppChatConversationRow, AppChatConversationSummary } from './types';

export function getPermissionRank(permission: 'owner' | 'edit' | 'view'): number {
  if (permission === 'owner') return 3;
  if (permission === 'edit') return 2;
  return 1;
}

export function rowToConversationSummary(
  row: AppChatConversationRow,
  permission: 'owner' | 'edit' | 'view',
  isShared: boolean,
): AppChatConversationSummary {
  return {
    id: row.id,
    title: row.title || 'Nueva conversacion',
    folder_id: row.folder_id ?? null,
    org_id: row.org_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    permission,
    is_shared: isShared,
    owner_user_id: row.user_id,
  };
}

export function unwrapConversationRow(value: any): AppChatConversationRow | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.id ? row as AppChatConversationRow : null;
}

export function dedupeConversations(conversations: AppChatConversationSummary[]): AppChatConversationSummary[] {
  const byId = new Map<string, AppChatConversationSummary>();
  for (const conversation of conversations) {
    const existing = byId.get(conversation.id);
    if (!existing) {
      byId.set(conversation.id, conversation);
      continue;
    }

    const existingRank = getPermissionRank(existing.permission);
    const nextRank = getPermissionRank(conversation.permission);
    const existingUpdated = new Date(existing.updated_at || existing.created_at || 0).getTime();
    const nextUpdated = new Date(conversation.updated_at || conversation.created_at || 0).getTime();
    if (nextRank > existingRank || (nextRank === existingRank && nextUpdated >= existingUpdated)) {
      byId.set(conversation.id, conversation);
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) =>
      new Date(right.updated_at || right.created_at).getTime() -
      new Date(left.updated_at || left.created_at).getTime(),
  );
}
