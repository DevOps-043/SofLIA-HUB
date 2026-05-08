import { ensureTelegramConfigured } from './api';
import { handleIncomingTelegramCommand } from './commands';
import { isTelegramChatAllowed, recordRecentTelegramChat } from './recent-chats';
import type { TelegramRuntimeContext } from './types';

export async function syncTelegramPolling(context: TelegramRuntimeContext): Promise<void> {
  if (!context.state.config.enabled || !context.state.config.botToken.trim()) {
    stopTelegramPolling(context);
    return;
  }
  await refreshTelegramBotInfo(context);
  startTelegramPolling(context);
}

export function stopTelegramPolling(context: TelegramRuntimeContext): void {
  context.setStopRequested(true);
  context.setPolling(false);
}

async function refreshTelegramBotInfo(context: TelegramRuntimeContext): Promise<void> {
  ensureTelegramConfigured(context.state);
  const me = await context.callTelegram('getMe', {});
  context.state.botInfo = me.result;
  context.state.lastError = null;
  context.saveState();
}

function startTelegramPolling(context: TelegramRuntimeContext): void {
  if (context.isPolling()) return;
  context.setPolling(true);
  context.setStopRequested(false);
  void pollLoop(context);
}

async function pollLoop(context: TelegramRuntimeContext): Promise<void> {
  while (!context.isStopRequested()) {
    try {
      await fetchTelegramUpdates(context);
    } catch (error: any) {
      context.state.lastError = error?.message || String(error);
      context.saveState();
    }
    await delay(context.state.config.pollIntervalMs);
  }
}

async function fetchTelegramUpdates(context: TelegramRuntimeContext): Promise<void> {
  ensureTelegramConfigured(context.state);
  const response = await context.callTelegram('getUpdates', {
    offset: context.state.lastUpdateId + 1,
    timeout: 0,
    allowed_updates: ['message'],
  });
  const updates = Array.isArray(response.result) ? response.result : [];
  if (updates.length === 0) {
    context.state.lastPollAt = new Date().toISOString();
    context.saveState();
    return;
  }
  for (const update of updates) await processTelegramUpdate(context, update);
  context.state.lastPollAt = new Date().toISOString();
  context.state.lastError = null;
  context.saveState();
}

async function processTelegramUpdate(context: TelegramRuntimeContext, update: any): Promise<void> {
  const updateId = Number(update.update_id) || 0;
  if (updateId > context.state.lastUpdateId) context.state.lastUpdateId = updateId;
  const message = update.message;
  const chat = message?.chat;
  const text = typeof message?.text === 'string' ? message.text.trim() : '';
  const chatId = String(chat?.id || '');
  if (!chatId || !text) return;
  recordRecentTelegramChat(context.state, chat, text, message.date);
  if (isTelegramChatAllowed(context.state, chatId)) {
    await handleIncomingTelegramCommand(context, chatId, text);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
