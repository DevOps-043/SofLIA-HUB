import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { synthesizeOrbSpeech } from '../orb-tts';

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  key: process.env.ELEVENLABS_API_KEY,
  voice: process.env.ELEVENLABS_VOICE_ID,
  model: process.env.ELEVENLABS_MODEL_ID,
  format: process.env.ELEVENLABS_OUTPUT_FORMAT,
};

describe('voz ElevenLabs de la Orbe', () => {
  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = 'elevenlabs-test-key';
    process.env.ELEVENLABS_VOICE_ID = 'voice_test_123';
    delete process.env.ELEVENLABS_MODEL_ID;
    delete process.env.ELEVENLABS_OUTPUT_FORMAT;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnvironment('ELEVENLABS_API_KEY', originalEnvironment.key);
    restoreEnvironment('ELEVENLABS_VOICE_ID', originalEnvironment.voice);
    restoreEnvironment('ELEVENLABS_MODEL_ID', originalEnvironment.model);
    restoreEnvironment('ELEVENLABS_OUTPUT_FORMAT', originalEnvironment.format);
  });

  it('ORB-VOICE-7: sintetiza MP3 con la voz configurada y Turbo v2.5 por defecto', async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      expect(args).toHaveLength(2);
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '4' },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await synthesizeOrbSpeech('Hola desde SofLIA');

    expect(result).toMatchObject({
      audioBase64: Buffer.from([1, 2, 3, 4]).toString('base64'),
      mimeType: 'audio/mpeg',
      voiceId: 'voice_test_123',
      modelId: 'eleven_turbo_v2_5',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/text-to-speech/voice_test_123?output_format=mp3_44100_128');
    expect((init?.headers as Record<string, string>)['xi-api-key']).toBe('elevenlabs-test-key');
    expect(JSON.parse(String(init?.body))).toEqual({
      text: 'Hola desde Soflía',
      model_id: 'eleven_turbo_v2_5',
      apply_text_normalization: 'auto',
      language_code: 'es',
    });
  });

  it('ORB-VOICE-8: explica el permiso faltante sin filtrar la respuesta del proveedor', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ detail: 'secret provider detail' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

    await expect(synthesizeOrbSpeech('Hola')).rejects.toThrow(/permiso de texto a voz/i);
    await expect(synthesizeOrbSpeech('Hola')).rejects.not.toThrow(/secret provider detail/i);
  });

  it('ORB-VOICE-9: falla cerrado sin credencial y no llama a la red', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    globalThis.fetch = vi.fn() as typeof fetch;

    await expect(synthesizeOrbSpeech('Hola')).rejects.toThrow(/ELEVENLABS_API_KEY/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('ORB-VOICE-16: diagnostica una voz compartida fuera del workspace sin filtrar detalle', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      detail: { type: 'not_found', code: 'voice_not_found', message: 'secret provider detail' },
    }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as typeof fetch;

    const failure = await synthesizeOrbSpeech('Hola').catch((error: unknown) => error as Error);

    expect((failure as Error).message).toMatch(/VOICE_ID.*mismo workspace.*API_KEY/i);
    expect((failure as Error).message).not.toContain('secret provider detail');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ORB-VOICE-14: rechaza texto sobredimensionado antes de consumir cuota', async () => {
    globalThis.fetch = vi.fn() as typeof fetch;

    await expect(synthesizeOrbSpeech('x'.repeat(5_001))).rejects.toThrow(/5[,.]?000 caracteres/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('ORB-VOICE-15: rechaza voz malformada y respuestas demasiado grandes', async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    process.env.ELEVENLABS_VOICE_ID = '../voz-no-permitida';
    await expect(synthesizeOrbSpeech('Hola')).rejects.toThrow(/VOICE_ID/);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    process.env.ELEVENLABS_VOICE_ID = 'voice_test_123';
    globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1]), {
      status: 200,
      headers: { 'Content-Length': String(16 * 1024 * 1024 + 1) },
    })) as typeof fetch;
    await expect(synthesizeOrbSpeech('Hola')).rejects.toThrow(/fuera de rango/i);
  });
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
