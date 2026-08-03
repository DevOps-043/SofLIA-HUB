export interface TelegramRecentChat {
  chatId: string;
  title: string;
  username?: string | null;
  type: string;
  lastMessageAt: string;
  lastMessagePreview: string;
}

export interface TelegramBotInfo {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramStatusSnapshot {
  success: boolean;
  configured: boolean;
  enabled: boolean;
  polling: boolean;
  poll_interval_ms: number;
  allowed_chat_ids: string[];
  last_poll_at: string | null;
  last_error: string | null;
  bot: TelegramBotInfo | null;
  recent_chats: TelegramRecentChat[];
  available_agents: Array<{
    id: string;
    command: string;
    description: string;
  }>;
  error?: string;
}

declare global {
  interface Window {
    telegram?: {
      getStatus: () => Promise<TelegramStatusSnapshot>;
      updateConfig: (updates: {
        enabled?: boolean;
        bot_token?: string;
        poll_interval_ms?: number;
        allowed_chat_ids?: string[];
        reset_offset?: boolean;
      }) => Promise<TelegramStatusSnapshot>;
      testConnection: () => Promise<{ success: boolean; bot?: TelegramBotInfo; error?: string }>;
      sendMessage: (chatId: string, text: string) => Promise<{ success: boolean; message?: unknown; error?: string }>;
      listRecentChats: () => Promise<{ success: boolean; chats?: TelegramRecentChat[]; error?: string }>;
    };
  }
}

function getAPI() {
  if (!window.telegram) {
    throw new Error('Telegram API no disponible. Ejecuta Pulse dentro de Electron.');
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
