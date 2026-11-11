import { vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), client: vi.fn() }));
vi.mock('../ai-provider/session-client', () => ({ getSessionOpenAIClient: mocks.client }));
export function mockTranscription(text = 'Crea un evento para manana') {
  mocks.client.mockResolvedValue({ audio: { transcriptions: { create: mocks.create } } });
  mocks.create.mockResolvedValue({ text });
}
export function getAudioProcessorMocks() { return mocks; }
