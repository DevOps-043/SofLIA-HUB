import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChatMessage } from '../../services/chat-service';
import { createVisibleRefresh } from '../../services/visible-refresh';
import { hasActivePlaceholder } from './helpers';

interface UseChatRefreshEffectsArgs {
  currentConversationId: string | null;
  currentConvIdRef: MutableRefObject<string | null>;
  currentMessagesRef: MutableRefObject<ChatMessage[]>;
  refreshConversationsFromRemote: () => Promise<void>;
  refreshCurrentConversationMessages: (conversationId: string, capturedScopeVersion?: number) => Promise<void>;
  userId: string | undefined;
}

export function useChatRefreshEffects({ currentConversationId, currentConvIdRef, currentMessagesRef,
  refreshConversationsFromRemote, refreshCurrentConversationMessages, userId }: UseChatRefreshEffectsArgs) {
  useEffect(() => {
    if (!userId) return;
    const conversations = createVisibleRefresh(refreshConversationsFromRemote, 15000,
      error => console.warn('[Chat] No se pudieron actualizar las conversaciones:', error));
    const messages = createVisibleRefresh(async () => {
      const active = currentConvIdRef.current;
      if (!active || active !== currentConversationId || hasActivePlaceholder(currentMessagesRef.current)) return;
      await refreshCurrentConversationMessages(active);
    }, currentConversationId ? 8000 : 0, error => console.warn('[Chat] No se pudieron actualizar los mensajes:', error));

    const channel = supabase.channel(`lia-chat-sync:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `user_id=eq.${userId}` }, (payload: { new?: { conversation_id?: string }; old?: { conversation_id?: string } }) => {
        const changed = payload.new?.conversation_id ?? payload.old?.conversation_id;
        if (changed && changed === currentConvIdRef.current) messages.request();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${userId}` }, conversations.request)
      .subscribe();
    return () => {
      conversations.dispose(); messages.dispose();
      void supabase.removeChannel(channel);
    };
  }, [currentConversationId, currentConvIdRef, currentMessagesRef, refreshConversationsFromRemote, refreshCurrentConversationMessages, userId]);
}
