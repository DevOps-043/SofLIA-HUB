const CONVERSATIONS_CACHE_PREFIX = 'lia_conversations_';
const PENDING_CHAT_STATE_PREFIX = 'lia_pending_chat_state_';

export function updateConversationFolderCache(conversationId: string, folderId: string | null): void {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;

      if (key.startsWith(CONVERSATIONS_CACHE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const conversations = JSON.parse(raw);
        const nextConversations = conversations.map((conversation: any) =>
          conversation.id === conversationId
            ? { ...conversation, folder_id: folderId ?? undefined }
            : conversation,
        );
        localStorage.setItem(key, JSON.stringify(nextConversations));
        continue;
      }

      if (key.startsWith(PENDING_CHAT_STATE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const state = JSON.parse(raw);
        if (!state?.conversationUpserts?.[conversationId]) continue;
        state.conversationUpserts[conversationId] = {
          ...state.conversationUpserts[conversationId],
          folder_id: folderId ?? undefined,
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(state));
      }
    }
  } catch {}
}
