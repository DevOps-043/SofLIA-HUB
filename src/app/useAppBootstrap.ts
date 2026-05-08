import { useEffect } from 'react';
import type { ChatState, FolderState, IrisState } from './app-types';
import { getCachedSettings, loadSettings, type UserAISettings } from '../services/settings-service';

interface UseAppBootstrapOptions {
  chat: ChatState;
  folder: FolderState;
  iris: IrisState;
  orgId: string;
  setUserSettings: (settings: UserAISettings | null) => void;
  userId?: string;
}

export function useAppBootstrap({ chat, folder, iris, orgId, setUserSettings, userId }: UseAppBootstrapOptions) {
  useEffect(() => {
    if (!userId) return;

    const init = async () => {
      const cached = getCachedSettings();
      if (cached && cached.user_id === userId) setUserSettings(cached);

      const [, , settings] = await Promise.all([
        chat.loadInitialConversations(),
        folder.loadInitialFolders(),
        loadSettings(userId),
      ]);
      setUserSettings(settings);
      iris.loadInitialData();
    };

    init();
  }, [orgId, userId]);
}
