import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatManagerState } from '../../hooks/chat-manager/useChatManagerState';
import { useScopedMessagesHandler } from '../../hooks/chat-manager/useScopedMessagesHandler';
import { useChatActions } from '../../hooks/chat-manager/useChatActions';
import { useConversationRefresh } from '../../hooks/chat-manager/useConversationRefresh';
import { loadConversationsFromCache, loadMessagesFromCache, saveConversationsToCache } from '../../services/chat/cache';
import { buildConversationList, buildLocalConversationList } from '../../services/chat/builders';
import { getPendingMessageSnapshot } from '../../services/chat/pending-state';
import type { ChatMessage, ChatMessagesChange } from '../../services/chat/types';

const mocks = vi.hoisted(() => ({ sync: vi.fn(), load: vi.fn(), conversations: vi.fn() }));
vi.mock('../../services/chat/sync', () => ({ syncPendingChatState: mocks.sync }));
vi.mock('../../services/chat/operations/load-messages', () => ({ loadMessages: mocks.load }));
vi.mock('../../services/chat/operations/load-conversations', () => ({ loadConversations: mocks.conversations }));
vi.mock('../../services/chat/operations/title', () => ({ PENDING_MODEL_TITLE: 'Preparando título', generateTitleWithModel: vi.fn(async () => ''), generateTitle: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: {} }, isSupabaseConfigured: () => false }));

const person: ChatMessage = { id: 'persona-a', role: 'user', text: 'Crea la presentación sobre calidad y normalización de software', timestamp: 1 };
const placeholder: ChatMessage = { id: 'respuesta-a', role: 'model', text: '...', timestamp: 2 };
const emotional: ChatMessage = { id: 'persona-b', role: 'user', text: 'Hoy necesito apoyo emocional', timestamp: 3 };
const storageKey = (id: string) => 'actual_' + id;

function useHarness(userId = 'usuario') {
  const state = useChatManagerState(userId, 'organizacion');
  const scoped = useScopedMessagesHandler({ state, userId, orgId: 'organizacion', getCurrentChatStorageKey: storageKey });
  const actions = useChatActions({ state, userId, orgId: 'organizacion', getCurrentChatStorageKey: storageKey, flushPendingSave: scoped.flushPendingSave, refreshConversationsFromRemote: async () => {} });
  const refresh = useConversationRefresh({ state, userId, orgId: 'organizacion', getCurrentChatStorageKey: storageKey });
  const receive = scoped.createScopedMessagesHandler(state.currentConversationId, null) as ChatMessagesChange;
  return { state, scoped, actions, receive, refresh };
}

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  // La red permanece pendiente durante toda la prueba; sólo el caché/cola son reales.
  mocks.sync.mockImplementation(() => new Promise(() => {}));
  mocks.load.mockImplementation(async (id: string) => id === 'apoyo-emocional' ? [emotional] : loadMessagesFromCache(id));
});
afterEach(() => vi.restoreAllMocks());

describe('navegación, persistencia y acuses tardíos del chat', () => {
  it('retira el indicador de carga inicial tras navegar sin sustituir el chat seleccionado', async () => {
    const hook = renderHook(() => useHarness());
    let release!: (rows: []) => void;
    mocks.conversations.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    let loading!: Promise<unknown>;
    act(() => { loading = hook.result.current.refresh.loadInitialConversations(); });
    expect(hook.result.current.state.loadingConversations).toBe(true);
    await act(async () => { await hook.result.current.actions.handleSelectConversation('apoyo-emocional'); });
    await act(async () => { release([]); await loading; });
    expect(hook.result.current.state.loadingConversations).toBe(false);
    expect(hook.result.current.state.currentConversationId).toBe('apoyo-emocional');
    expect(hook.result.current.state.currentMessages).toEqual([emotional]);
  });

  it('conserva chats propios ante un listado parcial sin mezclar organizaciones ni recuperar shares revocados', () => {
    const base = { user_id: 'usuario', title: 'Chat', created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z' };
    saveConversationsToCache('usuario', [{ ...base, id: 'a', org_id: 'org-a' }, { ...base, id: 'b', org_id: 'org-b' }, { ...base, id: 'compartido', org_id: 'org-a', user_id: 'otro', is_shared: true }]);
    expect(buildConversationList('usuario', [], 'org-a').map(item => item.id)).toEqual(['a']);
    expect(buildLocalConversationList('usuario', 'org-b').map(item => item.id)).toEqual(['b']);
    expect(loadConversationsFromCache('usuario').some(item => item.id === 'compartido')).toBe(false);
  });

  it('expone el fallo de almacenamiento en vez de acreditar un primer guardado inexistente', async () => {
    const hook = renderHook(() => useHarness());
    const receive = hook.result.current.receive;
    const original = localStorage.setItem;
    Reflect.set(localStorage, 'setItem', () => { throw new Error('Almacenamiento no disponible'); });
    try {
      act(() => expect(() => receive([person, placeholder])).toThrow('almacenamiento local'));
      await expect(receive.ensurePersisted?.()).rejects.toThrow('almacenamiento local');
    } finally { Reflect.set(localStorage, 'setItem', original); }
  });

  it('ignora una selección lenta anterior a una navegación más reciente', async () => {
    const hook = renderHook(() => useHarness());
    let release!: (messages: ChatMessage[]) => void;
    mocks.load.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    let first!: Promise<boolean>;
    act(() => { first = hook.result.current.actions.handleSelectConversation('lento'); });
    await vi.waitFor(() => expect(mocks.load).toHaveBeenCalledOnce());
    await act(async () => { await hook.result.current.actions.handleSelectConversation('apoyo-emocional'); });
    await act(async () => { release([person]); expect(await first).toBe(false); });
    expect(hook.result.current.state.currentConversationId).toBe('apoyo-emocional');
    expect(hook.result.current.state.currentMessages).toEqual([emotional]);
  });

  it('guarda antes de inferencia y recorre presentación A → apoyo emocional B → A sin red ni mezcla', async () => {
    const hook = renderHook(() => useHarness());
    const origin = hook.result.current.state.chatScopeId;
    const receiveA = hook.result.current.receive;
    act(() => {
      receiveA([person, placeholder]);
      expect(loadConversationsFromCache('usuario').some(conversation => conversation.id === origin)).toBe(true);
      expect(getPendingMessageSnapshot('usuario', origin)).toEqual([person]);
    });
    await act(async () => { await hook.result.current.actions.handleSelectConversation('apoyo-emocional'); });
    expect(hook.result.current.state.currentMessages).toEqual([emotional]);
    expect(hook.result.current.state.chatScopeId).toBe('apoyo-emocional');
    act(() => {
      hook.result.current.receive([emotional, { id: 'respuesta-b', role: 'model', text: 'Te escucho.', timestamp: 4 }]);
      receiveA.patchMessage?.(placeholder.id, { backgroundJobId: '11111111-1111-4111-8111-111111111111', text: 'El equipo sigue trabajando en la presentación.' });
    });
    expect(hook.result.current.state.currentMessages.every(message => !message.text.includes('software'))).toBe(true);
    expect(loadMessagesFromCache(origin).find(message => message.id === placeholder.id)?.backgroundJobId).toBeDefined();
    await act(async () => { await hook.result.current.actions.handleSelectConversation(origin); });
    expect(hook.result.current.state.currentMessages.map(message => message.id)).toEqual([person.id, placeholder.id]);
    expect(hook.result.current.state.currentMessages.some(message => message.text.includes('emocional'))).toBe(false);
    expect(hook.result.current.state.conversations.some(conversation => conversation.id === origin)).toBe(true);
  });

  it('un acuse de A no borra un turno posterior al regresar al mismo origen', async () => {
    const hook = renderHook(() => useHarness());
    const receive = hook.result.current.receive;
    act(() => receive([person, placeholder]));
    const next: ChatMessage = { id: 'seguimiento', role: 'user', text: 'Mientras tanto, revisemos la audiencia', timestamp: 3 };
    act(() => {
      hook.result.current.receive([person, placeholder, next]);
      receive.patchMessage?.(placeholder.id, { text: 'Equipo admitido', backgroundJobId: '11111111-1111-4111-8111-111111111111' });
    });
    expect(hook.result.current.state.currentMessages.map(message => message.id)).toEqual([person.id, placeholder.id, next.id]);
    await act(async () => {});
  });

  it('dos borradores sucesivos tienen identidades distintas y conservan sus mensajes', async () => {
    const hook = renderHook(() => useHarness());
    const first = hook.result.current.state.chatScopeId;
    act(() => hook.result.current.receive([person, placeholder]));
    await act(async () => { await hook.result.current.actions.handleNewChat(); });
    const second = hook.result.current.state.chatScopeId;
    expect(second).not.toBe(first);
    act(() => hook.result.current.receive([{ ...emotional, id: 'borrador-b' }]));
    await act(async () => { await hook.result.current.scoped.flushPendingSave(); });
    expect(loadMessagesFromCache(first)).toEqual([person]);
    expect(loadMessagesFromCache(second).map(message => message.id)).toEqual(['borrador-b']);
    expect(loadConversationsFromCache('usuario').map(conversation => conversation.id)).toEqual(expect.arrayContaining([first, second]));
  });

  it('descarta publicaciones del propietario anterior al cambiar de usuario', async () => {
    const hook = renderHook(({ userId }) => useHarness(userId), { initialProps: { userId: 'usuario-a' } });
    const receive = hook.result.current.receive;
    act(() => receive([person, placeholder]));
    hook.rerender({ userId: 'usuario-b' });
    expect(hook.result.current.state.currentMessages).toEqual([]);
    act(() => receive.patchMessage?.(placeholder.id, { text: 'Resultado del usuario anterior' }));
    expect(loadConversationsFromCache('usuario-b')).toEqual([]);
    expect(hook.result.current.state.currentMessages.some(message => message.text.includes('Resultado del usuario anterior'))).toBe(false);
    await act(async () => {});
  });
});
