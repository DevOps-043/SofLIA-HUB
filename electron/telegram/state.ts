import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { TelegramConfigUpdates, TelegramState } from './types';

export const DEFAULT_TELEGRAM_STATE: TelegramState = {
  config: { enabled: false, botToken: '', pollIntervalMs: 8000, allowedChatIds: [] },
  lastUpdateId: 0,
  recentChats: [],
  lastPollAt: null,
  lastError: null,
  botInfo: null,
};

export function getTelegramStatePath(): string {
  return path.join(app.getPath('userData'), 'telegram-state.json');
}

export function loadTelegramState(saveFallback: (state: TelegramState) => void): TelegramState {
  try {
    const statePath = getTelegramStatePath();
    if (!fs.existsSync(statePath)) {
      const fallback = structuredClone(DEFAULT_TELEGRAM_STATE);
      saveFallback(fallback);
      return fallback;
    }
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Partial<TelegramState>;
    return {
      config: {
        enabled: parsed.config?.enabled ?? DEFAULT_TELEGRAM_STATE.config.enabled,
        botToken: parsed.config?.botToken || '',
        pollIntervalMs: parsed.config?.pollIntervalMs || DEFAULT_TELEGRAM_STATE.config.pollIntervalMs,
        allowedChatIds: Array.isArray(parsed.config?.allowedChatIds)
          ? parsed.config!.allowedChatIds.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
      },
      lastUpdateId: parsed.lastUpdateId || 0,
      recentChats: Array.isArray(parsed.recentChats) ? parsed.recentChats : [],
      lastPollAt: parsed.lastPollAt || null,
      lastError: parsed.lastError || null,
      botInfo: parsed.botInfo || null,
    };
  } catch (error) {
    console.error('[TelegramService] No se pudo cargar el estado:', error);
    const fallback = structuredClone(DEFAULT_TELEGRAM_STATE);
    saveFallback(fallback);
    return fallback;
  }
}

export function saveTelegramState(state: TelegramState): void {
  const statePath = getTelegramStatePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

export function applyTelegramConfigUpdates(state: TelegramState, updates: TelegramConfigUpdates): void {
  if (typeof updates.enabled === 'boolean') state.config.enabled = updates.enabled;
  if (typeof updates.bot_token === 'string') state.config.botToken = updates.bot_token.trim();
  if (typeof updates.poll_interval_ms === 'number' && Number.isFinite(updates.poll_interval_ms)) {
    state.config.pollIntervalMs = Math.max(2000, Math.round(updates.poll_interval_ms));
  }
  if (Array.isArray(updates.allowed_chat_ids)) {
    state.config.allowedChatIds = updates.allowed_chat_ids.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (updates.reset_offset) state.lastUpdateId = 0;
}
