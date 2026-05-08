import { useEffect } from 'react';
import { saveSettings, type UserAISettings } from '../../services/settings-service';
import type { ProactiveConfigState, SettingsFormState } from './types';

interface UseSettingsAutosaveInput {
  enabled: boolean;
  form: SettingsFormState;
  proactive: ProactiveConfigState;
  userId: string;
  onSave?: (settings: UserAISettings) => void;
  setSaving: (saving: boolean) => void;
}

export function useSettingsAutosave(input: UseSettingsAutosaveInput): void {
  const { enabled, form, proactive, userId, onSave, setSaving } = input;

  useEffect(() => {
    if (!enabled) return;
    const timeoutId = setTimeout(() => {
      setSaving(true);
      const settings = form.toUserSettings(userId);
      saveSettings(settings).then(async (success) => {
        if (success) {
          onSave?.(settings);
          await proactive.saveConfig();
        }
        setSaving(false);
      });
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [
    enabled,
    form.nickname,
    form.occupation,
    form.aboutUser,
    form.toneStyle,
    form.charEmojis,
    form.customInstructions,
    proactive.proactiveEnabled,
    proactive.notifHours,
    proactive.calendarReminders,
    proactive.taskReminders,
    proactive.systemAlerts,
    userId,
  ]);
}
