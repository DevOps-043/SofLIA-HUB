import type { CachedUserAISettings, UserAISettings } from './types';

export const SETTINGS_CACHE_KEY = 'lia_user_settings';

export function readCachedSettings(): CachedUserAISettings | null {
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function writeCachedSettings(settings: CachedUserAISettings): void {
  localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
}

export function getCachedSettings(): UserAISettings | null {
  return readCachedSettings();
}

export function migrateLegacySettingsCache(sourceUserId: string, targetUserId: string): void {
  if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) return;

  try {
    const cached = readCachedSettings();
    if (cached?.user_id !== sourceUserId) return;
    writeCachedSettings({ ...cached, user_id: targetUserId });
  } catch {}
}
