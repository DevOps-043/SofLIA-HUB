import { describe, expect, it } from 'vitest';
import { classifyBrowserGroundingIntent, isActiveDocumentContentRequest, isVisiblePageContentRequest } from '../../services/gemini-chat/browser-grounding-intent';

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

  it('BGI-008: "el siguiente chat" sin contenido pegado se refiere a la pestaña y exige leerla completa', () => {
    const reported = 'Realiza un resumen del siguiente Chat ya que mi jefe me pidio una opinion del mismo';
    expect(classifyBrowserGroundingIntent(reported)).toBe('read-current');
    expect(isVisiblePageContentRequest(reported)).toBe(true);
    expect(isVisiblePageContentRequest('analiza esta página y dame tu opinión')).toBe(true);
    expect(isVisiblePageContentRequest('resume el chat que tengo abierto')).toBe(true);
    // Preguntar por un dato puntual sigue usando la observación visible.
    expect(isVisiblePageContentRequest('¿qué dice el chat que tengo abierto?')).toBe(false);
    expect(isVisiblePageContentRequest('resume la conversación abierta')).toBe(true);
  });

  it('BGI-009: un texto pegado tras "el siguiente" no se confunde con la pestaña', () => {
    const pasted = `Resume el siguiente chat: ${'Ana: revisemos el presupuesto del trimestre. '.repeat(12)}`;
    expect(classifyBrowserGroundingIntent(pasted)).toBe('none');
    expect(isVisiblePageContentRequest(pasted)).toBe(false);
    expect(isVisiblePageContentRequest('Resume el siguiente texto en tres puntos')).toBe(false);
    expect(isVisiblePageContentRequest('dame un resumen de la historia de Roma')).toBe(false);
  });
});
