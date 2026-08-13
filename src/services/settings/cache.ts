import { scopedPreferenceKey } from '../user-scope';
import type { CachedUserAISettings, UserAISettings } from './types';

export const SETTINGS_CACHE_KEY = 'lia_user_settings';

/**
 * El cache guarda datos personales (apodo, ocupacion, notas e instrucciones
 * propias), asi que va acotado al usuario activo: en una clave global el
 * siguiente usuario del equipo heredaba el perfil del anterior y sus prompts se
 * construian con el.
 */
function settingsCacheKey(): string {
  return scopedPreferenceKey(SETTINGS_CACHE_KEY);
}

export function readCachedSettings(): CachedUserAISettings | null {
  try {
    const cached = localStorage.getItem(settingsCacheKey());
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function writeCachedSettings(settings: CachedUserAISettings): void {
  try {
    localStorage.setItem(settingsCacheKey(), JSON.stringify(settings));
  } catch {
    // Sin persistencia el ajuste sigue vigente en memoria y en Supabase.
  }
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
