/**
 * Tests ABORT-1..3: cancelación de la generación con el botón Stop.
 *
 * Verifican que un AbortSignal detiene el stream/loop de texto de forma limpia
 * (mensaje "Detenido") y SIN reintentar con otros modelos, para que el usuario
 * pueda parar lo que SofLIA esté haciendo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockChat, getGeminiChatMocks } from './gemini-chat.setup';

const { mockGetApiKeyWithCache, mockChatsCreate } = getGeminiChatMocks();

const STOP_MESSAGE = '⏹️ Detenido.';

describe('gemini-chat abort', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetApiKeyWithCache.mockResolvedValue(null);
  });

  it('ABORT-1: una señal pre-abortada detiene sin llamar al modelo', async () => {
    const chat = createMockChat('no deberia usarse');
    mockChatsCreate.mockReturnValue(chat);
    const controller = new AbortController();
    controller.abort();

    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream('lista mis archivos', [], { signal: controller.signal });
    const text = await collectStream(result.stream);

    expect(text).toBe(STOP_MESSAGE);
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('ABORT-2: un AbortError del modelo detiene sin reintentar otro modelo', async () => {
    const abortingChat = {
      sendMessage: vi.fn(async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      }),
      sendMessageStream: vi.fn(),
    };
    mockChatsCreate.mockReturnValue(abortingChat);

    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream('lista mis archivos', [], { signal: new AbortController().signal });
    const text = await collectStream(result.stream);

    expect(text).toBe(STOP_MESSAGE);
    // No debe caer al siguiente modelo de respaldo: se respeta la cancelación.
    expect(mockChatsCreate).toHaveBeenCalledTimes(1);
  });

  it('ABORT-3: sin señal, el flujo normal sigue funcionando', async () => {
    const chat = createMockChat('respuesta normal');
    mockChatsCreate.mockReturnValue(chat);

    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream('lista mis archivos', []);
    const text = await collectStream(result.stream);

    expect(text).toBe('respuesta normal');
    expect(chat.sendMessage).toHaveBeenCalled();
  });
});

async function collectStream(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const chunk of stream) text += chunk;
  return text;
}
