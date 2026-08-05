import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveEmptyGeminiText } from '../../services/gemini-chat/empty-response';

describe('resolveEmptyGeminiText', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('devuelve el texto tal cual cuando hay contenido', () => {
    const response = { candidates: [{ finishReason: 'MAX_TOKENS' }] };
    expect(resolveEmptyGeminiText('respuesta real', response, [])).toBe('respuesta real');
  });

  it('explica el presupuesto agotado cuando el razonamiento consumio los tokens', () => {
    const response = { candidates: [{ finishReason: 'MAX_TOKENS' }] };
    expect(resolveEmptyGeminiText('', response, [])).toContain('presupuesto de tokens');
  });

  it('explica el bloqueo de seguridad por finishReason', () => {
    const response = { candidates: [{ finishReason: 'SAFETY' }] };
    expect(resolveEmptyGeminiText('', response, [])).toContain('politicas de seguridad');
  });

  it('explica el bloqueo de seguridad por promptFeedback', () => {
    const response = { promptFeedback: { blockReason: 'OTHER' }, candidates: [] };
    expect(resolveEmptyGeminiText('', response, [])).toContain('politicas de seguridad');
  });

  it('explica la recitacion', () => {
    const response = { candidates: [{ finishReason: 'RECITATION' }] };
    expect(resolveEmptyGeminiText('', response, [])).toContain('contenido protegido');
  });

  it('conserva el vacio cuando el motivo no es reconocible', () => {
    const response = { candidates: [{ finishReason: 'STOP' }] };
    expect(resolveEmptyGeminiText('', response, [])).toBe('');
  });

  it('no sustituye cuando el turno produjo imagenes', () => {
    // El texto vacio es legitimo: quien llama pone su propia leyenda.
    const response = { candidates: [{ finishReason: 'MAX_TOKENS' }] };
    expect(resolveEmptyGeminiText('', response, ['data:image/png;base64,AAA'])).toBe('');
  });

  it('tolera respuestas malformadas sin lanzar', () => {
    expect(resolveEmptyGeminiText('', null, [])).toBe('');
    expect(resolveEmptyGeminiText('', undefined, [])).toBe('');
    expect(resolveEmptyGeminiText('', {}, [])).toBe('');
  });

  it('deja el motivo en consola para diagnosticar', () => {
    resolveEmptyGeminiText('', { candidates: [{ finishReason: 'MAX_TOKENS' }] }, []);
    expect(console.warn).toHaveBeenCalledWith(
      '[GeminiChat] respuesta sin texto',
      expect.objectContaining({ finishReason: 'MAX_TOKENS' }),
    );
  });
});
