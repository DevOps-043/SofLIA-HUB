import { describe, expect, it } from 'vitest';
import { mapPreparedSpeechRange, prepareSpeechText } from '../speech-text-normalizer';

describe('preparación de texto para voz', () => {
  it('expande marca, versión y decimal en español', () => {
    expect(prepareSpeechText('SofLIA 5.12 y v2.05', 'es-MX').text)
      .toBe('Soflía cinco punto doce y versión dos punto cero cinco');
  });

  it('conserva un mapa monótono a los offsets originales', () => {
    const source = 'SofLIA 5.12';
    const prepared = prepareSpeechText(source, 'es');
    expect(prepared.sourceOffsets).toHaveLength(prepared.text.length + 1);
    expect(prepared.sourceOffsets[0]).toBe(0);
    expect(prepared.sourceOffsets[prepared.sourceOffsets.length - 1]).toBe(source.length);
    expect(prepared.sourceOffsets.every((offset, index) => index === 0 || offset >= prepared.sourceOffsets[index - 1])).toBe(true);
    expect(mapPreparedSpeechRange(prepared, 0, 'Soflía'.length)).toEqual({ start: 0, end: 6 });
    const decimalStart = prepared.text.indexOf('cinco');
    expect(mapPreparedSpeechRange(prepared, decimalStart, decimalStart + 'cinco'.length))
      .toEqual({ start: source.indexOf('5.12'), end: source.length });
  });

  it('no reescribe contenido declarado en otro idioma', () => {
    const source = 'SofLIA 5.12';
    expect(prepareSpeechText(source, 'en').text).toBe(source);
  });

  it('no interpreta direcciones IP ni versiones de tres partes como decimales', () => {
    const source = 'Servidor 192.168.1.1 con versión 1.2.3.';
    expect(prepareSpeechText(source, 'es').text).toBe(source);
  });
});
