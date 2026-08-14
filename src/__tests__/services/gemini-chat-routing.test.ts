/**
 * Tests de prioridad de rutas en sendMessageStream: una ORDEN de accion sobre
 * la computadora debe ir al loop de herramientas aunque mencione palabras de
 * investigacion ("ultima version"); el grounding web queda para consultas
 * informativas sin accion ejecutable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserObservationSnapshot } from '../../services/integrated-browser-service';
import { createMockChat, getGeminiChatMocks } from './gemini-chat.setup';

const groundingMocks = vi.hoisted(() => ({
  sendGroundedMessage: vi.fn(async () => ({
    stream: (async function* () { yield 'respuesta con fuentes'; })(),
    response: Promise.resolve({}),
    toolCalls: [],
    generatedImages: [],
  })),
}));

const providerMocks = vi.hoisted(() => ({
  sendOpenAIMessageStream: vi.fn(async () => ({
    stream: (async function* () { yield 'respuesta OpenAI'; })(),
    sources: Promise.resolve(null),
    toolCalls: [],
    generatedImages: [],
  })),
}));

vi.mock('../../services/openai-chat', () => ({
  sendOpenAIMessageStream: providerMocks.sendOpenAIMessageStream,
}));

vi.mock('../../services/gemini-chat/web-grounding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/gemini-chat/web-grounding')>();
  return { ...actual, sendGroundedMessage: groundingMocks.sendGroundedMessage };
});

const { mockGetGenerativeModel } = getGeminiChatMocks();

function installVisibleBrowserObservation(options?: { observation?: BrowserObservationSnapshot | null }) {
  const observation = options && 'observation' in options ? options.observation : {
    id: 'obs-contextual', sequence: 9, capturedAt: '2026-08-05T12:00:00.000Z', tabId: 'tab-chat',
    screenshot: 'data:image/png;base64,Y2hhdC12aXNpYmxl',
    dom: {
      title: 'Correo de SofLIA', url: 'https://mail.google.com/mail/u/0/#chat/home', language: 'es',
      text: 'Ernesto Hernández Martínez compartió Tencent Cloud · GitHub', headings: [], landmarks: [],
      controls: [{ ref: 'dom-1', tag: 'a', role: 'link', name: 'Tencent Cloud · GitHub', text: 'https://github.com/TencentCloud', type: '', href: 'https://github.com/TencentCloud', disabled: false, checked: null, rect: { x: 1, y: 1, width: 20, height: 10 }, scope: 'document' }],
      images: [{ url: 'https://github.com/hero.png', alt: 'Diagrama del repositorio', width: 1200, height: 700 }],
      frames: [], viewport: { width: 1200, height: 800, scrollX: 0, scrollY: 0, documentWidth: 1200, documentHeight: 800 }, truncated: false,
    },
  };
  const api = {
    getState: vi.fn(async () => ({
      success: true,
      state: { isVisible: true, url: 'https://mail.google.com/mail/u/0/#chat/home', title: 'Correo de SofLIA' },
    })),
    getObservation: vi.fn(async () => ({
      success: true,
      observation,
      state: { isVisible: true, url: 'https://mail.google.com/mail/u/0/#chat/home', title: 'Correo de SofLIA' },
    })),
  };
  Object.defineProperty(window, 'integratedBrowser', { configurable: true, value: api });
  return api;
}

describe('gemini-chat: prioridad accion vs grounding web', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Reflect.deleteProperty(window, 'integratedBrowser');
    Reflect.deleteProperty(window, 'skillWorkspace');
  });

  it('RT-001: una orden de accion con palabras de investigacion usa herramientas, no grounding', async () => {
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('ok')) });
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('abre minecraft y ejecutalo en su ultima version');

    expect(groundingMocks.sendGroundedMessage).not.toHaveBeenCalled();
    expect(mockGetGenerativeModel).toHaveBeenCalled();
    expect(mockGetGenerativeModel.mock.calls[0]?.[0]?.tools).toBeDefined();
  });

  it('RT-002: una consulta informativa sobre versiones sigue usando grounding web', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('cual es la ultima version de minecraft');

    expect(groundingMocks.sendGroundedMessage).toHaveBeenCalled();
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  it('RT-003: "reproduce X" activa el loop de herramientas aunque no diga "abre"', async () => {
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('ok')) });
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('reproduce without warning en youtube music');

    expect(groundingMocks.sendGroundedMessage).not.toHaveBeenCalled();
    expect(mockGetGenerativeModel.mock.calls[0]?.[0]?.tools).toBeDefined();
  });

  it('RT-004: "instala la actualizacion mas reciente de X" es accion, no investigacion', async () => {
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('ok')) });
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('instala la actualizacion mas reciente de spotify');

    expect(groundingMocks.sendGroundedMessage).not.toHaveBeenCalled();
    expect(mockGetGenerativeModel.mock.calls[0]?.[0]?.tools).toBeDefined();
  });

  it('RT-005: una referencia a la vista actual inspecciona el navegador visible antes de responder', async () => {
    const chat = createMockChat('Veo la pagina actual.');
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => chat) });
    Object.defineProperty(window, 'integratedBrowser', {
      configurable: true,
      value: {
        getState: vi.fn(async () => ({
          success: true,
          state: { isVisible: true, url: 'https://example.com/', title: 'Ejemplo' },
        })),
        getObservation: vi.fn(async () => ({
          success: true,
          observation: {
            id: 'obs-1', sequence: 1, capturedAt: '2026-08-05T01:00:00.000Z', tabId: 'tab-1',
            screenshot: 'data:image/png;base64,Y2FwdHVyYQ==',
            dom: { title: 'Ejemplo', url: 'https://example.com/', language: 'es', text: 'Contenido visible', headings: [], landmarks: [], controls: [], frames: [], viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 600 }, truncated: false },
          },
          state: { isVisible: true, url: 'https://example.com/', title: 'Ejemplo' },
        })),
      },
    });
    const onToolCall = vi.fn();
    const { sendMessageStream } = await import('../../services/gemini-chat');

    const result = await sendMessageStream('puedes ver lo que estoy viendo?', [], { onToolCall });

    expect(onToolCall).toHaveBeenCalledWith(expect.objectContaining({ name: 'inspect_browser_view' }));
    expect(result.toolCalls?.[0]).toEqual(expect.objectContaining({ name: 'inspect_browser_view' }));
    expect(chat.sendMessage).toHaveBeenCalledWith(expect.arrayContaining([
      expect.stringContaining('INICIO_CONTEXTO_DOM_NO_CONFIABLE'),
      expect.objectContaining({ inlineData: { mimeType: 'image/png', data: 'Y2FwdHVyYQ==' } }),
    ]), undefined);
    expect(mockGetGenerativeModel.mock.calls[0]?.[0]?.systemInstruction).not.toContain('Contenido visible');
    expect(mockGetGenerativeModel.mock.calls[0]?.[0]?.tools).toBeUndefined();
  });

  it('RT-005B: una presentacion importa los visuales de la pagina y entrega sus rutas locales al modelo', async () => {
    installVisibleBrowserObservation();
    const downloadImage = vi.fn(async (_workspaceId: string, _url: string, fileName: string) => ({
      success: true,
      file: { path: `assets/${fileName}.png` },
    }));
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = {
      writeImage: vi.fn(),
      downloadImage,
    };
    const chat = createMockChat('Presentacion preparada.');
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => chat) });
    const { PRESENTACIONES_SKILL_PROMPT } = await import('../../prompts/skills/presentaciones');
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('Haz una presentacion de la pagina que tengo abierta', [], {
      model: 'gemini-3.6-flash',
      activeSkill: {
        id: 'sistema:presentaciones',
        name: 'Presentaciones',
        instructions: PRESENTACIONES_SKILL_PROMPT,
        tools: [],
        workspaceId: 'deck-web',
      },
    });

    expect(downloadImage).toHaveBeenCalledWith(
      'deck-web',
      'https://github.com/hero.png',
      expect.stringMatching(/^fuente-web-[a-f0-9]{8}$/),
    );
    expect(chat.sendMessage).toHaveBeenCalledWith(expect.arrayContaining([
      expect.stringContaining('INICIO_MANIFIESTO_VISUALES_FUENTE_NO_CONFIABLE'),
      expect.stringMatching(/assets\/fuente-web-[a-f0-9]{8}\.png/),
      expect.stringContaining('"images"'),
    ]), undefined);
  });

  it('RT-006: no inventa una observacion si el navegador integrado no esta visible', async () => {
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('Necesito abrir la vista.')) });
    Object.defineProperty(window, 'integratedBrowser', {
      configurable: true,
      value: {
        getState: vi.fn(async () => ({
          success: true,
          state: { isVisible: false },
        })),
        captureVisible: vi.fn(),
        getObservation: vi.fn(),
      },
    });
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('ves lo que estoy viendo?');

    expect(window.integratedBrowser?.getObservation).not.toHaveBeenCalled();
    expect(mockGetGenerativeModel.mock.calls[0]?.[0]?.tools).toBeDefined();
  });

  it('RT-007: SofLIA Pro usa OpenAI y conserva el esfuerzo seleccionado', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('Hola', [], {
      model: 'gpt-5.6-luna',
      thinking: { id: 'xhigh', level: 'xhigh' },
    });

    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'gpt-5.6-luna',
      options: expect.objectContaining({
        model: 'gpt-5.6-luna',
        thinking: { id: 'xhigh', level: 'xhigh' },
      }),
    }));
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  it('RT-008: SofLIA Lite usa Gemini y envia su nivel de razonamiento', async () => {
    const startChat = vi.fn(() => createMockChat('respuesta Gemini'));
    mockGetGenerativeModel.mockReturnValue({ startChat });
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('Hola', [], {
      model: 'gemini-3.5-flash-lite',
      thinking: { id: 'high', level: 'high' },
    });

    expect(providerMocks.sendOpenAIMessageStream).not.toHaveBeenCalled();
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.5-flash-lite',
    }));
    expect(startChat).toHaveBeenCalledWith(expect.objectContaining({
      generationConfig: expect.objectContaining({
        thinkingConfig: { thinkingLevel: 'high' },
      }),
    }));
  });

  it('RT-009: Computer Use conserva SofLIA Max como orquestador y delega use_computer al actuador', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('abre el bloc de notas', [], {
      model: 'gpt-5.6-terra',
      thinking: { id: 'max', level: 'max' },
    });

    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'gpt-5.6-terra',
      useToolLoop: true,
      computerUseEnabled: true,
      options: expect.objectContaining({
        model: 'gpt-5.6-terra',
        thinking: { id: 'max', level: 'max' },
      }),
    }));
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  it('RT-013: leer una carpeta local no se degrada a investigación web aunque pida versiones recientes', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');

    // Caso reportado: el turno se quedaba sin herramientas locales porque
    // "versiones" y "recientes" activan grounding, y "entra"/"busca"/"analiza"
    // no figuran entre las órdenes de acción.
    await sendMessageStream(
      'entra a la carpeta PulseHub y busca el archivo package.json y analiza las dependencias desactualizadas y las versiones mas recientes',
      [],
      { model: 'gpt-5.6-luna' },
    );

    expect(groundingMocks.sendGroundedMessage).not.toHaveBeenCalled();
    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      useToolLoop: true,
      computerUseEnabled: true,
      // La parte de investigación del encargo se conserva con la herramienta
      // hospedada, sin sacrificar las herramientas de archivos.
      useWebSearch: true,
    }));
  });

  it('RT-014: una ruta del sistema basta para habilitar las herramientas locales', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream(
      'esta es la ruta C:\\Users\\fysg5\\OneDrive\\Escritorio\\PulseHub\\SofLIA-HUB, dame el informe de versiones',
      [],
      { model: 'gpt-5.6-luna' },
    );

    expect(groundingMocks.sendGroundedMessage).not.toHaveBeenCalled();
    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({ useToolLoop: true }));
  });

  it('RT-015: una consulta informativa sin recurso local sigue yendo a grounding', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('cuales son las versiones mas recientes de react y typescript', [], {
      model: 'gpt-5.6-luna',
    });

    expect(groundingMocks.sendGroundedMessage).not.toHaveBeenCalled();
    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      useToolLoop: false,
      useWebSearch: true,
    }));
  });

  it('RT-010: una configuración OpenAI inválida no consume cuota de SofLIA Max', async () => {
    const userId = 'usuario-sin-clave-openai';
    const { remainingSofliaMaxUses, resetSofliaMaxQuota } = await import('../../services/model-quota');
    resetSofliaMaxQuota(userId);
    providerMocks.sendOpenAIMessageStream.mockRejectedValueOnce(new Error('OPENAI_API_KEY_MISSING'));
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await expect(sendMessageStream('Hola', [], {
      model: 'gpt-5.6-terra',
      thinking: { id: 'medium', level: 'medium' },
      userId,
    })).rejects.toThrow('OPENAI_API_KEY_MISSING');

    expect(remainingSofliaMaxUses(userId)).toBe(3);
  });

  it('RT-011: un repositorio compartido habilita DOM y web_search sin forzar Computer Use', async () => {
    const browser = installVisibleBrowserObservation();
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('haz un resumen del repositorio que me mandó Ernesto', [], {
      model: 'gpt-5.6-luna',
    });

    expect(browser.getObservation).toHaveBeenCalledWith(true);
    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'gpt-5.6-luna',
      useToolLoop: true,
      computerUseEnabled: true,
      useWebSearch: true,
      finalMessage: expect.stringContaining('Tencent Cloud · GitHub'),
      systemInstruction: expect.stringContaining('contenido detrás de un recurso visible'),
      options: expect.objectContaining({
        model: 'gpt-5.6-luna',
        images: ['data:image/png;base64,Y2hhdC12aXNpYmxl'],
      }),
    }));
    const providerCalls = providerMocks.sendOpenAIMessageStream.mock.calls as unknown as Array<[{ systemInstruction?: string }]>;
    const lastProviderCall = providerCalls[providerCalls.length - 1]?.[0];
    expect(lastProviderCall?.systemInstruction)
      .toContain('Reserva use_computer para lo que ese controlador no cubra');
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  it('RT-012: SofLIA Pro recibe imagen y DOM para leer el chat visible sin abrir otra sesión', async () => {
    installVisibleBrowserObservation();
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('¿qué dice el chat que tengo abierto?', [], { model: 'gpt-5.6-luna' });

    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'gpt-5.6-luna',
      useToolLoop: false,
      finalMessage: expect.stringContaining('Tencent Cloud · GitHub'),
      systemInstruction: expect.stringContaining('referencias a personas, mensajes y recursos visibles'),
      options: expect.objectContaining({
        images: ['data:image/png;base64,Y2hhdC12aXNpYmxl'],
      }),
    }));
  });

  it('RT-013: si falta la captura contextual intenta leer DOM antes de Computer Use', async () => {
    installVisibleBrowserObservation({ observation: null });
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('haz un resumen del repositorio que me mandó Ernesto', [], {
      model: 'gpt-5.6-luna',
    });

    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'gpt-5.6-luna',
      useToolLoop: true,
      useWebSearch: true,
      systemInstruction: expect.stringContaining('intenta read_browser_dom'),
    }));
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  it('RT-014: SofLIA Gemini amplía un enlace visible con grounding sin iniciar el loop visual', async () => {
    installVisibleBrowserObservation();
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('haz un resumen del repositorio que me mandó Ernesto', [], {
      model: 'gemini-3.6-flash',
    });

    expect(groundingMocks.sendGroundedMessage).toHaveBeenCalledWith(expect.objectContaining({
      finalMessage: expect.stringContaining('https://github.com/TencentCloud'),
      systemInstruction: expect.stringContaining('búsqueda web o URL Context'),
    }));
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  it('RT-015: una interacción explícita conserva Computer Use y no se convierte en búsqueda web', async () => {
    const startChat = vi.fn(() => createMockChat('clic completado'));
    mockGetGenerativeModel.mockReturnValue({ startChat });
    installVisibleBrowserObservation();
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('haz clic en ese enlace', [], { model: 'gemini-3.6-flash' });

    expect(groundingMocks.sendGroundedMessage).not.toHaveBeenCalled();
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({
      tools: expect.any(Array),
    }));
  });

  it('RT-016: una búsqueda web normal de SofLIA Pro usa web_search sin tool loop local', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('busca en la web las noticias más recientes de OpenAI', [], {
      model: 'gpt-5.6-luna',
    });

    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'gpt-5.6-luna',
      useWebSearch: true,
      useToolLoop: false,
    }));
  });

  it('RT-017: si el grounding no puede leer un recurso, escala primero a herramientas DOM', async () => {
    const { WEB_GROUNDING_FAILURE } = await import('../../services/gemini-chat/web-grounding');
    groundingMocks.sendGroundedMessage.mockResolvedValueOnce({
      stream: (async function* () { yield WEB_GROUNDING_FAILURE; })(),
      response: Promise.resolve({}),
      toolCalls: [],
      generatedImages: [],
    });
    const startChat = vi.fn(() => createMockChat('lectura por DOM'));
    mockGetGenerativeModel.mockReturnValue({ startChat });
    installVisibleBrowserObservation();
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('haz un resumen del repositorio que me mandó Ernesto', [], {
      model: 'gemini-3.6-flash',
    });

    const modelTools = mockGetGenerativeModel.mock.calls[0]?.[0]?.tools ?? [];
    const declarations = (modelTools as Array<{ functionDeclarations?: Array<{ name: string }> }>)
      .flatMap((group) => group.functionDeclarations || []);
    expect(declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'read_browser_dom' }),
      expect.objectContaining({ name: 'navigate_integrated_browser' }),
    ]));
  });

  it('RT-018: OpenAI conserva web_search en una solicitud mixta antes de actuar', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('busca en la web la documentación oficial y abre el resultado', [], {
      model: 'gpt-5.6-luna',
    });

    expect(providerMocks.sendOpenAIMessageStream).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'gpt-5.6-luna',
      useWebSearch: true,
      useToolLoop: true,
    }));
  });

  it('RT-019: un turno ajeno al navegador no fuerza captura ni DOM aunque la vista este abierta', async () => {
    const browser = installVisibleBrowserObservation();
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('Hola')) });
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('Hola, ayudame a planear mi semana', [], { model: 'gemini-3.6-flash' });

    expect(browser.getState).not.toHaveBeenCalled();
    expect(browser.getObservation).not.toHaveBeenCalled();
  });

  it('RT-019B: crear un documento local no observa el navegador por el verbo escribir', async () => {
    const browser = installVisibleBrowserObservation();
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('documento creado')) });
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream('escribe un documento Word con el resumen', [], { model: 'gemini-3.6-flash' });

    expect(browser.getState).not.toHaveBeenCalled();
    expect(browser.getObservation).not.toHaveBeenCalled();
  });

  it('RT-020: un flujo Codex a Google Chat habilita herramientas sin confundir desktop con el DOM activo', async () => {
    const browser = installVisibleBrowserObservation();
    const startChat = vi.fn(() => createMockChat('flujo preparado'));
    mockGetGenerativeModel.mockReturnValue({ startChat });
    const { sendMessageStream } = await import('../../services/gemini-chat');

    await sendMessageStream(
      'mira lo que hace Codex, prepara un resumen ejecutivo y mandalo al usuario de Google Chat que tengo abierto',
      [],
      { model: 'gemini-3.6-flash' },
    );

    expect(browser.getObservation).not.toHaveBeenCalled();
    const modelConfig = mockGetGenerativeModel.mock.calls[0]?.[0];
    expect(modelConfig?.systemInstruction).toContain('backend desktop');
    const declarations = (modelConfig?.tools as Array<{ functionDeclarations?: Array<{ name: string }> }> | undefined)
      ?.flatMap((group) => group.functionDeclarations || []) ?? [];
    expect(declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'use_computer' }),
      expect.objectContaining({ name: 'read_browser_dom' }),
      expect.objectContaining({ name: 'navigate_integrated_browser' }),
    ]));
  });
});
