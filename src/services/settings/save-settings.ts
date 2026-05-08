import { supabase } from '../../lib/supabase';
import { writeCachedSettings } from './cache';
import type { UserAISettings } from './types';

export async function saveSettings(settings: UserAISettings): Promise<boolean> {
  writeCachedSettings({ ...settings, _local_updated_at: Date.now(), _synced: false });

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
        { onConflict: 'user_id' },
      );

    if (error) {
      console.error('[settings-service] saveSettings Supabase FAILED (localStorage saved):', error.message);
      return true;
    }

    writeCachedSettings({ ...settings, _local_updated_at: Date.now(), _synced: true });
    return true;
  } catch (err) {
    console.error('[settings-service] saveSettings exception (localStorage saved):', err);
    return true;
  }
}
