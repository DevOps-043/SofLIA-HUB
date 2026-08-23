import { describe, expect, it } from 'vitest';
import { classifyBrowserGroundingIntent, isActiveDocumentContentRequest } from '../../services/gemini-chat/browser-grounding-intent';

describe('clasificación contextual del navegador', () => {
  it('BGI-001: reconoce un recurso compartido por una persona sin verbo visual', () => {
    expect(classifyBrowserGroundingIntent('haz un resumen del repositorio que me mandó Ernesto'))
      .toBe('follow-resource');
  });

  it('BGI-002: distingue una pregunta sobre el chat que ya está visible', () => {
    expect(classifyBrowserGroundingIntent('pero el chat está abierto, ¿no puedes observar qué hay?'))
      .toBe('read-current');
  });

  it('BGI-003: conserva la referencia visual explícita existente', () => {
    expect(classifyBrowserGroundingIntent('¿puedes ver lo que estoy viendo?'))
      .toBe('read-current');
  });

  it('BGI-004: no ancla una consulta general a la pestaña por mencionar repositorio', () => {
    expect(classifyBrowserGroundingIntent('haz un resumen del repositorio de Electron'))
      .toBe('none');
  });

  it('BGI-005: reconoce contenido compartido en plural sin ampliar permisos', () => {
    expect(classifyBrowserGroundingIntent('¿qué dice lo que compartieron en el chat?'))
      .toBe('read-current');
  });

  it('BGI-006: una referencia visual a Codex se conserva como superficie desktop', () => {
    expect(classifyBrowserGroundingIntent('mira lo que hace Codex y prepara un resumen ejecutivo'))
      .toBe('none');
  });

  it('BGI-007: la frase exacta de la incidencia exige leer el documento activo', () => {
    expect(classifyBrowserGroundingIntent('Dame un resumen del Documento')).toBe('read-current');
    expect(isActiveDocumentContentRequest('Dame un resumen del Documento')).toBe(true);
  });
});
