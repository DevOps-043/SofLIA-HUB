import { describe, expect, it } from 'vitest';
import {
  buildExtractionGenerationConfig,
  buildSummaryGenerationConfig,
  isUsableSummary,
} from '../memory/model-config';
import { factsScopeKey } from '../memory/scope';

const CARD = [
  '# Memory Card',
  '## Temas',
  '- El usuario pide presentaciones ejecutivas de 9 a 12 diapositivas con portada.',
  '- Corrige cuando la entrega llega en texto plano: exige HTML con marca.',
  '## Compromisos',
  '- Revisar el deck de Okra antes del viernes.',
].join('\n');

describe('Configuracion del modelo de memoria', () => {
  it('MM-001: el resumidor deja margen para pensamiento y baja el nivel de razonamiento', () => {
    const config = buildSummaryGenerationConfig();
    // El tope anterior (350) lo consumia entero el pensamiento y el resumen
    // llegaba truncado; el margen es la razon de ser de esta config.
    expect(config.maxOutputTokens).toBeGreaterThanOrEqual(2000);
    expect(config.thinkingConfig.thinkingLevel).toBe('low');
    expect(config.responseMimeType).toBeUndefined();
  });

  it('MM-002: los extractores piden JSON estricto con el mismo margen', () => {
    const config = buildExtractionGenerationConfig();
    expect(config.responseMimeType).toBe('application/json');
    expect(config.maxOutputTokens).toBeGreaterThanOrEqual(2000);
    expect(config.thinkingConfig.thinkingLevel).toBe('low');
  });
});

describe('isUsableSummary', () => {
  it('MM-010: acepta una Memory Card completa', () => {
    expect(isUsableSummary(CARD, 'STOP')).toBe(true);
    expect(isUsableSummary(CARD)).toBe(true);
  });

  it('MM-011: descarta una respuesta cortada por tope de tokens', () => {
    expect(isUsableSummary(CARD, 'MAX_TOKENS')).toBe(false);
  });

  it('MM-012: descarta fragmentos que no son una Memory Card', () => {
    expect(isUsableSummary('# Memory Card\n\n**Fecha:** 8 de', 'STOP')).toBe(false);
    expect(isUsableSummary('', 'STOP')).toBe(false);
    expect(isUsableSummary(null)).toBe(false);
  });
});

describe('factsScopeKey', () => {
  it('MM-020: WhatsApp conserva el telefono suelto (como lo lee assembleContext)', () => {
    expect(factsScopeKey('phone:5215531721680')).toBe('5215531721680');
  });

  it('MM-021: chat y escritorio guardan los hechos bajo el ownerKey completo', () => {
    // assembleContext lee los hechos con el ownerKey en estas superficies:
    // partir la sessionKey dejaba `user:` fuera y los hechos huerfanos.
    expect(factsScopeKey('user:abc-123')).toBe('user:abc-123');
    expect(factsScopeKey('local:owner')).toBe('local:owner');
  });
});
