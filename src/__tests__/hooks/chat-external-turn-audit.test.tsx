import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChatRuntime } from '../../adapters/desktop_ui/chat-ui/useChatRuntime';
import type { useChatUIState } from '../../adapters/desktop_ui/chat-ui/useChatUIState';

const mocks = vi.hoisted(() => ({ process: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined) }));
vi.mock('../../hooks/chat-processor/create-process-message', () => ({ createProcessMessage: () => mocks.process }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'usuario' }, dataUserId: 'usuario' }) }));
vi.mock('../../hooks/useModelSelector', () => ({
  MODEL_OPTIONS: [], useModelSelector: () => ({ preferredPrimaryModel: 'gpt-6-luna', thinkingMode: 'medium' }),
}));
vi.mock('../../services/memory-bridge', () => ({ syncCurrentOwner: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe('auditoría del turno iniciado mediante externalPrompt', () => {
  it('usa el mismo AbortSignal y guardia de generación que el envío manual', () => {
    const state = { modes: {}, input: { set: vi.fn() }, selection: { set: vi.fn() } } as unknown as ReturnType<typeof useChatUIState>;
    renderHook(() => useChatRuntime({ conversationId: 'presentacion', messages: [], onMessagesChange: vi.fn(), externalPrompt: 'Crea la presentación' }, state, null));
    expect(mocks.process).toHaveBeenCalledOnce();
    const args = mocks.process.mock.calls[0];
    expect(args[4]).toBeInstanceOf(AbortSignal);
    expect(args[5]).toBeTypeOf('function');
  });
});
