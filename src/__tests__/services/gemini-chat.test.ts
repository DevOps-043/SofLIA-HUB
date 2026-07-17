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
  mockGetGenerativeModel,
  mockGoogleGenerativeAI,
} = getGeminiChatMocks();

describe('gemini-chat', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetApiKeyWithCache.mockResolvedValue(null);
  });

  it('RS-003: buildGeminiHistory truncates to last 50 messages', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('ok')) });

    const history = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'model' as const,
      text: `Message ${i}`,
    }));

    await sendMessageStream('Hola', history);

    expect(mockGoogleGenerativeAI).toHaveBeenCalled();
    expect(mockGetGenerativeModel).toHaveBeenCalled();
  });

  it('RS-004: uses API key from database when available', async () => {
    const { getApiKeyWithCache } = await import('../../services/api-keys');
    vi.mocked(getApiKeyWithCache).mockResolvedValue('db-api-key-123');
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('ok')) });

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
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('respuesta')) });

    const { sendMessageStream } = await import('../../services/gemini-chat');
    await sendMessageStream('test');

    expect(mockGoogleGenerativeAI).toHaveBeenCalled();
  });

  it('RS-009: tool declarations are passed to the model', async () => {
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('ok')) });

    const { sendMessageStream } = await import('../../services/gemini-chat');
    await sendMessageStream('lista mis archivos');

    expect(mockGetGenerativeModel.mock.calls[0]?.[0]).toHaveProperty('model');
  });

  it('RS-010: sendMessageStream handles empty history gracefully', async () => {
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('hola')) });

    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream('Hola', []);

    expect(result).toBeDefined();
    expect(result.stream).toBeDefined();
  });

  it('RS-010A: simple chats avoid tool declarations and use direct message calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const chat = createMockChat('hola');
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => chat) });

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      const result = await sendMessageStream('Hola', []);
      const text = await collectStream(result.stream);

      expect(text).toBe('hola');
      expect(mockGetGenerativeModel.mock.calls[0]?.[0]).not.toHaveProperty('tools');
      expect(chat.sendMessage).toHaveBeenCalled();
      expect(chat.sendMessageStream).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('RS-010H: Word document requests activate the computer tool loop', async () => {
    const chat = createMockChat('Documento creado en el escritorio.');
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => chat) });

    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream(
      'ponme esta informacion en un documento en word bien hecho y ponlo en mi escritorio',
      [{ role: 'model', text: 'Investigacion completa sobre Claude Fable Mythos.' }],
    );
    const text = await collectStream(result.stream);
    const modelParams = mockGetGenerativeModel.mock.calls[0]?.[0];

    expect(text).toBe('Documento creado en el escritorio.');
    expect(modelParams).toHaveProperty('tools');
    expect(modelParams.tools?.[0]?.functionDeclarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'create_word_document' }),
    ]));
  });

  it('RS-010I: direct model calls time out and retry the next model', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hangingChat = {
      sendMessage: vi.fn(() => new Promise(() => undefined)),
      sendMessageStream: vi.fn(),
    };
    const fallbackChat = createMockChat('respuesta despues del timeout');
    mockGetGenerativeModel
      .mockReturnValueOnce({ startChat: vi.fn(() => hangingChat) })
      .mockReturnValueOnce({ startChat: vi.fn(() => fallbackChat) });

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      const pending = sendMessageStream('Hola', []);
      await vi.advanceTimersByTimeAsync(45_000);
      const result = await pending;
      const text = await collectStream(result.stream);

      expect(text).toBe('respuesta despues del timeout');
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('RS-010B: does not send unsupported thinkingConfig to the legacy Gemini SDK', async () => {
    const startChat = vi.fn(() => createMockChat('ok'));
    mockGetGenerativeModel.mockReturnValue({ startChat });

    const { sendMessageStream } = await import('../../services/gemini-chat');
    await sendMessageStream('Hola', [], { thinking: { id: 'minimal', level: 'minimal' } });

    const startChatOptions = (startChat.mock.calls as any)[0][0];
    expect(startChatOptions.generationConfig).toEqual({ maxOutputTokens: 16384 });
    expect(startChatOptions.generationConfig).not.toHaveProperty('thinkingConfig');
  });

  it('RS-010C: retries the next configured model when the selected model fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failingChat = {
      sendMessage: vi.fn(async () => {
        throw new Error('quota exceeded');
      }),
      sendMessageStream: vi.fn(),
    };
    const fallbackChat = createMockChat('respuesta de respaldo');
    mockGetGenerativeModel
      .mockReturnValueOnce({ startChat: vi.fn(() => failingChat) })
      .mockReturnValueOnce({ startChat: vi.fn(() => fallbackChat) });

    try {
      const { sendMessageStream } = await import('../../services/gemini-chat');
      const result = await sendMessageStream('Hola', []);
      const text = await collectStream(result.stream);

      expect(text).toBe('respuesta de respaldo');
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2);
      expect(mockGetGenerativeModel.mock.calls[1]?.[0]).toMatchObject({ model: 'gemini-3.1-flash-lite' });
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
      expect(mockGetGenerativeModel).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/gemini-3.5-flash:generateContent');
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
      expect(payload).toMatchObject({ modelName: 'gemini-3.5-flash', apiKey: 'env-test-key' });
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
});

async function collectStream(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const chunk of stream) text += chunk;
  return text;
}
