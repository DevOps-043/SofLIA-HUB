import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// WhatsApp Audio Processor Tests (WA-138 to WA-143)
// Tests for electron/whatsapp-audio-processor.ts
// ============================================================================

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    return {
      getGenerativeModel: mockGetGenerativeModel,
    };
  }),
}));

import { processAudioMessage } from '../whatsapp-audio-processor';

describe('WhatsApp Audio Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'Crea un evento para manana' },
    });
  });

  // WA-138: .ogg transcription
  it('WA-138: transcribes .ogg audio from WhatsApp', async () => {
    const buffer = Buffer.from('fake-ogg-audio-data');
    const result = await processAudioMessage(buffer, 'audio/ogg');

    expect(result).toBe('Crea un evento para manana');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-1.5-flash',
      })
    );
    expect(mockGenerateContent).toHaveBeenCalledWith([
      {
        inlineData: {
          mimeType: 'audio/ogg',
          data: buffer.toString('base64'),
        },
      },
    ]);
  });

  // WA-139: .mp3 transcription
  it('WA-139: transcribes .mp3 audio', async () => {
    const buffer = Buffer.from('fake-mp3-audio-data');
    const result = await processAudioMessage(buffer, 'audio/mp3');

    expect(result).toBe('Crea un evento para manana');
    expect(mockGenerateContent).toHaveBeenCalledWith([
      expect.objectContaining({
        inlineData: expect.objectContaining({ mimeType: 'audio/mp3' }),
      }),
    ]);
  });

  // WA-140: .wav transcription
  it('WA-140: transcribes .wav audio', async () => {
    const buffer = Buffer.from('fake-wav-audio-data');
    const result = await processAudioMessage(buffer, 'audio/wav');

    expect(result).toBe('Crea un evento para manana');
    expect(mockGenerateContent).toHaveBeenCalledWith([
      expect.objectContaining({
        inlineData: expect.objectContaining({ mimeType: 'audio/wav' }),
      }),
    ]);
  });

  // WA-141: silent audio returns empty string
  it('WA-141: returns empty string for silent/unintelligible audio', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '' },
    });

    const buffer = Buffer.from('silent-audio');
    const result = await processAudioMessage(buffer, 'audio/ogg');

    expect(result).toBe('');
  });

  // WA-142: corrupted audio graceful error
  it('WA-142: returns empty string for corrupted audio (API error)', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Invalid audio data'));

    const buffer = Buffer.from('corrupted-data');
    const result = await processAudioMessage(buffer, 'audio/ogg');

    expect(result).toBe('');
  });

  // WA-143: Gemini multimodal API is used with correct system instruction
  it('WA-143: uses Gemini multimodal API with system instruction for transcription', async () => {
    const buffer = Buffer.from('test-audio');
    await processAudioMessage(buffer, 'audio/ogg');

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-1.5-flash',
        systemInstruction: expect.stringContaining('Transcribe'),
      })
    );
  });
});

describe('WhatsApp Audio Processor — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty string when buffer is empty', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const result = await processAudioMessage(Buffer.alloc(0), 'audio/ogg');
    expect(result).toBe('');
  });

  it('returns empty string when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const buffer = Buffer.from('some-audio');
    const result = await processAudioMessage(buffer, 'audio/ogg');
    expect(result).toBe('');
  });
});
