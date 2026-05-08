import { vi } from 'vitest';

export const mockGenerateContent = vi.fn();
export const mockGetGenerativeModel = vi.fn(() => ({ generateContent: mockGenerateContent }));
export const mockGenAI = { getGenerativeModel: mockGetGenerativeModel };
export const mockAgent = { getGenAI: vi.fn(() => mockGenAI) };
export const mockFetch = vi.fn();
export const mockSendText = vi.fn().mockResolvedValue(undefined);
export const mockWaService = {
  sendText: mockSendText,
  isConnected: vi.fn().mockReturnValue(true),
};

vi.doMock('../../whatsapp-service', () => ({
  WhatsAppService: vi.fn(),
}));

vi.doMock('../../whatsapp-agent', () => ({
  WhatsAppAgent: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);
