import { describe, expect, it } from 'vitest';
import { observeToolResult, observeToolSummary, observeToolNames, toolHistoryMetadata } from '../whatsapp/tool-observation';
import { toolFingerprint, responseFingerprint } from '../wa-agent/tool-fingerprint';

describe('Observación mínima de herramientas', () => {
  it('conserva progreso y flags sin textos, IDs ni estructuras arbitrarias', () => {
    const result = observeToolResult('gmail_modify_labels', { success: false, partial: true, uncertain: true, recoveryRequired: true,
      processed: 100, effectsConfirmed: 1, remaining: 3, status: 'running', error: 'token-ficticio', message: 'texto-privado', session_id: 'sesion-privada',
      pid: 1234, labelsCreated: [{ id: 'privado', name: 'Etiqueta privada' }], errors: ['error-privado'], payload: { valor: 'privado' } });
    expect(result).toEqual({ name: 'gmail_modify_labels', success: false, partial: true, uncertain: true, recoveryRequired: true,
      processed: 100, effectsConfirmed: 1, remaining: 3, status: 'running', hasError: true, labelsCreatedCount: 1, errorCount: 1 });
  });
  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '5'])('rechaza contadores no válidos: %s', value => {
    expect(observeToolResult('consulta', { count: value, processed: value })).toEqual({ name: 'consulta' });
  });
  it('omite estados libres y tipos que simulan booleanos', () => {
    expect(observeToolResult('consulta', { success: 'true', partial: 1, status: 'contenido privado', session_status: 'dato secreto' })).toEqual({ name: 'consulta' });
  });
  it('normalizar dos veces es idempotente y conserva error presente sin texto', () => {
    const first = observeToolResult('consulta', { success: false, error: 'ficticio', cancelled: true, count: 0 });
    expect(observeToolSummary([first])).toEqual([first]);
  });
  it('conserva códigos cerrados y referencias opacas para enlazar el fallo con logs', () => {
    const ref = '12345678-1234-4234-9234-123456789abc';
    expect(observeToolResult('consulta', { errorCode: 'TOOL_EXECUTION_FAILED', correlationId: ref, error: 'privado' }))
      .toEqual({ name: 'consulta', errorCode: 'TOOL_EXECUTION_FAILED', correlationId: ref, hasError: true });
    expect(observeToolResult('consulta', { errorCode: 'token-privado', correlationId: 'contenido-privado' })).toEqual({ name: 'consulta' });
  });
  it.each(['correo@example.test', 'tool\nprivado', '', 'x'.repeat(129), null, {}])('omite un nombre no identificador: %#', value => {
    expect(observeToolNames([value])).toEqual(['herramienta_desconocida']);
  });
  it('acota nombres/resúmenes y omite metadatos que no son UUID/duración', () => {
    expect(observeToolSummary(Array.from({ length: 40 }, () => ({ name: 'consulta', message: 'privado' })))).toHaveLength(30);
    expect(observeToolNames(Array(40).fill('consulta'))).toHaveLength(30);
    expect(toolHistoryMetadata({ correlationId: 'privado', durationMs: -1, toolSignature: 'argumentos' })).toEqual({});
  });
  it('huellas iguales sólo dentro del turno y sin representación de argumentos', () => {
    const turn = {}, input = { nombre: 'privado-ficticio', numero: 1 };
    const first = toolFingerprint(turn, input);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(toolFingerprint(turn, { numero: 1, nombre: 'privado-ficticio' })).toBe(first);
    expect(toolFingerprint({}, input)).not.toBe(first);
    expect(toolFingerprint(turn, { ...input, numero: 2 })).not.toBe(first);
  });
  it.each(['processed', 'effectsConfirmed', 'remaining', 'messagesLabeled'])('un avance %s modifica la firma de respuesta', key => {
    const turn = {}, response = (value: number) => [{ functionResponse: { name: 'consulta', response: { success: true, [key]: value } } }];
    expect(responseFingerprint(turn, response(1))).not.toBe(responseFingerprint(turn, response(2)));
  });
  it.each(['error', 'message', 'session_id', 'status'])('un dato relevante %s cambia la huella sin publicarse', key => {
    const turn = {}, response = (value: string) => [{ functionResponse: { name: 'consulta', response: { [key]: value } } }];
    expect(responseFingerprint(turn, response('uno'))).not.toBe(responseFingerprint(turn, response('dos')));
    expect(JSON.stringify(observeToolResult('consulta', { [key]: 'dato-privado' }))).not.toContain('dato-privado');
  });
  it('otra correlación del mismo fallo no simula progreso ni evita detectar repetición', () => {
    const turn = {};
    const responses = (correlationId: string) => [{ functionResponse: { name: 'consulta', response: {
      success: false, error: 'Error público fijo.', errorCode: 'TOOL_EXECUTION_FAILED', correlationId, uncertain: true,
    } } }];
    expect(responseFingerprint(turn, responses('12345678-1234-4234-9234-123456789abc')))
      .toBe(responseFingerprint(turn, responses('12345678-1234-4234-9234-123456789abd')));
  });
});
