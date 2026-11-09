import { hasSameChatContent } from '../content-comparison';
import type { ChatMessage, Conversation, PendingChatState } from '../types';
import { readPendingChatState, writePendingChatState } from './state-store';

function currentConversation(state: PendingChatState, expected: Conversation): boolean {
  return !state.deletedConversationIds.includes(expected.id) && hasSameChatContent(state.conversationUpserts[expected.id], expected);
}
function currentMessages(state: PendingChatState, id: string, expected: ChatMessage[]): boolean {
  return !state.deletedConversationIds.includes(id) && hasSameChatContent(state.messageSnapshots[id], expected);
}
export function isCurrentConversationUpsert(userId: string, expected: Conversation): boolean {
  return currentConversation(readPendingChatState(userId), expected);
}
export function isCurrentMessageSnapshot(userId: string, id: string, expected: ChatMessage[]): boolean {
  return currentMessages(readPendingChatState(userId), id, expected);
}
export function isCurrentConversationDelete(userId: string, id: string): boolean {
  return readPendingChatState(userId).deletedConversationIds.includes(id);
}

// Lectura, comparación y escritura sin await: reconocimiento local en este renderer.
export function clearPendingConversationUpsert(userId: string, id: string, expected: Conversation): boolean {
  const state = readPendingChatState(userId);
  if (id !== expected.id || !currentConversation(state, expected)) return false;
  const next = { ...state.conversationUpserts }; delete next[id];
  return writePendingChatState(userId, { ...state, conversationUpserts: next });
}
export function clearPendingMessageSnapshot(userId: string, id: string, expected: ChatMessage[]): boolean {
  const state = readPendingChatState(userId);
  if (!currentMessages(state, id, expected)) return false;
  const next = { ...state.messageSnapshots }; delete next[id];
  return writePendingChatState(userId, { ...state, messageSnapshots: next });
}
export function clearPendingConversationDelete(userId: string, id: string): boolean {
  const state = readPendingChatState(userId);
  if (!state.deletedConversationIds.includes(id)) return false;
  // En legado contradictorio el borrado también invalida payloads del mismo ID.
  const upserts = { ...state.conversationUpserts }, snapshots = { ...state.messageSnapshots };
  delete upserts[id]; delete snapshots[id];
  return writePendingChatState(userId, { conversationUpserts: upserts, messageSnapshots: snapshots,
    deletedConversationIds: state.deletedConversationIds.filter(value => value !== id) });
}
