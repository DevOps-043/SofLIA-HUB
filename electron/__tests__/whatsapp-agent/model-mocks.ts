import { vi } from 'vitest';

const modelMocks = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockSendMessage = vi.fn();

  return {
    mockGenerateContent,
    mockSendMessage,
    // El agentic loop crea la sesion con `chats.create` de @google/genai.
    mockChatsCreate: vi.fn().mockReturnValue({ sendMessage: mockSendMessage }),
    mockGetGenerativeModel: vi.fn().mockReturnValue({ generateContent: mockGenerateContent }),
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { chats: { create: modelMocks.mockChatsCreate } };
  }),
}));

// El SDK legado sigue en uso para los consumidores de un solo disparo del
// agente (transcripcion de audio, presentaciones); se mockea para que ninguna
// prueba construya el cliente real.
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    return { getGenerativeModel: modelMocks.mockGetGenerativeModel };
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
