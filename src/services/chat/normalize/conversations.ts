import type { ShareAccessLevel } from '../../share-service';
import { MAX_CONVERSATIONS, type Conversation } from '../types';

function getAccessRank(access: ShareAccessLevel | undefined): number {
  if (access === 'owner') return 3;
  if (access === 'edit') return 2;
  return 1;
}

export function normalizeConversation(raw: Record<string, unknown> | Conversation): Conversation {
  const r = raw as Record<string, unknown>;
  const isShared = (r.is_shared ?? false) as boolean;
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    title: (r.title as string) || 'Nueva conversacion',
    folder_id: (r.folder_id as string | null) ?? undefined,
    org_id: (r.org_id as string | null) ?? undefined,
    is_pinned: (r.is_pinned as boolean | null) ?? undefined,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    is_shared: isShared,
    share_permission: (r.share_permission as ShareAccessLevel) ?? (isShared ? 'view' : 'owner'),
    can_edit: (r.can_edit as boolean) ?? (!isShared || r.share_permission === 'edit'),
    can_share: (r.can_share as boolean) ?? !isShared,
    shared_by_user_id: (r.shared_by_user_id as string | null) ?? undefined,
    share_token: (r.share_token as string | null) ?? null,
    shared_at: (r.shared_at as string | null) ?? undefined,
  };
}

export function decorateOwnedConversation(
  raw: Record<string, unknown>,
  activeShare?: { share_token?: string | null; created_at: string } | null,
): Conversation {
  return normalizeConversation({
    ...raw,
    is_shared: Boolean(activeShare),
    share_permission: 'owner',
    can_edit: true,
    can_share: true,
    shared_by_user_id: undefined,
    share_token: activeShare?.share_token ?? null,
    shared_at: activeShare?.created_at ?? undefined,
  });
}

export function decorateSharedConversation(
  raw: Record<string, unknown>,
  share: { permission: 'view' | 'edit'; shared_by_user_id: string; share_token?: string | null; created_at: string },
): Conversation {
  return normalizeConversation({
    ...raw,
    is_shared: true,
    share_permission: share.permission,
    can_edit: share.permission === 'edit',
    can_share: false,
    shared_by_user_id: share.shared_by_user_id,
    share_token: share.share_token ?? null,
    shared_at: share.created_at,
  });
}

function pickPreferredConversation(left: Conversation, right: Conversation): Conversation {
  const leftRank = getAccessRank(left.share_permission);
  const rightRank = getAccessRank(right.share_permission);
  if (rightRank !== leftRank) return rightRank > leftRank ? right : left;

  const existingUpdated = new Date(left.updated_at || left.created_at || 0).getTime();
  const nextUpdated = new Date(right.updated_at || right.created_at || 0).getTime();
  return nextUpdated >= existingUpdated ? right : left;
}

export function dedupeConversations(conversations: Conversation[]): Conversation[] {
  const byId = new Map<string, Conversation>();

  for (const conversation of conversations) {
    if (!conversation?.id) continue;
    const normalized = normalizeConversation(conversation);
    const existing = byId.get(normalized.id);
    byId.set(normalized.id, existing ? pickPreferredConversation(existing, normalized) : normalized);
  }

  return Array.from(byId.values())
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, MAX_CONVERSATIONS);
}
