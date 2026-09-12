/**
 * Tests SETTLE-1..3: processChatMessage SIEMPRE resuelve el placeholder "...".
 *
 * Un turno que termina sin texto (típico cuando el modelo solo hace tool calls),
 * que falla, o que se cancela, jamás debe dejar un "..." pegado — porque la carga
 * es por-placeholder y un "..." residual bloquea la conversación para siempre.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../services/chat-service';

const mocks = vi.hoisted(() => ({
  sendMessageStream: vi.fn(),
  optimizePrompt: vi.fn(),
  getPublicAiErrorMessage: vi.fn(() => 'Error público seguro.'),
  generateImage: vi.fn(),
  needsIrisData: vi.fn(() => false),
  buildIrisContext: vi.fn(async () => ''),
  fetchChatMemoryContext: vi.fn(async () => ''),
  recordChatTurn: vi.fn(),
}));

vi.mock('../../services/gemini-chat', () => ({
  sendMessageStream: mocks.sendMessageStream,
  optimizePrompt: mocks.optimizePrompt,
  getPublicAiErrorMessage: mocks.getPublicAiErrorMessage,
}));
vi.mock('../../services/image-generation', () => ({ generateImage: mocks.generateImage }));
vi.mock('../../services/iris-data', () => ({ needsIrisData: mocks.needsIrisData, buildIrisContext: mocks.buildIrisContext }));
vi.mock('../../services/memory-bridge', () => ({ fetchChatMemoryContext: mocks.fetchChatMemoryContext, recordChatTurn: mocks.recordChatTurn }));

import { processChatMessage } from '../../hooks/chat-processor/process-message';
import { normalizeMessage } from '../../services/chat/normalize/messages';

function singleChunk(text: string): AsyncIterable<string> {
  return (async function* () { if (text) yield text; })();
}

function baseInput(overrides: Record<string, unknown> = {}) {
  const captured: ChatMessage[][] = [];
  const input = {
    text: 'hola',
    images: [],
    currentHistory: [],
    isRegeneration: false,
    onMessagesChange: (messages: ChatMessage[]) => { captured.push(messages); },
    setIsLoading: vi.fn(),
    setActiveToolCall: vi.fn(),
    preferredPrimaryModel: 'gemini-x',
    isPromptOptimizerMode: false,
    optimizerTarget: 'gemini' as const,
    isImageGenMode: false,
    activeTool: null,
    ...overrides,
  };
  return { input, lastMessages: () => captured[captured.length - 1] };
}

function lastAiText(messages: ChatMessage[]): string | undefined {
  return [...messages].reverse().find((message) => message.role === 'model')?.text;
}

describe('process-message settle guarantee', () => {
  it('conserva fragmentos reales en el turno, respuesta y reapertura, también al regenerar', async () => {
    const source = { kind: 'browser' as const, citationId: 'P1:F1', title: 'Documento', uri: 'https://example.com/p', snippet: 'Evidencia textual', capturedAt: '2026-09-09T12:00:00.000Z' };
    mocks.sendMessageStream.mockResolvedValue({ stream: singleChunk('Conclusión [P1:F1]'), sources: Promise.resolve([{ title: 'Fuente web', uri: 'https://web.example/' }]) });
    const { input, lastMessages } = baseInput({ browserSources: [source] });
    await processChatMessage(input as never);
    expect(mocks.sendMessageStream.mock.calls[0][0]).toContain('Evidencia textual');
    expect(mocks.sendMessageStream.mock.calls[0][0]).toContain('P1:F1');
    const reopened = lastMessages().map((message) => normalizeMessage(JSON.parse(JSON.stringify(message)))!);
    expect(reopened[0].sources).toEqual([source]);
    expect(reopened[1].sources).toContainEqual(source);
    expect(reopened[1].sources).toContainEqual({ title: 'Fuente web', uri: 'https://web.example/' });
    mocks.sendMessageStream.mockResolvedValue({ stream: singleChunk('Nueva conclusión [P1:F1]'), sources: Promise.resolve(null) });
    const regenerated = baseInput({ isRegeneration: true, currentHistory: [reopened[0]], browserSources: reopened[0].sources });
    await processChatMessage(regenerated.input as never);
    expect(regenerated.lastMessages()).toHaveLength(2);
    expect(regenerated.lastMessages()[1].sources).toEqual([source]);
  });
  beforeEach(() => vi.clearAllMocks());

  it('SETTLE-1: un resultado sin texto resuelve el placeholder con un respaldo (no "...")', async () => {
    mocks.sendMessageStream.mockResolvedValue({ stream: singleChunk(''), sources: Promise.resolve(null), generatedImages: undefined });
    const { input, lastMessages } = baseInput();

    await processChatMessage(input as never);

    const text = lastAiText(lastMessages());
    expect(text).not.toBe('...');
    expect(text).toContain('No obtuve una respuesta');
  });

  it('SETTLE-2: un error resuelve el placeholder con el mensaje de error (no "...")', async () => {
    mocks.sendMessageStream.mockRejectedValue(new Error('boom'));
    const { input, lastMessages } = baseInput();

    await processChatMessage(input as never);

    expect(lastAiText(lastMessages())).toBe('Error público seguro.');
  });

  it('SETTLE-3: una respuesta normal se muestra tal cual', async () => {
    mocks.sendMessageStream.mockResolvedValue({ stream: singleChunk('respuesta real'), sources: Promise.resolve(null), generatedImages: undefined });
    const { input, lastMessages } = baseInput();

    await processChatMessage(input as never);

    expect(lastAiText(lastMessages())).toBe('respuesta real');
  });

  it('SETTLE-4: una generación superada (isCurrent=false) no pisa el chat con su respuesta', async () => {
    mocks.sendMessageStream.mockResolvedValue({ stream: singleChunk('respuesta vieja'), sources: Promise.resolve(null), generatedImages: undefined });
    const { input, lastMessages } = baseInput({ isCurrent: () => false });

    await processChatMessage(input as never);

    // Solo escribió el placeholder inicial; nunca el texto de la respuesta vieja.
    expect(lastAiText(lastMessages())).toBe('...');
  });
});
