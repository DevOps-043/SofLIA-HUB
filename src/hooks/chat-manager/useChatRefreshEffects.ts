import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChatMessage } from '../../services/chat-service';
import { hasActivePlaceholder } from './helpers';

interface UseChatRefreshEffectsArgs {
  currentConversationId: string | null;
  currentConvIdRef: MutableRefObject<string | null>;
  currentMessagesRef: MutableRefObject<ChatMessage[]>;
  refreshConversationsFromRemote: () => Promise<void>;
  refreshCurrentConversationMessages: (conversationId: string, capturedScopeVersion?: number) => Promise<void>;
  userId: string | undefined;
}

export function useChatRefreshEffects({
  currentConversationId,
  currentConvIdRef,
  currentMessagesRef,
  refreshConversationsFromRemote,
  refreshCurrentConversationMessages,
  userId,
}: UseChatRefreshEffectsArgs) {
  useEffect(() => {
    if (!userId) return;

    const refreshSafely = () => {
      void refreshConversationsFromRemote().catch((error) => {
        console.warn('[useChatManager] refreshConversationsFromRemote FAILED:', error);
      });
    };

    const intervalId = window.setInterval(refreshSafely, 15000);
    const handleFocus = () => refreshSafely();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSafely();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshConversationsFromRemote, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`lia-chat-sync:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `user_id=eq.${userId}` }, (payload: any) => {
        if (hasActivePlaceholder(currentMessagesRef.current)) return;

        const changedConvId: string | undefined = payload?.new?.conversation_id ?? payload?.old?.conversation_id;
        const activeConvId = currentConvIdRef.current;
        if (changedConvId && activeConvId && changedConvId === activeConvId) {
          void refreshCurrentConversationMessages(activeConvId).catch((error) => {
            console.warn('[useChatManager] realtime message refresh FAILED:', error);
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${userId}` }, () => {
        void refreshConversationsFromRemote().catch((error) => {
          console.warn('[useChatManager] realtime conversation refresh FAILED:', error);
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentConvIdRef, currentMessagesRef, refreshConversationsFromRemote, refreshCurrentConversationMessages, userId]);

  useEffect(() => {
    if (!userId || !currentConversationId) return;

    const activeConvId = currentConversationId;
    const intervalId = window.setInterval(() => {
      if (hasActivePlaceholder(currentMessagesRef.current)) return;
      if (currentConvIdRef.current !== activeConvId) return;
      void refreshCurrentConversationMessages(activeConvId).catch((error) => {
        console.warn('[useChatManager] message poll refresh FAILED:', error);
      });
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [currentConversationId, currentConvIdRef, currentMessagesRef, refreshCurrentConversationMessages, userId]);
}
