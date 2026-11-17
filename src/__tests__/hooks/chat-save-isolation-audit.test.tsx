import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScopedMessagesHandler } from '../../hooks/chat-manager/useScopedMessagesHandler';
import { useChatManagerState } from '../../hooks/chat-manager/useChatManagerState';
import type { ChatMessage } from '../../services/chat-service';

const mocks = vi.hoisted(() => ({ create: vi.fn(), save: vi.fn(), cache: vi.fn() }));
vi.mock('../../services/chat-service', () => ({
  createConversation: mocks.create, saveMessages: mocks.save, saveMessagesToCache: mocks.cache,
  stageMessages: mocks.cache,
  generateTitleWithModel: vi.fn(async () => ''), updateConversationTitle: vi.fn(), PENDING_MODEL_TITLE: 'Nueva conversación',
}));

const user: ChatMessage = { id: 'usuario', role: 'user', text: 'Crea una presentación sobre calidad y normalización de software', timestamp: 1 };
const placeholder: ChatMessage = { id: 'modelo', role: 'model', text: '...', timestamp: 2 };

// Regresiones de los defectos reproducidos durante la auditoría inicial.
describe('auditoría del primer guardado del chat', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'presentacion', user_id: 'usuario', title: 'Presentación', created_at: '2026-11-13T00:00:00Z', updated_at: '2026-11-13T00:00:00Z' });
    mocks.save.mockResolvedValue(undefined);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function useHarness() {
    const state = useChatManagerState('usuario', 'organizacion');
    const scoped = useScopedMessagesHandler({ state, userId: 'usuario', orgId: 'organizacion', getCurrentChatStorageKey: id => `actual_${id}` });
    // AppContent vuelve a pedir este handler cuando cambia el estado del gestor.
    const handler = scoped.createScopedMessagesHandler(state.currentConversationId, null);
    return { state, scoped, handler };
  }

  it('guarda el primer mensaje al salir aunque el modelo siga generando', async () => {
    const { result } = renderHook(useHarness);
    await act(async () => {
      result.current.handler([user, placeholder]);
      await result.current.scoped.flushPendingSave();
    });
    expect(mocks.create).toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalled();
  });

  it('un render no sustituye el guardado pendiente por un snapshot vacío', async () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.handler([user, { ...placeholder, text: 'Presentación en preparación' }]));
    // Un render no puede sustituir el snapshot pendiente por uno vacío.
    await act(async () => { await result.current.scoped.flushPendingSave(); await vi.advanceTimersByTimeAsync(1100); });
    expect(mocks.create).toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalled();
  });
});
