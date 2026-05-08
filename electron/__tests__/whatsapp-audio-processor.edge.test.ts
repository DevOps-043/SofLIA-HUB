import { beforeEach, describe, expect, it, vi } from 'vitest';
import './whatsapp-audio-processor.setup';
import { processAudioMessage } from '../whatsapp-audio-processor';

describe('WhatsApp Audio Processor edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty string when buffer is empty', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    expect(await processAudioMessage(Buffer.alloc(0), 'audio/ogg')).toBe('');
  });

  it('returns empty string when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await processAudioMessage(Buffer.from('some-audio'), 'audio/ogg')).toBe('');
  });
});
