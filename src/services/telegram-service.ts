import type { TelegramApi } from '../shared/legacy-communication';
export type { TelegramStatusSnapshot, TelegramBotInfo, TelegramRecentChat } from '../shared/legacy-communication';
declare global { interface Window { telegram?: TelegramApi } }

function getAPI() {
  if (!window.telegram) {
    throw new Error('Telegram API no disponible. Ejecuta SofLIA dentro de Electron.');
  }
  return window.telegram;
}

export function isTelegramAvailable(): boolean {
  return !!window.telegram;
}

export async function getTelegramStatus() {
  return getAPI().getStatus();
}

export async function updateTelegramConfig(updates: {
  enabled?: boolean;
  bot_token?: string;
  poll_interval_ms?: number;
  allowed_chat_ids?: string[];
  reset_offset?: boolean;
}) {
  return getAPI().updateConfig(updates);
}

export async function testTelegramConnection() {
  return getAPI().testConnection();
}

export async function sendTelegramMessage(chatId: string, text: string) {
  return getAPI().sendMessage(chatId, text);
}

export async function listTelegramRecentChats() {
  return getAPI().listRecentChats();
}
