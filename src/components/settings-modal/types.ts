import type { Dispatch, SetStateAction } from 'react';
import type { UserAISettings } from '../../services/settings-service';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSave?: (settings: UserAISettings) => void;
  embedded?: boolean;
}

export interface IdentitySettingsState {
  nickname: string;
  occupation: string;
  aboutUser: string;
  toneStyle: string;
  charEmojis: string;
  customInstructions: string;
}

export interface SettingsFormState extends IdentitySettingsState {
  loading: boolean;
  isInitialized: boolean;
  setNickname: Dispatch<SetStateAction<string>>;
  setOccupation: Dispatch<SetStateAction<string>>;
  setAboutUser: Dispatch<SetStateAction<string>>;
  setToneStyle: Dispatch<SetStateAction<string>>;
  setCharEmojis: Dispatch<SetStateAction<string>>;
  setCustomInstructions: Dispatch<SetStateAction<string>>;
  toUserSettings: (userId: string) => UserAISettings;
}

export interface ProactiveConfigState {
  available: boolean;
  proactiveEnabled: boolean;
  notifHours: number[];
  calendarReminders: boolean;
  taskReminders: boolean;
  systemAlerts: boolean;
  proactiveTesting: boolean;
  proactiveTestResult: string;
  setProactiveEnabled: Dispatch<SetStateAction<boolean>>;
  setCalendarReminders: Dispatch<SetStateAction<boolean>>;
  setTaskReminders: Dispatch<SetStateAction<boolean>>;
  setSystemAlerts: Dispatch<SetStateAction<boolean>>;
  toggleHour: (hour: number) => void;
  testNotification: () => Promise<void>;
  saveConfig: () => Promise<void>;
}
