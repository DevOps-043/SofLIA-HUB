import type { TelegramState } from './types';

export function ensureTelegramConfigured(state: TelegramState): void {
  if (!state.config.botToken.trim()) {
    throw new Error('Configura el bot token de Telegram antes de usar este canal.');
  }
}

export async function callTelegramApi(
  state: TelegramState,
  method: string,
  payload: Record<string, any>,
): Promise<any> {
  const response = await fetch(`https://api.telegram.org/bot${state.config.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const parsed = await response.json();
  if (!response.ok || !parsed?.ok) {
    throw new Error(parsed?.description || `Telegram API devolvio HTTP ${response.status}.`);
  }
  return parsed;
}
