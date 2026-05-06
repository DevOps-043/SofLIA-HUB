/**
 * Normalización y deduplicación de conversaciones y mensajes.
 *
 * Funciones puras — sin efectos secundarios, sin acceso a red ni storage.
 * Esto las hace trivialmente testeables y reusables en cualquier capa.
 */

import type { ShareAccessLevel } from '../share-service';
import {
  ACTIVE_MODEL_PLACEHOLDER,
  MAX_CONVERSATIONS,
  type ChatMessage,
  type Conversation,
} from './types';

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
  share: {
    permission: 'view' | 'edit';
    shared_by_user_id: string;
    share_token?: string | null;
    created_at: string;
  },
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

  if (rightRank !== leftRank) {
    return rightRank > leftRank ? right : left;
  }

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
    if (!existing) {
      byId.set(normalized.id, normalized);
      continue;
    }

    byId.set(normalized.id, pickPreferredConversation(existing, normalized));
  }

  return Array.from(byId.values())
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime(),
    )
    .slice(0, MAX_CONVERSATIONS);
}

export function isPersistableMessage(raw: Partial<ChatMessage> & { id?: string | null }): boolean {
  const id = raw.id?.trim();
  if (!id) return false;

  const text = typeof raw.text === 'string' ? raw.text : '';
  const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];
  const isPlaceholderModelMessage =
    raw.role === 'model' &&
    text.trim() === ACTIVE_MODEL_PLACEHOLDER &&
    images.length === 0;

  if (isPlaceholderModelMessage) {
    return false;
  }

  return Boolean(text.trim() || images.length > 0);
}

export function normalizeMessage(
  raw: Partial<ChatMessage> & { id?: string | null },
): ChatMessage | null {
  if (!isPersistableMessage(raw)) {
    return null;
  }

  const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : undefined;
  const sources = Array.isArray(raw.sources) ? raw.sources.filter((s) => s?.uri) : undefined;

  return {
    id: raw.id!.trim(),
    role: raw.role === 'user' ? 'user' : 'model',
    text: typeof raw.text === 'string' ? raw.text : '',
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
    sources: sources && sources.length > 0 ? sources : undefined,
    images: images && images.length > 0 ? images : undefined,
    feedback: raw.feedback === 'like' || raw.feedback === 'dislike' ? raw.feedback : undefined,
  };
}

export function dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const rawMessage of messages) {
    const message = normalizeMessage(rawMessage);
    if (!message) continue;

    const existing = byId.get(message.id);
    if (!existing) {
      byId.set(message.id, message);
      continue;
    }

    const existingScore = `${existing.text || ''}|${existing.images?.length || 0}|${existing.sources?.length || 0}`.length;
    const nextScore = `${message.text || ''}|${message.images?.length || 0}|${message.sources?.length || 0}`.length;
    byId.set(message.id, nextScore >= existingScore ? message : existing);
  }

  return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
}
