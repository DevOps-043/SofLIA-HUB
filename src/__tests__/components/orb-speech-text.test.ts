import { describe, expect, it } from 'vitest';
import { buildSpeechText, splitIntoSpeechBlocks } from '../../components/orb/useOrbConversation';

// Texto real que se cortaba en "fresca y húmeda" y leía mal las unidades.
const WEATHER_RESPONSE = `Para hoy, **sábado 11 de julio de 2026**, en Ecatepec de Morelos, el pronóstico para las 8:00 de la noche es el siguiente:

**Temperatura:** Estaremos ante una temperatura fresca de entre 15 °C y 18 °C. La sensación térmica se sentirá fresca y húmeda.

**Probabilidad de lluvia:** Sí, hay una alta probabilidad de lluvia [1]. La probabilidad oscila entre el 57% y el 80%, con tormentas dispersas. Consulta https://ejemplo.com/clima para el detalle.

**Viento:** Vientos de 15 km/h del noreste.`;

describe('Orbe: texto para voz', () => {
  const speech = buildSpeechText(WEATHER_RESPONSE);

  it('lee la respuesta COMPLETA (antes se cortaba a los 300 caracteres)', () => {
    expect(speech).toMatch(/probabilidad de lluvia/i);
    expect(speech).toMatch(/viento/i);
  });

  it('normaliza unidades y símbolos para una dicción natural', () => {
    expect(speech).toContain('grados');
    expect(speech).not.toContain('°');
    expect(speech).toContain('por ciento');
    expect(speech).not.toContain('%');
    expect(speech).toMatch(/kilómetros por hora/);
  });

  it('elimina URLs, citas y markdown que el TTS lee mal', () => {
    expect(speech).not.toMatch(/https?:/i);
    expect(speech).not.toMatch(/\[\d+\]/);
    expect(speech).not.toContain('**');
  });

  it('trocea el habla en bloques que respetan el límite del TTS', () => {
    const longText = Array.from({ length: 40 }, (_, i) => `Esta es la frase número ${i + 1} del informe.`).join(' ');
    const blocks = splitIntoSpeechBlocks(longText, 200);
    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks) expect(block.length).toBeLessThanOrEqual(200);
    // Ningún fragmento de texto se pierde al trocear.
    expect(blocks.join(' ')).toBe(longText);
  });

  it('devuelve un solo bloque cuando el texto cabe en el límite', () => {
    expect(splitIntoSpeechBlocks('Hola, soy Pulse.', 1200)).toEqual(['Hola, soy Pulse.']);
    expect(splitIntoSpeechBlocks('   ', 1200)).toEqual([]);
  });
});
