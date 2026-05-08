import { supabase } from '../../lib/supabase';
import { readCachedSettings, writeCachedSettings } from './cache';
import { defaultSettings, type UserAISettings } from './types';

export async function loadSettings(userId: string): Promise<UserAISettings> {
  const localData = readCachedSettings();

  try {
    const { data, error } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      if (error) console.warn('[settings-service] loadSettings error:', error.message);
      if (localData?.user_id === userId) return localData;
      return { user_id: userId, ...defaultSettings };
    }

    const cloudSettings = mapCloudSettings(data);
    if (localData?.user_id === userId && localData._synced === false) {
      console.log('[settings-service] Preserving unsynced local settings over cloud settings');
      return localData;
    }

    writeCachedSettings({ ...cloudSettings, _local_updated_at: Date.now(), _synced: true });
    return cloudSettings;
  } catch (err) {
    console.error('Error loading settings:', err);
    if (localData?.user_id === userId) return localData;
    return { user_id: userId, ...defaultSettings };
  }
}

function mapCloudSettings(data: any): UserAISettings {
  return {
    user_id: data.user_id,
    nickname: data.nickname || '',
    occupation: data.occupation || '',
    about_user: data.about_user || '',
    tone_style: data.tone_style || 'Profesional',
    char_emojis: data.char_emojis || 'Auto',
    custom_instructions: data.custom_instructions || '',
  };
}
