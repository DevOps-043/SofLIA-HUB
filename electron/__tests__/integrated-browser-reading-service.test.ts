import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserReadingModeService,
  READING_SPEECH_TIMEOUT_MS,
} from '../integrated-browser/reading-mode-service';

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  key: process.env.ELEVENLABS_API_KEY,
  voice: process.env.ELEVENLABS_VOICE_ID,
  model: process.env.ELEVENLABS_MODEL_ID,
  format: process.env.ELEVENLABS_OUTPUT_FORMAT,
};

function createContents(text = 'Hola mundo') {
  return {
    getURL: vi.fn(() => 'https://example.com/lectura'),
    getTitle: vi.fn(() => 'Lectura segura'),
    isDestroyed: vi.fn(() => false),
    executeJavaScript: vi.fn(async () => ({
      title: 'Lectura segura',
      language: 'es',
      blocks: [{ kind: 'paragraph', text, level: null }],
      truncated: false,
    })),
  } as unknown as Electron.WebContents;
}

function elevenLabsResponse(text: string): Response {
  const characters = Array.from(text);
  return new Response(JSON.stringify({
    audio_base64: Buffer.from('audio-mp3').toString('base64'),
    alignment: {
      characters,
      character_start_times_seconds: characters.map((_, index) => index * 0.05),
      character_end_times_seconds: characters.map((_, index) => (index + 1) * 0.05),
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('narracion del modo lectura', () => {
  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = 'elevenlabs-test-key';
    process.env.ELEVENLABS_VOICE_ID = 'voice_test_123';
    delete process.env.ELEVENLABS_MODEL_ID;
    delete process.env.ELEVENLABS_OUTPUT_FORMAT;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    if (originalEnvironment.key === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalEnvironment.key;
    if (originalEnvironment.voice === undefined) delete process.env.ELEVENLABS_VOICE_ID;
    else process.env.ELEVENLABS_VOICE_ID = originalEnvironment.voice;
    if (originalEnvironment.model === undefined) delete process.env.ELEVENLABS_MODEL_ID;
    else process.env.ELEVENLABS_MODEL_ID = originalEnvironment.model;
    if (originalEnvironment.format === undefined) delete process.env.ELEVENLABS_OUTPUT_FORMAT;
    else process.env.ELEVENLABS_OUTPUT_FORMAT = originalEnvironment.format;
  });

  it('READ-004: sintetiza bajo demanda y convierte timestamps en offsets globales', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => elevenLabsResponse(JSON.parse(String(init?.body)).text));
    globalThis.fetch = fetchMock as typeof fetch;
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents: createContents(), tabId: 'tab-1', request: {} });

    const speech = await service.synthesize({
      readingId: content.readingId,
      requestId: 'request-123',
      start: 0,
      end: content.text.length,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`/v1/text-to-speech/voice_test_123/with-timestamps?output_format=mp3_44100_128`);
    expect((init?.headers as Record<string, string>)['xi-api-key']).toBe('elevenlabs-test-key');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      text: 'Hola mundo',
      model_id: 'eleven_turbo_v2_5',
      language_code: 'es',
      apply_text_normalization: 'auto',
    });
    expect(speech.timings).toEqual([
      expect.objectContaining({ start: 0, end: 4 }),
      expect.objectContaining({ start: 5, end: 10 }),
    ]);
    expect(speech.audioBase64).toBe(Buffer.from('audio-mp3').toString('base64'));
  });

  it('READ-005: no llama al proveedor sin configuracion y no expone la clave al renderer', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    globalThis.fetch = vi.fn() as typeof fetch;
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents: createContents(), tabId: 'tab-2', request: {} });

    await expect(service.synthesize({
      readingId: content.readingId,
      requestId: 'request-456',
      start: 0,
      end: content.text.length,
    })).rejects.toThrow(/ELEVENLABS_API_KEY/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('READ-013: actualiza y limpia el resaltado solo durante la sesión y URL preparadas', async () => {
    const contents = createContents();
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents, tabId: 'tab-highlight', request: {} });

    await expect(service.highlight({ readingId: content.readingId, start: 0, end: 4 }))
      .resolves.toEqual({ highlighted: true });
    expect(contents.executeJavaScript).toHaveBeenCalledTimes(4);

    await expect(service.close({ readingId: content.readingId })).resolves.toEqual({ closed: true });
    expect(contents.executeJavaScript).toHaveBeenCalledTimes(6);
    await expect(service.highlight({ readingId: content.readingId, start: 0, end: 4 })).rejects.toThrow(/expiró/i);
  });

  it('READ-015: entrega acciones de la cápsula y sincroniza solo estados válidos', async () => {
    const contents = createContents();
    vi.mocked(contents.executeJavaScript).mockImplementation(async (script) => {
      if (String(script).includes('waitForReadingToolbarActionInPage')) return { readingId: 'reading-toolbar', action: 'speed-up' };
      return true;
    });
    const service = new BrowserReadingModeService();
    const content = await service.prepare({
      contents,
      tabId: 'tab-toolbar',
      request: { selection: 'Hola mundo', sourceUrl: 'https://example.com/lectura' },
    });
    // La página devuelve el id real de la sesión, como hace la función in-page.
    vi.mocked(contents.executeJavaScript).mockImplementation(async (script) => {
      if (String(script).includes('waitForReadingToolbarActionInPage')) return { readingId: content.readingId, action: 'speed-up' };
      return true;
    });

    await expect(service.waitForToolbarAction({ readingId: content.readingId }))
      .resolves.toEqual({ readingId: content.readingId, action: 'speed-up' });
    await expect(service.syncToolbar({
      readingId: content.readingId, status: 'playing', speed: 1.25,
    })).resolves.toEqual({ toolbarVisible: true });
    await expect(service.syncToolbar({
      readingId: content.readingId, status: 'playing', speed: 9,
    })).rejects.toThrow(/estado/i);
  });

  it('READ-022: explica una voz compartida no disponible para el workspace sin reintentar', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      detail: { status: 'voice_not_found', message: 'secret provider detail' },
    }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as typeof fetch;
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents: createContents(), tabId: 'tab-voice', request: {} });

    const failure = await service.synthesize({
      readingId: content.readingId,
      requestId: 'request-voice',
      start: 0,
      end: content.text.length,
    }).catch((error: unknown) => error as Error);

    expect((failure as Error).message).toMatch(/VOICE_ID.*mismo workspace.*API_KEY/i);
    expect((failure as Error).message).not.toContain('secret provider detail');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('READ-016: no espera el mapa DOM completo para mostrar la cápsula', async () => {
    const contents = createContents();
    let resolveHighlight: (() => void) | undefined;
    vi.mocked(contents.executeJavaScript).mockImplementation((script) => {
      if (String(script).includes('installReadingHighlightInPage')) {
        return new Promise((resolve) => { resolveHighlight = () => resolve(true); });
      }
      return Promise.resolve(true);
    });
    const service = new BrowserReadingModeService();
    const prepared = service.prepare({
      contents,
      tabId: 'tab-fast-toolbar',
      request: { selection: 'Hola mundo', sourceUrl: 'https://example.com/lectura' },
    });
    await expect(prepared).resolves.toMatchObject({ selectionOnly: true, text: 'Hola mundo' });
    resolveHighlight?.();
  });

  it('READ-017: no inicia una sesión invisible cuando la cápsula no puede instalarse', async () => {
    const contents = createContents();
    vi.mocked(contents.executeJavaScript)
      .mockResolvedValueOnce({
        title: 'Lectura segura', language: 'es', blocks: [{ kind: 'paragraph', text: 'Hola mundo', level: null }], truncated: false,
      })
      .mockResolvedValueOnce(false);
    const service = new BrowserReadingModeService();

    await expect(service.prepare({ contents, tabId: 'tab-no-toolbar', request: {} }))
      .rejects.toThrow(/controles de lectura/i);
  });

  it('READ-014: rechaza offsets y navegación obsoleta antes de tocar el DOM', async () => {
    const contents = createContents();
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents, tabId: 'tab-stale', request: {} });
    const executionCount = vi.mocked(contents.executeJavaScript).mock.calls.length;

    await expect(service.highlight({ readingId: content.readingId, start: 8, end: 99 })).rejects.toThrow(/rango/i);
    expect(contents.executeJavaScript).toHaveBeenCalledTimes(executionCount);

    vi.mocked(contents.getURL).mockReturnValue('https://example.com/otra');
    await expect(service.highlight({ readingId: content.readingId, start: 0, end: 4 })).rejects.toThrow(/ya no está activa/i);
    expect(contents.executeJavaScript).toHaveBeenCalledTimes(executionCount);
  });

  it('READ-027: subraya el token en la cápsula sin buscarlo en los menús de Google Docs', async () => {
    const url = 'https://docs.google.com/document/d/1EVhZbFG8zsZSEJ90gqLX0SkNzHayM9oE6uZT6ttplw/edit';
    const contents = createContents('Texto seleccionado del documento.');
    vi.mocked(contents.getURL).mockReturnValue(url);
    vi.mocked(contents.executeJavaScript).mockResolvedValue(true);
    const service = new BrowserReadingModeService();
    const content = await service.prepare({
      contents,
      tabId: 'tab-docs-highlight',
      request: { selection: 'Texto seleccionado del documento.', sourceUrl: url },
    });
    const callsAfterPrepare = vi.mocked(contents.executeJavaScript).mock.calls.length;

    await expect(service.highlight({ readingId: content.readingId, start: 0, end: 5 }))
      .resolves.toEqual({ highlighted: true });
    expect(contents.executeJavaScript).toHaveBeenCalledTimes(callsAfterPrepare + 1);
    const executionCalls = vi.mocked(contents.executeJavaScript).mock.calls;
    expect(String(executionCalls[executionCalls.length - 1]?.[0]))
      .toContain('updateReadingToolbarCueInPage');
  });

  it('READ-029: pronuncia marca y decimal en español conservando offsets originales', async () => {
    const source = 'SofLIA versión 5.12 avanza.';
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      return elevenLabsResponse(body.text);
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents: createContents(source), tabId: 'tab-diccion', request: {} });

    const speech = await service.synthesize({
      readingId: content.readingId,
      requestId: 'request-diccion',
      start: 0,
      end: source.length,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.text).toBe('Soflía versión cinco punto doce avanza.');
    expect(body.language_code).toBe('es');
    expect(speech.timings[0]).toMatchObject({ start: 0, end: 6 });
    expect(speech.timings.every((timing) => timing.start >= 0 && timing.end <= source.length)).toBe(true);
    expect(speech.timings.some((timing) => timing.start >= source.indexOf('5.12') && timing.end <= source.indexOf('5.12') + 4)).toBe(true);
  });

  it('READ-030: aporta contexto vecino sin duplicarlo dentro del audio', async () => {
    const source = 'Contexto anterior. SofLIA avanza. Contexto posterior.';
    const start = source.indexOf('SofLIA');
    const end = start + 'SofLIA avanza.'.length;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      return elevenLabsResponse(body.text);
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents: createContents(source), tabId: 'tab-contexto', request: {} });

    await service.synthesize({
      readingId: content.readingId,
      requestId: 'request-contexto',
      start,
      end,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      text: 'Soflía avanza.',
      previous_text: 'Contexto anterior.',
      next_text: 'Contexto posterior.',
    });
  });

  it('READ-011: cancela una sintesis en vuelo sin conservar una solicitud parcial', async () => {
    let signal: AbortSignal | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('abortada')), { once: true });
      });
    }) as typeof fetch;
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents: createContents(), tabId: 'tab-4', request: {} });
    const pending = service.synthesize({
      readingId: content.readingId,
      requestId: 'request-cancel',
      start: 0,
      end: content.text.length,
    });
    await vi.waitFor(() => expect(signal).toBeDefined());

    expect(service.cancel({ readingId: content.readingId, requestId: 'request-cancel' })).toEqual({ canceled: 1 });
    await expect(pending).rejects.toThrow(/cancelada/i);
    expect(service.cancel({ readingId: content.readingId, requestId: 'request-cancel' })).toEqual({ canceled: 0 });
  });

  it('READ-020: cancela un lote lento y devuelve un error recuperable dentro del presupuesto', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('abortada')), { once: true });
    })) as typeof fetch;
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents: createContents(), tabId: 'tab-timeout', request: {} });
    const pending = service.synthesize({
      readingId: content.readingId,
      requestId: 'request-timeout',
      start: 0,
      end: content.text.length,
    });
    const rejection = expect(pending).rejects.toThrow(/tardó demasiado/i);

    await vi.advanceTimersByTimeAsync(READING_SPEECH_TIMEOUT_MS);
    await rejection;
    expect(service.cancel({ readingId: content.readingId, requestId: 'request-timeout' })).toEqual({ canceled: 0 });
  });

  it('READ-012: expira sesiones y rechaza audio fuera de su ventana efimera', async () => {
    vi.useFakeTimers();
    const service = new BrowserReadingModeService();
    const content = await service.prepare({ contents: createContents(), tabId: 'tab-5', request: {} });
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1);

    await expect(service.synthesize({
      readingId: content.readingId,
      requestId: 'request-expired',
      start: 0,
      end: content.text.length,
    })).rejects.toThrow(/expiró/i);
  });
});
