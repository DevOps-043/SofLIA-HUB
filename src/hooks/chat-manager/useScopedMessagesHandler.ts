import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  createConversation, generateTitleWithModel, PENDING_MODEL_TITLE,
  saveMessages, stageMessages, updateConversationTitle,
  type ChatMessage,
} from '../../services/chat-service';
import { withoutActivePlaceholders } from './helpers';
import { isConversationTombstoned } from '../../services/chat/tombstones';
import type { ChatManagerState, ChatStorageKeyResolver, UseChatManagerOptions } from './types';

type ScopedMessagesDeps = UseChatManagerOptions & {
  getCurrentChatStorageKey: ChatStorageKeyResolver;
  state: ChatManagerState;
};
type SaveEntry = { receive(messages: ChatMessage[]): void; flush(): Promise<void>; dispose(): void };

/** Los snapshots pertenecen a un destino estable, incluso después de navegar. */
export function useScopedMessagesHandler({ getCurrentChatStorageKey, orgId, state, userId }: ScopedMessagesDeps) {
  const entries = useRef(new Map<string, SaveEntry>());
  const identity = JSON.stringify([userId, orgId]);
  const currentIdentity = useRef(identity);
  useLayoutEffect(() => { currentIdentity.current = identity; }, [identity]);
  useEffect(() => {
    const registry = entries.current;
    return () => {
      for (const [key, entry] of registry) if (JSON.parse(key)[0] === identity) { entry.dispose(); registry.delete(key); }
    };
  }, [identity]);

  const createScopedMessagesHandler = useCallback((capturedConvId: string | null, capturedFolderId: string | null) => {
    const destination = capturedConvId ?? state.chatScopeIdRef.current;
    const key = JSON.stringify([identity, destination]);
    const existing = entries.current.get(key);
    if (existing) return existing.receive;
    const validScope = () => currentIdentity.current === identity && Boolean(userId) && !isConversationTombstoned(userId!, destination);
    let latestMessages: ChatMessage[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let initialized = Boolean(capturedConvId);
    let creation: Promise<void> = Promise.resolve();

    const applyTitle = async (messages: ChatMessage[]) => {
      const title = (await generateTitleWithModel(messages)).trim();
      if (!validScope() || !userId || !title || title === PENDING_MODEL_TITLE) return;
      if (!state.conversationsRef.current.some(item => item.id === destination)) return;
      state.setConversations(previous => previous.map(item => item.id === destination ? { ...item, title } : item));
      await updateConversationTitle(userId, destination, title);
    };
    const initialize = (messages: ChatMessage[]) => {
      if (initialized || !userId || !messages.length) return;
      initialized = true;
      // createConversation escribe caché/cola antes de devolver su promesa.
      creation = createConversation(userId, PENDING_MODEL_TITLE, capturedFolderId ?? undefined, orgId, destination).then(conversation => {
        if (!conversation || !validScope()) return;
        state.setConversations(previous => {
          const next = previous.some(item => item.id === conversation.id) ? previous : [conversation, ...previous];
          state.conversationsRef.current = next;
          return next;
        });
        if (state.chatScopeIdRef.current === destination && !state.currentConvIdRef.current) {
          state.currentConvIdRef.current = destination;
          state.setCurrentConversationId(destination);
          localStorage.setItem(getCurrentChatStorageKey(userId), destination);
        }
        void applyTitle(messages);
      });
      void creation.catch(() => { initialized = false; console.warn('[Chat] No se pudo preparar la conversación de origen.'); });
    };
    const flush = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      const snapshot = withoutActivePlaceholders(latestMessages);
      if (!validScope() || !userId || !snapshot.length) return Promise.resolve();
      initialize(snapshot);
      // saveMessages encola localmente antes de esperar cualquier llamada remota.
      void saveMessages(destination, userId, snapshot).catch(() => {
        console.warn('[Chat] Los mensajes del origen quedaron pendientes de sincronización.');
      });
      // Navegar espera la escritura local, nunca la disponibilidad de la red.
      return Promise.resolve();
    };
    const receive = (messages: ChatMessage[]) => {
      if (!validScope() || !userId) return;
      latestMessages = messages;
      const snapshot = withoutActivePlaceholders(messages);
      const first = !initialized;
      initialize(snapshot);
      if (state.chatScopeIdRef.current === destination) state.setCurrentMessages(messages);
      stageMessages(destination, userId, snapshot);
      if (timer) clearTimeout(timer);
      // El usuario y el acuse del job son durables antes de abandonar el turno.
      if (first || messages.some(message => message.backgroundJobId)) void flush();
      else timer = setTimeout(() => { void flush(); }, 1000);
    };
    const patchMessage = (messageId: string, patch: Partial<ChatMessage>) => {
      if (!validScope() || !latestMessages.some(message => message.id === messageId)) return;
      receive(latestMessages.map(message => message.id === messageId ? { ...message, ...patch, id: message.id, role: message.role } : message));
    };
    Object.assign(receive, { patchMessage, ensurePersisted: () => creation });
    entries.current.set(key, { receive, flush, dispose: () => { if (timer) clearTimeout(timer); void flush(); } });
    return receive;
  }, [getCurrentChatStorageKey, identity, orgId, state, userId]);

  const flushPendingSave = useCallback(async () => {
    await Promise.all([...entries.current.values()].map(entry => entry.flush()));
  }, []);
  return { createScopedMessagesHandler, flushPendingSave };
}
