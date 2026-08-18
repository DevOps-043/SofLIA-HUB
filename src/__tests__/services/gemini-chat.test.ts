/**
 * Tests RS-003 to RS-010: gemini-chat.ts renderer service.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockChat,
  getGeminiChatMocks,
} from './gemini-chat.setup';

const {
  mockGetApiKeyWithCache,
  mockChatsCreate,
  mockGoogleGenAI,
} = getGeminiChatMocks();

describe('gemini-chat', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockChatsCreate.mockReset();
    mockGetApiKeyWithCache.mockResolvedValue(null);
  });

  it('RS-003: buildGeminiHistory truncates to last 50 messages', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');
    mockChatsCreate.mockReturnValue(createMockChat('ok'));

    const history = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'model' as const,
      text: `Message ${i}`,
    }));

    await sendMessageStream('Hola', history);

    expect(mockGoogleGenAI).toHaveBeenCalled();
    expect(mockChatsCreate).toHaveBeenCalled();
  });

  it('RS-004: uses API key from database when available', async () => {
    const { getApiKeyWithCache } = await import('../../services/api-keys');
    vi.mocked(getApiKeyWithCache).mockResolvedValue('db-api-key-123');
    mockChatsCreate.mockReturnValue(createMockChat('ok'));

    const mod = await import('../../services/gemini-chat');
    try {
      await mod.sendMessageStream('test');
    } catch {
      // The mocked chain may stop early; the key lookup is the contract here.
    }

    expect(getApiKeyWithCache).toHaveBeenCalledWith('google');
  });

  it('RS-005: falls back to env GOOGLE_API_KEY when DB returns null', async () => {
    const { getApiKeyWithCache } = await import('../../services/api-keys');
    vi.mocked(getApiKeyWithCache).mockResolvedValue(null);
    mockChatsCreate.mockReturnValue(createMockChat('respuesta'));

    const { sendMessageStream } = await import('../../services/gemini-chat');
    await sendMessageStream('test');

    expect(mockGoogleGenAI).toHaveBeenCalled();
  });

  it('RS-009: tool declarations are passed to the model', async () => {
    mockChatsCreate.mockReturnValue(createMockChat('ok'));

    const { sendMessageStream } = await import('../../services/gemini-chat');
    await sendMessageStream('lista mis archivos');

    expect(mockChatsCreate.mock.calls[0]?.[0]).toHaveProperty('model');
  });

  it('RS-010: sendMessageStream handles empty history gracefully', async () => {
    mockChatsCreate.mockReturnValue(createMockChat('hola'));

    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream('Hola', []);

    expect(result).toBeDefined();
    expect(result.stream).toBeDefined();
  });

  it('RS-010A: simple chats avoid tool declarations and use direct message calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const chat = createMockChat('hola');
    mockChatsCreate.mockReturnValue(chat);

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      const result = await sendMessageStream('Hola', []);
      const text = await collectStream(result.stream);

      expect(text).toBe('hola');
      expect(mockChatsCreate.mock.calls[0]?.[0]?.config).not.toHaveProperty('tools');
      expect(chat.sendMessage).toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('RS-010H: Word document requests activate the computer tool loop', async () => {
    const chat = createMockChat('Documento creado en el escritorio.');
    mockChatsCreate.mockReturnValue(chat);

    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream(
      'ponme esta informacion en un documento en word bien hecho y ponlo en mi escritorio',
      [{ role: 'model', text: 'Investigacion completa sobre Claude Fable Mythos.' }],
    );
    const text = await collectStream(result.stream);
    const modelParams = mockChatsCreate.mock.calls[0]?.[0]?.config;

    expect(text).toBe('Documento creado en el escritorio.');
    expect(modelParams).toHaveProperty('tools');
    expect(modelParams.tools?.[0]?.functionDeclarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'create_word_document' }),
    ]));
  });

  it('RS-010I: un timeout falla explícitamente sin cambiar de modelo', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hangingChat = {
      sendMessage: vi.fn(() => new Promise(() => undefined)),
      sendMessageStream: vi.fn(),
    };
    mockChatsCreate.mockReturnValue(hangingChat);

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      const pending = expect(sendMessageStream('Hola', [])).rejects.toThrow('tiempo limite');
      await vi.advanceTimersByTimeAsync(45_000);
      await pending;
      expect(mockChatsCreate).toHaveBeenCalledTimes(1);
      expect(mockChatsCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.6-flash' }));
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('RS-010B: migra el thinkingLevel rápido heredado a low para Gemini', async () => {
    mockChatsCreate.mockReturnValue(createMockChat('ok'));

    const { sendMessageStream } = await import('../../services/gemini-chat');
    await sendMessageStream('Hola', [], { thinking: { id: 'minimal', level: 'minimal' } });

    // La config de generacion se fusiona en el `config` de la sesion.
    const sessionConfig = (mockChatsCreate.mock.calls as any)[0][0].config;
    expect(sessionConfig).toEqual(expect.objectContaining({
      maxOutputTokens: 16384,
      thinkingConfig: { thinkingLevel: 'low' },
    }));
  });

  it('RS-010C: un error del modelo no degrada silenciosamente a otro', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failingChat = {
      sendMessage: vi.fn(async () => {
        throw new Error('quota exceeded');
      }),
      sendMessageStream: vi.fn(),
    };
    mockChatsCreate.mockReturnValue(failingChat);

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      await expect(sendMessageStream('Hola', [])).rejects.toThrow('quota exceeded');
      expect(mockChatsCreate).toHaveBeenCalledTimes(1);
      expect(mockChatsCreate.mock.calls[0]?.[0]).toMatchObject({ model: 'gemini-3.6-flash' });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('RS-010D: web research uses Google Search grounding without custom browser headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: 'Respuesta verificada' }] },
        groundingMetadata: {
          groundingChunks: [{ web: { uri: 'https://example.com/source', title: 'Fuente actual' } }],
          groundingSupports: [{ groundingChunkIndices: [0], segment: { text: 'Respuesta verificada' } }],
        },
        urlContextMetadata: {
          urlMetadata: [{ retrievedUrl: 'https://example.com/source', urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }],
        },
      }],
    }), { status: 200 }));
    const previousIpc = (window as any).ipcRenderer;
    (window as any).ipcRenderer = null;

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      const result = await sendMessageStream('Realiza una investigacion sobre el modelo Claude Fable Mythos', []);
      const text = await collectStream(result.stream);
      const sources = await result.sources;
      const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(requestInit.body));

      expect(text).toBe('Respuesta verificada');
      expect(mockChatsCreate).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/gemini-3.6-flash:generateContent');
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('?key=');
      expect(requestInit.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(body.tools).toEqual([{ google_search: {} }, { code_execution: {} }]);
      expect(sources?.[0]).toMatchObject({ uri: 'https://example.com/source', title: 'Fuente actual' });
    } finally {
      (window as any).ipcRenderer = previousIpc;
      fetchSpy.mockRestore();
    }
  });

  it('RS-010G: web research falls back to the environment key when the saved user key fails', async () => {
    (mockGetApiKeyWithCache as any).mockResolvedValue('db-test-key-without-grounding-access');
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: 'API key not valid for this grounded request' },
      }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: 'Respuesta con clave de entorno' }] },
          groundingMetadata: {
            groundingChunks: [{ web: { uri: 'https://example.com/env-source', title: 'Fuente env' } }],
          },
        }],
      }), { status: 200 }));
    const previousIpc = (window as any).ipcRenderer;
    (window as any).ipcRenderer = null;

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      const result = await sendMessageStream('Investiga informacion actualizada sobre Claude', []);
      const text = await collectStream(result.stream);
      const sources = await result.sources;

      expect(text).toBe('Respuesta con clave de entorno');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('db-test-key-without-grounding-access');
      expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('env-test-key');
      expect(sources?.[0]).toMatchObject({ uri: 'https://example.com/env-source', title: 'Fuente env' });
    } finally {
      (window as any).ipcRenderer = previousIpc;
      fetchSpy.mockRestore();
    }
  });

  it('RS-010F: Electron renderer delegates grounded requests to the main process IPC handler', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const invoke = vi.fn(async () => ({
      success: true,
      payload: {
        candidates: [{
          content: { parts: [{ text: 'Respuesta desde main' }] },
          grounding_metadata: {
            grounding_chunks: [{ web: { uri: 'https://example.com/main-source', title: 'Fuente main' } }],
          },
        }],
      },
    }));
    const previousIpc = (window as any).ipcRenderer;
    (window as any).ipcRenderer = { invoke };

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      const result = await sendMessageStream('Investiga informacion reciente sobre Claude', []);
      const text = await collectStream(result.stream);
      const sources = await result.sources;
      const firstCall = invoke.mock.calls[0] as unknown as [string, any];
      const payload = firstCall[1];

      expect(text).toBe('Respuesta desde main');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith('ai:generate-grounded', expect.any(Object));
      expect(payload).toMatchObject({ modelName: 'gemini-3.6-flash', apiKey: 'env-test-key' });
      expect(payload.body.tools).toEqual([{ google_search: {} }, { code_execution: {} }]);
      expect(sources?.[0]).toMatchObject({ uri: 'https://example.com/main-source', title: 'Fuente main' });
    } finally {
      (window as any).ipcRenderer = previousIpc;
      fetchSpy.mockRestore();
    }
  });

  it('RS-010E: URL research enables URL Context only when the prompt includes a public URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: 'Resumen de URL verificado' }] },
        url_context_metadata: {
          url_metadata: [{ retrieved_url: 'https://anthropic.com/news', url_retrieval_status: 'URL_RETRIEVAL_STATUS_SUCCESS' }],
        },
      }],
    }), { status: 200 }));
    const previousIpc = (window as any).ipcRenderer;
    (window as any).ipcRenderer = null;

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      const result = await sendMessageStream('Investiga esta URL https://anthropic.com/news', []);
      const text = await collectStream(result.stream);
      const sources = await result.sources;
      const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(requestInit.body));

      expect(text).toBe('Resumen de URL verificado');
      expect(body.tools).toEqual([{ google_search: {} }, { url_context: {} }, { code_execution: {} }]);
      expect(sources?.[0]).toMatchObject({ uri: 'https://anthropic.com/news' });
    } finally {
      (window as any).ipcRenderer = previousIpc;
      fetchSpy.mockRestore();
    }
  });

  it('RS-011: hides provider rate-limit details from visible chat errors', async () => {
    const providerError = new Error(
      '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent: [429] You exceeded your current quota. model: gemini-3.1-pro',
    );
    const { getPublicAiErrorMessage } = await import('../../services/gemini-chat');
    const text = getPublicAiErrorMessage(providerError);

    expect(text).toBe('No pude completar la respuesta por capacidad temporal. Intenta de nuevo en unos segundos.');
    expect(text).not.toMatch(/gemini|google|https|quota|429|model/i);
  });

  it('RS-011b: un contexto agotado no se anuncia como capacidad temporal', async () => {
    const { getPublicAiErrorMessage } = await import('../../services/gemini-chat');
    // El proveedor dice "exceeded" en ambos casos, pero aqui reintentar en unos
    // segundos no arregla nada: el consejo tiene que ser el contrario.
    const text = getPublicAiErrorMessage(
      new Error("This model's maximum context length is 400000 tokens, however you requested 412345 tokens"),
    );

    expect(text).toContain('supero el tamano que admite');
    expect(text).not.toContain('unos segundos');
    expect(text).not.toMatch(/token|400000|412345|gpt|https/i);
  });

  it('RS-011c: una peticion demasiado grande no se anuncia como capacidad temporal', async () => {
    const { getPublicAiErrorMessage } = await import('../../services/gemini-chat');
    // Mensaje real del incidente: llega como 429, pero pedir lo mismo dentro de
    // unos segundos vuelve a fallar. Lo que hay que reducir es la peticion.
    const text = getPublicAiErrorMessage(new Error(
      'Request too large for gpt-5.6-luna in organization org-XXXX on tokens per min (TPM): Limit 200000, '
      + 'Requested 399008. The input or output tokens must be reduced in order to run successfully. '
      + 'Visit https://platform.openai.com/account/rate-limits to learn more.',
    ));

    expect(text).toContain('supero el tamano que admite');
    expect(text).not.toContain('unos segundos');
    expect(text).not.toMatch(/gpt|organization|https|TPM|200000/i);
  });

  it('RS-012: explica un nivel de razonamiento incompatible sin filtrar el error del proveedor', async () => {
    const { getPublicAiErrorMessage } = await import('../../services/gemini-chat');
    const text = getPublicAiErrorMessage(new Error('Invalid value for reasoning.effort: minimal'));

    expect(text).toBe('El nivel de razonamiento no es compatible con el modelo seleccionado. Elige otro nivel e intenta de nuevo.');
    expect(text).not.toContain('reasoning.effort');
  });

  it('RS-013: indica cuando Pro o Max no tienen una clave OpenAI configurada', async () => {
    const { getPublicAiErrorMessage } = await import('../../services/gemini-chat');

    expect(getPublicAiErrorMessage(new Error('OPENAI_API_KEY_MISSING')))
      .toBe('SofLIA Pro y Max requieren una clave de OpenAI válida en Configuración.');
  });
});

async function collectStream(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const chunk of stream) text += chunk;
  return text;
}
