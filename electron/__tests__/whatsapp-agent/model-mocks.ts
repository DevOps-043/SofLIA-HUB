import { vi } from 'vitest';

const modelMocks = vi.hoisted(() => {
  const mockSendMessage = vi.fn();

  return {
    mockSendMessage,
    // El agentic loop crea la sesion con `chats.create` de @google/genai.
    mockChatsCreate: vi.fn().mockReturnValue({ sendMessage: mockSendMessage }),
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { chats: { create: modelMocks.mockChatsCreate } };
  }),
}));

export function getMockSendMessage() {
  return modelMocks.mockSendMessage;
}

export function getMockChatsCreate() {
  return modelMocks.mockChatsCreate;
}

/**
 * `@google/genai` devuelve la respuesta directa, sin el envoltorio `{ response }`
 * que usaba el SDK legado.
 */
export function mockTextResponse(text: string) {
  modelMocks.mockSendMessage.mockResolvedValueOnce({
    text,
    candidates: [{ content: { parts: [{ text }] } }],
    functionCalls: undefined,
  });
}

// Las pruebas del bucle aíslan el transporte; openai-session tiene pruebas propias.
vi.mock('../../ai-provider/session-client', () => ({ getSessionOpenAIClient: vi.fn(async () => ({})) }));
vi.mock('../../wa-agent/openai-session', () => ({ createWhatsAppOpenAISession: (input: { instructions: string; history: unknown[]; tools: unknown[] }) => modelMocks.mockChatsCreate({ model: 'gpt-6-luna', config: { systemInstruction: input.instructions, tools: input.tools }, history: input.history }) }));
