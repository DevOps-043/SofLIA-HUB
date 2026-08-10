import { afterEach, describe, expect, it, vi } from 'vitest';
import { synthesizeElevenLabsSpeech } from '../../services/orb/elevenlabs-tts';

describe('wrapper ElevenLabs de la Orbe', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'orb');
  });

  it('ORB-VOICE-12: entrega sólo MP3 y metadatos no secretos', async () => {
    const synthesize = vi.fn(async () => ({
      success: true,
      audioBase64: 'AQIDBA==',
      mimeType: 'audio/mpeg' as const,
      voiceId: 'voice_test_123',
      modelId: 'eleven_turbo_v2_5',
    }));
    Object.defineProperty(window, 'orb', { configurable: true, value: { synthesize } });

    await expect(synthesizeElevenLabsSpeech('Hola')).resolves.toEqual({
      audioBase64: 'AQIDBA==',
      mimeType: 'audio/mpeg',
      voiceId: 'voice_test_123',
      modelId: 'eleven_turbo_v2_5',
    });
    expect(synthesize).toHaveBeenCalledWith('Hola');
  });

  it('ORB-VOICE-13: rechaza un formato inesperado del bridge', async () => {
    Object.defineProperty(window, 'orb', {
      configurable: true,
      value: { synthesize: vi.fn(async () => ({ success: true, audioBase64: 'AQIDBA==', mimeType: 'audio/wav' })) },
    });

    await expect(synthesizeElevenLabsSpeech('Hola')).rejects.toThrow(/No se pudo sintetizar/);
  });
});
