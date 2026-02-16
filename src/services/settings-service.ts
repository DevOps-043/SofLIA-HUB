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
  try {
    const { data, error } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Try localStorage cache
      const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.user_id === userId) return parsed;
      }
      return { user_id: userId, ...defaultSettings };
    }

    const settings: UserAISettings = {
      user_id: data.user_id,
      nickname: data.nickname || '',
      occupation: data.occupation || '',
      about_user: data.about_user || '',
      tone_style: data.tone_style || 'Profesional',
      char_emojis: data.char_emojis || 'Auto',
      custom_instructions: data.custom_instructions || '',
    };

    // Cache locally
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    return settings;
  } catch (err) {
    console.error('Error loading settings:', err);
    return { user_id: userId, ...defaultSettings };
  }
}

/**
 * Save user settings to Supabase and localStorage cache.
 */
export async function saveSettings(settings: UserAISettings): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_ai_settings')
      .upsert(
        {
          ...settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving settings:', error);
      return false;
    }

    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error('Error saving settings:', err);
    return false;
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
