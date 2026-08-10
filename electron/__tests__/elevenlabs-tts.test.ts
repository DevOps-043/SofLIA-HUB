import { describe, expect, it } from 'vitest';
import { elevenLabsProviderError } from '../elevenlabs-tts';

describe('errores saneados de ElevenLabs', () => {
  it.each([
    { detail: { status: 'voice_not_found', message: 'secreto legado' } },
    { detail: { type: 'not_found', code: 'voice_not_found', message: 'secreto moderno' } },
    { detail: { detail: { code: 'voice_access_denied' } } },
  ])('explica que la voz debe estar disponible para el workspace', ({ detail }) => {
    const message = elevenLabsProviderError(404, detail);
    expect(message).toMatch(/VOICE_ID.*mismo workspace.*API_KEY/i);
    expect(message).not.toMatch(/secreto/i);
  });

  it('distingue modelo, formato y créditos', () => {
    expect(elevenLabsProviderError(400, { code: 'model_not_found' })).toMatch(/MODEL_ID/);
    expect(elevenLabsProviderError(400, { code: 'invalid_output_format' })).toMatch(/OUTPUT_FORMAT/);
    expect(elevenLabsProviderError(402, { code: 'insufficient_credits' })).toMatch(/créditos/i);
  });

  it('no refleja mensajes desconocidos del proveedor', () => {
    expect(elevenLabsProviderError(400, { message: 'api-key-secreta' })).toBe('ElevenLabs rechazó la solicitud (400).');
  });
});
