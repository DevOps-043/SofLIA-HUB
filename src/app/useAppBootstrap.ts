import { useEffect } from 'react';
import type { ChatState, FolderState } from './app-types';
import { getCachedSettings, loadSettings, type UserAISettings } from '../services/settings-service';

interface UseAppBootstrapOptions {
  chat: ChatState;
  folder: FolderState;
  orgId: string;
  setUserSettings: (settings: UserAISettings | null) => void;
  userId?: string;
}

export function useAppBootstrap({ chat, folder, orgId, setUserSettings, userId }: UseAppBootstrapOptions) {
  useEffect(() => {
    if (!userId) return;
    let disposed = false;

    const init = async () => {
      const cached = getCachedSettings();
      if (cached && cached.user_id === userId) setUserSettings(cached);

      const [, , settings] = await Promise.all([
        chat.loadInitialConversations(),
        folder.loadInitialFolders(),
        loadSettings(userId),
      ]);
      if (!disposed) setUserSettings(settings);
    };

    void init().catch(() => {
      if (!disposed) console.warn('[Inicio] No se pudieron cargar todos los datos iniciales.');
    });
    return () => { disposed = true; };
  }, [orgId, userId]);
}
