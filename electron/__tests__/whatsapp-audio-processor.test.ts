import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAudioProcessorMocks,
  mockTranscription,
} from './whatsapp-audio-processor.setup';
import { processAudioMessage } from '../whatsapp-audio-processor';

const { mockGenerateContent, mockGetGenerativeModel } = getAudioProcessorMocks();

describe('WhatsApp Audio Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
    mockTranscription();
  });

  it('WA-138: transcribes .ogg audio from WhatsApp', async () => {
    const buffer = Buffer.from('fake-ogg-audio-data');
    const result = await processAudioMessage(buffer, 'audio/ogg');

    expect(result).toBe('Crea un evento para manana');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-1.5-flash' }));
    expect(mockGenerateContent).toHaveBeenCalledWith([
      { inlineData: { mimeType: 'audio/ogg', data: buffer.toString('base64') } },
    ]);
  });

  it('WA-139: transcribes .mp3 audio', async () => {
    const result = await processAudioMessage(Buffer.from('fake-mp3-audio-data'), 'audio/mp3');
    expect(result).toBe('Crea un evento para manana');
    expect(mockGenerateContent).toHaveBeenCalledWith([
      expect.objectContaining({ inlineData: expect.objectContaining({ mimeType: 'audio/mp3' }) }),
    ]);
  });

  it('WA-140: transcribes .wav audio', async () => {
    const result = await processAudioMessage(Buffer.from('fake-wav-audio-data'), 'audio/wav');
    expect(result).toBe('Crea un evento para manana');
    expect(mockGenerateContent).toHaveBeenCalledWith([
      expect.objectContaining({ inlineData: expect.objectContaining({ mimeType: 'audio/wav' }) }),
    ]);
  });

  it('WA-141: returns empty string for silent/unintelligible audio', async () => {
    mockTranscription('');
    expect(await processAudioMessage(Buffer.from('silent-audio'), 'audio/ogg')).toBe('');
  });

  it('WA-142: returns empty string for corrupted audio', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Invalid audio data'));
    expect(await processAudioMessage(Buffer.from('corrupted-data'), 'audio/ogg')).toBe('');
  });

  it('WA-143: uses Gemini multimodal API with system instruction', async () => {
    await processAudioMessage(Buffer.from('test-audio'), 'audio/ogg');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-1.5-flash',
        systemInstruction: expect.stringContaining('Transcribe'),
      })
    );
  });
});
