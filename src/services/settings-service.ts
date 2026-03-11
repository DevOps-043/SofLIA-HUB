import { supabase } from '../lib/supabase';

export interface UserAISettings {
  user_id: string;
  nickname: string;
  occupation: string;
  about_user: string;
  tone_style: string;
  char_emojis: string;
  custom_instructions: string;
}

const SETTINGS_CACHE_KEY = 'lia_user_settings';

const defaultSettings: Omit<UserAISettings, 'user_id'> = {
  nickname: '',
  occupation: '',
  about_user: '',
  tone_style: 'Profesional',
  char_emojis: 'Auto',
  custom_instructions: '',
};

/**
 * Load user settings from Supabase, with localStorage cache fallback.
 */
export async function loadSettings(userId: string): Promise<UserAISettings> {
  // First, check local cache to see if we have unsynced changes
  const cachedStr = localStorage.getItem(SETTINGS_CACHE_KEY);
  let localData: any = null;
  if (cachedStr) {
    try {
      localData = JSON.parse(cachedStr);
    } catch (e) {}
  }

  try {
    const { data, error } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      if (error) {
        console.warn('[settings-service] loadSettings error:', error.message);
      }
      if (localData && localData.user_id === userId) return localData;
      return { user_id: userId, ...defaultSettings };
    }

    const cloudSettings: UserAISettings = {
      user_id: data.user_id,
      nickname: data.nickname || '',
      occupation: data.occupation || '',
      about_user: data.about_user || '',
      tone_style: data.tone_style || 'Profesional',
      char_emojis: data.char_emojis || 'Auto',
      custom_instructions: data.custom_instructions || '',
    };

    // If local data exists and is explicitly marked as NOT synced, DO NOT OVERWRITE with stale cloud data.
    if (localData && localData.user_id === userId && localData._synced === false) {
      console.log('[settings-service] Preserving unsynced local settings over cloud settings');
      return localData;
    }

    // Otherwise, cloud is the source of truth, cache it locally
    const syncedSettings = { ...cloudSettings, _local_updated_at: Date.now(), _synced: true };
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(syncedSettings));
    return cloudSettings;

  } catch (err) {
    console.error('Error loading settings:', err);
    if (localData && localData.user_id === userId) return localData;
    return { user_id: userId, ...defaultSettings };
  }
}

/**
 * Save user settings to Supabase and localStorage cache.
 */
export async function saveSettings(settings: UserAISettings): Promise<boolean> {
  // Save to localStorage first. Add a local-only timestamp so we know when we last modified it.
  const localSettings = { ...settings, _local_updated_at: Date.now(), _synced: false };
  localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(localSettings));

  try {
    const { error } = await supabase
      .from('user_ai_settings')
      .upsert(
        {
          user_id: settings.user_id,
          nickname: settings.nickname,
          occupation: settings.occupation,
          about_user: settings.about_user,
          tone_style: settings.tone_style,
          char_emojis: settings.char_emojis,
          custom_instructions: settings.custom_instructions,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[settings-service] saveSettings Supabase FAILED (localStorage saved):', error.message);
      return true; // Return true because it persisted locally
    }

    // Mark as synced locally
    const syncedSettings = { ...settings, _local_updated_at: Date.now(), _synced: true };
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(syncedSettings));

    return true;
  } catch (err) {
    console.error('[settings-service] saveSettings exception (localStorage saved):', err);
    return true;
  }
}

/**
 * Get cached settings from localStorage (synchronous, for quick access).
 */
export function getCachedSettings(): UserAISettings | null {
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}
