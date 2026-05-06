/**
 * Cola de cambios pendientes de sincronización con Supabase.
 *
 * Garantiza que las escrituras locales (mensajes, títulos, borrados) sobrevivan
 * desconexiones de red o cierres abruptos: se persisten en localStorage y se
 * reintenta el sync en cada `loadConversations`.
 *
 * Este módulo es el ÚNICO que conoce la estructura de PendingChatState en
 * storage. El resto del paquete usa la API exportada (queueXxx, clearXxx, getXxx).
 */

import { CACHE_KEYS, getPendingChatStateKey } from './cache';
import { dedupeConversations, dedupeMessages, normalizeConversation } from './normalize';
import type { ChatMessage, Conversation, PendingChatState } from './types';

function emptyPendingChatState(): PendingChatState {
  return {
    conversationUpserts: {},
    messageSnapshots: {},
    deletedConversationIds: [],
  };
}

export function readPendingChatState(userId: string): PendingChatState {
  try {
    const raw = localStorage.getItem(getPendingChatStateKey(userId));
    if (!raw) return emptyPendingChatState();

    const parsed = JSON.parse(raw);
    const state: PendingChatState = emptyPendingChatState();

    for (const conversation of Object.values(parsed?.conversationUpserts || {})) {
      const normalized = normalizeConversation(conversation as Record<string, unknown>);
      state.conversationUpserts[normalized.id] = normalized;
    }

    for (const [conversationId, messages] of Object.entries(parsed?.messageSnapshots || {})) {
      state.messageSnapshots[conversationId] = dedupeMessages((messages || []) as ChatMessage[]);
    }

    state.deletedConversationIds = Array.from(
      new Set(
        (parsed?.deletedConversationIds || []).filter(
          (id: unknown) => typeof id === 'string',
        ),
      ),
    );

    return state;
  } catch {
    return emptyPendingChatState();
  }
}

export function writePendingChatState(userId: string, state: PendingChatState): void {
  try {
    const hasEntries =
      Object.keys(state.conversationUpserts).length > 0 ||
      Object.keys(state.messageSnapshots).length > 0 ||
      state.deletedConversationIds.length > 0;

    if (!hasEntries) {
      localStorage.removeItem(getPendingChatStateKey(userId));
      return;
    }

    localStorage.setItem(getPendingChatStateKey(userId), JSON.stringify(state));
  } catch {
    /* degradación silenciosa: si localStorage falla, el sync se hará en la próxima sesión */
  }
}

function updatePendingChatState(
  userId: string,
  updater: (state: PendingChatState) => PendingChatState,
): PendingChatState {
  const next = updater(readPendingChatState(userId));
  writePendingChatState(userId, next);
  return next;
}

export function queueConversationUpsert(userId: string, conversation: Conversation): void {
  updatePendingChatState(userId, (state) => ({
    ...state,
    conversationUpserts: {
      ...state.conversationUpserts,
      [conversation.id]: normalizeConversation(conversation),
    },
    deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversation.id),
  }));
}

export function queueMessageSnapshot(
  userId: string,
  conversationId: string,
  messages: ChatMessage[],
): void {
  updatePendingChatState(userId, (state) => ({
    ...state,
    messageSnapshots: {
      ...state.messageSnapshots,
      [conversationId]: dedupeMessages(messages),
    },
    deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversationId),
  }));
}

export function queueConversationDelete(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => {
    const nextUpserts = { ...state.conversationUpserts };
    const nextSnapshots = { ...state.messageSnapshots };
    delete nextUpserts[conversationId];
    delete nextSnapshots[conversationId];

    return {
      conversationUpserts: nextUpserts,
      messageSnapshots: nextSnapshots,
      deletedConversationIds: Array.from(
        new Set([...state.deletedConversationIds, conversationId]),
      ),
    };
  });
}

export function clearPendingConversationUpsert(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => {
    const next = { ...state.conversationUpserts };
    delete next[conversationId];
    return { ...state, conversationUpserts: next };
  });
}

export function clearPendingMessageSnapshot(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => {
    const next = { ...state.messageSnapshots };
    delete next[conversationId];
    return { ...state, messageSnapshots: next };
  });
}

export function clearPendingConversationDelete(userId: string, conversationId: string): void {
  updatePendingChatState(userId, (state) => ({
    ...state,
    deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversationId),
  }));
}

export function getPendingConversationUpserts(userId: string): Conversation[] {
  return dedupeConversations(Object.values(readPendingChatState(userId).conversationUpserts));
}

export function getPendingMessageSnapshot(
  userId: string,
  conversationId: string,
): ChatMessage[] {
  return dedupeMessages(readPendingChatState(userId).messageSnapshots[conversationId] || []);
}

export function getDeletedConversationIds(userId: string): Set<string> {
  return new Set(readPendingChatState(userId).deletedConversationIds);
}

/**
 * Limpia rastros de una conversación específica de TODOS los pending states
 * (necesario al borrar una conversación compartida).
 */
export function purgeConversationFromAllPendingStates(conversationId: string): void {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(CACHE_KEYS.PENDING_PREFIX)) continue;

      const userId = key.slice(CACHE_KEYS.PENDING_PREFIX.length);
      if (!userId) continue;

      const state = readPendingChatState(userId);
      const nextUpserts = { ...state.conversationUpserts };
      const nextSnapshots = { ...state.messageSnapshots };
      delete nextUpserts[conversationId];
      delete nextSnapshots[conversationId];

      writePendingChatState(userId, {
        conversationUpserts: nextUpserts,
        messageSnapshots: nextSnapshots,
        deletedConversationIds: state.deletedConversationIds.filter((id) => id !== conversationId),
      });
    }
  } catch {
    /* no bloquear borrado por errores aquí */
  }
}
