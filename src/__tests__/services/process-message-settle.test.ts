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
