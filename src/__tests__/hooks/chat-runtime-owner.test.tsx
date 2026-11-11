import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useChatRuntime } from '../../adapters/desktop_ui/chat-ui/useChatRuntime';
import type { useChatUIState } from '../../adapters/desktop_ui/chat-ui/useChatUIState';
const mocks = vi.hoisted(() => ({ stop: vi.fn(), processor: vi.fn(), memoryOwner: vi.fn() }));
mocks.processor.mockImplementation(() => ({ processMessage: vi.fn(), cancelScope: mocks.stop }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'sofia-activa' }, dataUserId: 'lia-datos' }) }));
vi.mock('../../hooks/useChatProcessor', () => ({ useChatProcessor: mocks.processor }));
vi.mock('../../hooks/useModelSelector', () => ({ useModelSelector: () => ({ preferredPrimaryModel: 'gpt-6-luna', thinkingMode: 'max' }) }));
vi.mock('../../services/memory-bridge', () => ({ syncCurrentOwner: mocks.memoryOwner }));

it('envía la identidad SOFIA al monitor y conserva el propietario Lia de la memoria', () => {
  const state = { modes: { imageGen: false, promptOptimizer: false }, input: { set: vi.fn() }, selection: { set: vi.fn() } } as unknown as ReturnType<typeof useChatUIState>;
  renderHook(() => useChatRuntime({ messages: [], onMessagesChange: vi.fn() }, state, null));
  expect(mocks.processor).toHaveBeenCalledWith(expect.objectContaining({ sofiaUserId: 'lia-datos', activityOwnerId: 'sofia-activa' }));
  expect(mocks.memoryOwner).toHaveBeenCalledWith('lia-datos');
});
it('persistir un borrador conserva el turno y abrir otra conversación lo cancela', () => {
  mocks.stop.mockClear();
  const state = { modes: { imageGen: false, promptOptimizer: false }, input: { set: vi.fn() }, selection: { set: vi.fn() } } as unknown as ReturnType<typeof useChatUIState>;
  const { rerender } = renderHook(({ id }: { id: string | null }) => useChatRuntime({ conversationId: id, messages: [], onMessagesChange: vi.fn() }, state, null), { initialProps: { id: null as string | null } });
  rerender({ id: 'primer-chat-persistido' });
  expect(mocks.stop).not.toHaveBeenCalled();
  rerender({ id: 'otro-chat' });
  expect(mocks.stop).toHaveBeenCalledOnce();
});
