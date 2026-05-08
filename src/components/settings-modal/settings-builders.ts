import type { UserAISettings } from '../../services/settings-service';
import type { IdentitySettingsState } from './types';

export function toUserSettings(userId: string, state: IdentitySettingsState): UserAISettings {
  return {
    user_id: userId,
    nickname: state.nickname,
    occupation: state.occupation,
    about_user: state.aboutUser,
    tone_style: state.toneStyle,
    char_emojis: state.charEmojis,
    custom_instructions: state.customInstructions,
  };
}

export function toProactiveUpdates(input: {
  proactiveEnabled: boolean;
  notifHours: number[];
  calendarReminders: boolean;
  taskReminders: boolean;
  systemAlerts: boolean;
}): Record<string, any> {
  return {
    enabled: input.proactiveEnabled,
    notificationHours: input.notifHours,
    calendarReminders: input.calendarReminders,
    taskReminders: input.taskReminders,
    systemAlerts: input.systemAlerts,
  };
}
