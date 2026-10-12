import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useChatRuntime } from '../../adapters/desktop_ui/chat-ui/useChatRuntime';
import type { useChatUIState } from '../../adapters/desktop_ui/chat-ui/useChatUIState';
const mocks = vi.hoisted(() => ({ processor: vi.fn(() => ({ processMessage: vi.fn() })), memoryOwner: vi.fn() }));
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
