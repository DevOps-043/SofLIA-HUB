import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatSessionKey, fetchChatMemoryContext, recordChatTurn } from '../../services/memory-bridge';

describe('memoria reciente del chat por conversación', () => {
  const getContext = vi.fn(async (...args: [string, string, string]) => {
    void args;
    return { success: true, context: 'contexto' };
  });
  const recordTurn = vi.fn(async (...args: [string, string, string, string]) => {
    void args;
    return { success: true };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'memory', {
      configurable: true,
      value: { getContext, recordTurn },
    });
  });

  it('MEM-CHAT-001: dos conversaciones del mismo usuario no comparten sesión reciente', async () => {
    await fetchChatMemoryContext('usuario-1', 'resume esto', 'conversacion-a');
    await fetchChatMemoryContext('usuario-1', 'resume esto', 'conversacion-b');
    recordChatTurn('usuario-1', 'pregunta', 'respuesta', 'conversacion-a');

    expect(getContext.mock.calls[0]?.[1]).toBe('chat:user:usuario-1:conversation:conversacion-a');
    expect(getContext.mock.calls[1]?.[1]).toBe('chat:user:usuario-1:conversation:conversacion-b');
    expect(getContext.mock.calls[0]?.[1]).not.toBe(getContext.mock.calls[1]?.[1]);
    expect(recordTurn).toHaveBeenCalledWith(
      'user:usuario-1',
      'chat:user:usuario-1:conversation:conversacion-a',
      'pregunta',
      'respuesta',
    );
  });

  it('MEM-CHAT-002: sanea el alcance antes de formar la clave', () => {
    expect(chatSessionKey('user:u', 'conversación / privada')).toBe('chat:user:u:conversation:conversaci_n___privada');
  });
});
