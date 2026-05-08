export interface UserAISettings {
  user_id: string;
  nickname: string;
  occupation: string;
  about_user: string;
  tone_style: string;
  char_emojis: string;
  custom_instructions: string;
}

export interface CachedUserAISettings extends UserAISettings {
  _local_updated_at?: number;
  _synced?: boolean;
}

export const defaultSettings: Omit<UserAISettings, 'user_id'> = {
  nickname: '',
  occupation: '',
  about_user: '',
  tone_style: 'Profesional',
  char_emojis: 'Auto',
  custom_instructions: '',
};
