import type { TelegramRecentChat, TelegramState } from './types';

export function isTelegramChatAllowed(state: TelegramState, chatId: string): boolean {
  if (state.config.allowedChatIds.length === 0) return true;
  return state.config.allowedChatIds.includes(chatId);
}

export function recordRecentTelegramChat(
  state: TelegramState,
  chat: any,
  text: string,
  unixTimestamp?: number,
): void {
  const chatId = String(chat?.id || '');
  if (!chatId) return;
  const title = String(chat?.title || [chat?.first_name, chat?.last_name].filter(Boolean).join(' ') || chat?.username || chatId);
  const nextRecord: TelegramRecentChat = {
    chatId,
    title,
    username: chat?.username ? String(chat.username) : null,
    type: String(chat?.type || 'unknown'),
    lastMessageAt: unixTimestamp ? new Date(Number(unixTimestamp) * 1000).toISOString() : new Date().toISOString(),
    lastMessagePreview: text.slice(0, 160),
  };
  state.recentChats = [
    nextRecord,
    ...state.recentChats.filter((candidate) => candidate.chatId !== chatId),
  ].slice(0, 50);
}
