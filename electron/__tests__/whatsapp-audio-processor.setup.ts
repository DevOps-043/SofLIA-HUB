import { vi } from 'vitest';

const audioMocks = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  return {
    mockGenerateContent,
    mockGetGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    return { getGenerativeModel: audioMocks.mockGetGenerativeModel };
  }),
}));

export function mockTranscription(text = 'Crea un evento para manana') {
  audioMocks.mockGenerateContent.mockResolvedValue({
    response: { text: () => text },
  });
}

export function getAudioProcessorMocks() {
  return audioMocks;
}
