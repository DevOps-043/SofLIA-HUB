import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationRefresh } from '../../hooks/chat-manager/useConversationRefresh';
import { useFolderRefresh } from '../../hooks/folder-manager/useFolderRefresh';
import type { ChatManagerState } from '../../hooks/chat-manager/types';

const mocks = vi.hoisted(() => ({ messages: vi.fn(), conversations: vi.fn(), folders: vi.fn() }));
vi.mock('../../services/chat-service', () => ({ loadMessages: mocks.messages, loadConversations: mocks.conversations }));
vi.mock('../../services/folder-service', () => ({ loadFolders: mocks.folders }));
const key = (id: string) => id;
function fixture() {
  return { scopeVersionRef: { current: 0 }, currentConvIdRef: { current: 'chat' }, currentMessagesRef: { current: [] },
    setCurrentMessages: vi.fn(), setConversations: vi.fn(), setLoadingConversations: vi.fn(), setCurrentConversationId: vi.fn() } as unknown as ChatManagerState;
}
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => vi.clearAllMocks());

describe('Recursos y respuestas remotas por ámbito', () => {
  it('reutiliza una lectura de mensajes en curso y mantiene callbacks estables al renderizar', async () => {
    const wait = pending<[]>(); mocks.messages.mockReturnValue(wait.promise);
    const state = fixture();
    const { result, rerender } = renderHook(() => useConversationRefresh({ state: { ...state }, userId: 'u', orgId: 'o', getCurrentChatStorageKey: key }));
    const callback = result.current.refreshCurrentConversationMessages;
    const first = callback('chat'), second = callback('chat');
    expect(first).toBe(second); expect(mocks.messages).toHaveBeenCalledTimes(1);
    rerender(); expect(result.current.refreshCurrentConversationMessages).toBe(callback);
    await act(async () => { wait.resolve([]); await first; });
    expect(state.setCurrentMessages).toHaveBeenCalledTimes(1);
  });

  it('descarta respuestas de otro usuario y después del desmontaje', async () => {
    const wait = pending<[]>(); mocks.messages.mockReturnValue(wait.promise);
    const state = fixture();
    const { result, rerender, unmount } = renderHook(({ userId }) => useConversationRefresh({ state, userId, orgId: 'o', getCurrentChatStorageKey: key }), { initialProps: { userId: 'a' } });
    const first = result.current.refreshCurrentConversationMessages('chat');
    rerender({ userId: 'b' });
    await act(async () => { wait.resolve([]); await first; });
    expect(state.setCurrentMessages).not.toHaveBeenCalled();
    const next = pending<[]>(); mocks.messages.mockReturnValue(next.promise);
    const second = result.current.refreshCurrentConversationMessages('chat');
    unmount(); await act(async () => { next.resolve([]); await second; });
    expect(state.setCurrentMessages).not.toHaveBeenCalled();
  });

  it('una carga inicial antigua no borra la conversación de la sesión nueva', async () => {
    const wait = pending<[]>(); mocks.conversations.mockReturnValue(wait.promise);
    const state = fixture();
    const { result, rerender } = renderHook(({ userId }) => useConversationRefresh({ state, userId, orgId: 'o', getCurrentChatStorageKey: key }), { initialProps: { userId: 'a' } });
    const request = result.current.loadInitialConversations();
    rerender({ userId: 'b' });
    await act(async () => { wait.resolve([]); await request; });
    expect(state.setConversations).not.toHaveBeenCalled();
    expect(state.setCurrentConversationId).not.toHaveBeenCalled();
  });

  it('una carga inicial superada no publica resultados ni apaga el indicador de la más reciente', async () => {
    const first = pending<[]>();
    const second = pending<[]>();
    mocks.conversations.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const state = fixture();
    const { result } = renderHook(() => useConversationRefresh({
      state, userId: 'u', orgId: 'o', getCurrentChatStorageKey: key,
    }));
    const earlier = result.current.loadInitialConversations();
    const latest = result.current.loadInitialConversations();

    first.resolve([]);
    await earlier;
    expect(state.setConversations).not.toHaveBeenCalled();
    expect(state.setLoadingConversations).toHaveBeenLastCalledWith(true);

    second.resolve([]);
    await latest;
    expect(state.setConversations).toHaveBeenCalledOnce();
    expect(state.setLoadingConversations).toHaveBeenLastCalledWith(false);
  });

  it('carpetas ignora una lectura terminada después de retirar el hook', async () => {
    vi.useFakeTimers();
    const wait = pending<[]>(); mocks.folders.mockReturnValue(wait.promise);
    const setFolders = vi.fn(), setCurrentFolderId = vi.fn();
    const { unmount } = renderHook(() => useFolderRefresh({ userId: 'a', currentFolderId: null, setFolders, setCurrentFolderId }));
    window.dispatchEvent(new Event('focus'));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(mocks.folders).toHaveBeenCalledTimes(1);
    unmount(); await act(async () => { wait.resolve([]); });
    expect(setFolders).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
