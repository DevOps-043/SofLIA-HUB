import { vi } from 'vitest';

const modelMocks = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockSendMessage = vi.fn();
  const mockStartChat = vi.fn().mockReturnValue({ sendMessage: mockSendMessage });

  return {
    mockGenerateContent,
    mockSendMessage,
    mockGetGenerativeModel: vi.fn().mockReturnValue({
      startChat: mockStartChat,
      generateContent: mockGenerateContent,
    }),
  };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    return { getGenerativeModel: modelMocks.mockGetGenerativeModel };
  }),
}));

export function getMockSendMessage() {
  return modelMocks.mockSendMessage;
}

export function getMockGetGenerativeModel() {
  return modelMocks.mockGetGenerativeModel;
}

export function mockTextResponse(text: string) {
  modelMocks.mockSendMessage.mockResolvedValueOnce({
    response: {
      text: () => text,
      candidates: [{ content: { parts: [{ text }] } }],
      functionCalls: () => null,
    },
  });
}
