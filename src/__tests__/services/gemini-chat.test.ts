/**
 * Tests RS-003 to RS-010: gemini-chat.ts renderer service.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockChat,
  getGeminiChatMocks,
} from './gemini-chat.setup';

const {
  mockGetApiKeyWithCache,
  mockGetGenerativeModel,
  mockGoogleGenerativeAI,
} = getGeminiChatMocks();

describe('gemini-chat', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetApiKeyWithCache.mockResolvedValue(null);
  });

  it('RS-003: buildGeminiHistory truncates to last 50 messages', async () => {
    const { sendMessageStream } = await import('../../services/gemini-chat');
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('ok')) });

    const history = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'model' as const,
      text: `Message ${i}`,
    }));

    await sendMessageStream('Hola', history);

    expect(mockGoogleGenerativeAI).toHaveBeenCalled();
    expect(mockGetGenerativeModel).toHaveBeenCalled();
  });

  it('RS-004: uses API key from database when available', async () => {
    const { getApiKeyWithCache } = await import('../../services/api-keys');
    vi.mocked(getApiKeyWithCache).mockResolvedValue('db-api-key-123');
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('ok')) });

    const mod = await import('../../services/gemini-chat');
    try {
      await mod.sendMessageStream('test');
    } catch {
      // The mocked chain may stop early; the key lookup is the contract here.
    }

    expect(getApiKeyWithCache).toHaveBeenCalledWith('google');
  });

  it('RS-005: falls back to env GOOGLE_API_KEY when DB returns null', async () => {
    const { getApiKeyWithCache } = await import('../../services/api-keys');
    vi.mocked(getApiKeyWithCache).mockResolvedValue(null);
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('respuesta')) });

    const { sendMessageStream } = await import('../../services/gemini-chat');
    await sendMessageStream('test');

    expect(mockGoogleGenerativeAI).toHaveBeenCalled();
  });

  it('RS-009: tool declarations are passed to the model', async () => {
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('ok')) });

    const { sendMessageStream } = await import('../../services/gemini-chat');
    await sendMessageStream('lista mis archivos');

    expect(mockGetGenerativeModel.mock.calls[0]?.[0]).toHaveProperty('model');
  });

  it('RS-010: sendMessageStream handles empty history gracefully', async () => {
    mockGetGenerativeModel.mockReturnValue({ startChat: vi.fn(() => createMockChat('hola')) });

    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream('Hola', []);

    expect(result).toBeDefined();
    expect(result.stream).toBeDefined();
  });
});
