import type { useAuth } from '../contexts/AuthContext';
import type { useChatManager } from '../hooks/useChatManager';
import type { useFolderManager } from '../hooks/useFolderManager';
import type { useIrisData } from '../hooks/useIrisData';
import type { SettingsTab } from '../components/UnifiedSettingsModal';
import type { ShareTargetType } from '../services/share-service';
import type { UserAISettings } from '../services/settings-service';

export type ActiveView = 'chat' | 'project' | 'productivity' | 'sdo' | 'meetings' | 'browser';
export type AuthState = ReturnType<typeof useAuth>;
export type ChatState = ReturnType<typeof useChatManager>;
export type FolderState = ReturnType<typeof useFolderManager>;
export type IrisState = ReturnType<typeof useIrisData>;

export interface ShareTarget {
  targetId: string;
  targetType: ShareTargetType;
  targetName: string;
}

export interface ShareLinkNotice {
  tone: 'info' | 'error';
  message: string;
}

export interface SettingsModalState {
  activeSettingsTab: SettingsTab;
  isUnifiedSettingsOpen: boolean;
  setActiveSettingsTab: (tab: SettingsTab) => void;
  setIsUnifiedSettingsOpen: (open: boolean) => void;
  setUserSettings: (settings: UserAISettings | null) => void;
  userSettings: UserAISettings | null;
}
