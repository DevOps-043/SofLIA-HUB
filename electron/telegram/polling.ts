import { ensureTelegramConfigured } from './api';
import { handleIncomingTelegramCommand } from './commands';
import { resolveUserId } from './messages';
import { isTelegramChatAllowed, recordRecentTelegramChat } from './recent-chats';
import {
  extractTelegramAudio,
  handleTelegramVoiceMessage,
  type TelegramIncomingAudio,
} from './voice';
import { voiceCallSessions } from '../voice-call/session-store';
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
  // Sin polling no hay turnos que atender: dejar sesiones de voz abiertas solo
  // serviria para hablar por un canal que ya no escucha.
  voiceCallSessions.closeChannel('telegram');
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
  const audio = extractTelegramAudio(message);
  const chatId = String(chat?.id || '');
  if (!chatId || (!text && !audio)) return;

  const isGroup = String(chat?.type || '').endsWith('group');
  recordRecentTelegramChat(context.state, chat, text || '[nota de voz]', message.date);
  if (!isTelegramChatAllowed(context.state, chatId) || !await isTelegramPrincipalAllowed(context, chatId)) return;

  if (audio) {
    await handleIncomingTelegramVoice(context, chatId, isGroup, audio);
    return;
  }
  await handleIncomingTelegramCommand(context, chatId, text, isGroup);
}

/**
 * La transcripcion entra por el loop del agente, no por el dispatcher de
 * comandos: hablarle es pedirle algo, y el catalogo completo de herramientas
 * vive detras de ese loop.
 */
async function handleIncomingTelegramVoice(
  context: TelegramRuntimeContext,
  chatId: string,
  isGroup: boolean,
  audio: TelegramIncomingAudio,
): Promise<void> {
  const runSkillTurn = context.deps?.runSkillTurn;
  if (!runSkillTurn) {
    await context.sendMessage(chatId, 'El agente todavia no esta listo. Intentalo en unos segundos.');
    return;
  }
  await handleTelegramVoiceMessage({
    context,
    chatId,
    isGroup,
    audio,
    runTurn: (transcription) => runSkillTurn({
      chatId,
      userId: resolveUserId(context, chatId),
      prompt: transcription,
      isGroup,
    }),
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isTelegramPrincipalAllowed(context: TelegramRuntimeContext, chatId: string): Promise<boolean> {
  if (!context.deps?.communicationHubService) return true;
  return context.deps.communicationHubService.isTelegramChatAuthorized(chatId);
}
