import { useEffect } from "react";
import { migrateLegacyChatCache } from "../services/chat-service";
import { migrateLegacyFolderCache } from "../services/folder-service";
import { migrateLegacySettingsCache } from "../services/settings-service";

export function useLegacyUserMigration(legacyUserId: string | undefined, userId: string | undefined) {
  useEffect(() => {
    if (!legacyUserId || !userId || legacyUserId === userId) return;

    migrateLegacyChatCache(legacyUserId, userId);
    migrateLegacyFolderCache(legacyUserId, userId);
    migrateLegacySettingsCache(legacyUserId, userId);

    const legacyCurrentChatKey = `lia_current_chat_id_${legacyUserId}`;
    const syncedCurrentChatKey = `lia_current_chat_id_${userId}`;
    const legacyCurrentChatId = localStorage.getItem(legacyCurrentChatKey);
    if (legacyCurrentChatId && !localStorage.getItem(syncedCurrentChatKey)) {
      localStorage.setItem(syncedCurrentChatKey, legacyCurrentChatId);
    }
    localStorage.removeItem(legacyCurrentChatKey);
  }, [legacyUserId, userId]);
}
