/**
 * Tests de prioridad de rutas en sendMessageStream: una ORDEN de accion sobre
 * la computadora debe ir al loop de herramientas aunque mencione palabras de
 * investigacion ("ultima version"); el grounding web queda para consultas
 * informativas sin accion ejecutable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockChat, getGeminiChatMocks } from './gemini-chat.setup';

const groundingMocks = vi.hoisted(() => ({
  sendGroundedMessage: vi.fn(async () => ({
    stream: (async function* () { yield { text: () => 'respuesta con fuentes' }; })(),
    response: Promise.resolve({}),
    toolCalls: [],
    generatedImages: [],
  })),
}));

vi.mock('../../services/gemini-chat/web-grounding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/gemini-chat/web-grounding')>();
  return { ...actual, sendGroundedMessage: groundingMocks.sendGroundedMessage };
});

const { mockGetGenerativeModel } = getGeminiChatMocks();

describe('gemini-chat: prioridad accion vs grounding web', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
});
