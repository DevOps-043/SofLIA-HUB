import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabaseDb } from './sdo-store.fixture';

const fakeDb = new FakeSupabaseDb();

vi.mock('../sdo/sdo-hub-client', () => ({
  getSdoHubClient: () => fakeDb.client(),
}));

import { SdoStore } from '../sdo/sdo-store';
import { construirMensajeVigencia, SdoVigenciaService } from '../sdo/sdo-vigencia-service';
import { toEvidenceRef } from '../meetings/meeting-ai/legacy-mappers';

describe('SdoVigenciaService', () => {
  let store: SdoStore;
  let vigencia: SdoVigenciaService;

  beforeEach(() => {
    fakeDb.reset();
    store = new SdoStore();
    vigencia = new SdoVigenciaService();
  });

  it('VIG-001: marca como vencidos los registros vigentes con valid_until en el pasado', async () => {
    const vencida = await store.crearDecision({
      statement: 'Decision con vigencia vencida',
      owner_user_id: 'u1',
      authority_status: 'aprobado',
      temporal_status: 'vigente',
      valid_until: '2026-01-01T00:00:00Z',
    });
    await store.crearDecision({
      statement: 'Decision sin caducidad',
      owner_user_id: 'u1',
      authority_status: 'aprobado',
      temporal_status: 'vigente',
    });

    const resultado = await vigencia.revisar(new Date('2026-07-17T00:00:00Z'));

    expect(resultado.vencidos).toHaveLength(1);
    expect(resultado.vencidos[0].id).toBe(vencida.id);

    const fila = fakeDb.rows('sdo_decisions').find((r) => r.id === vencida.id);
    expect(fila?.temporal_status).toBe('vencido');
    const evento = fakeDb.rows('sdo_audit_events').find((e) => e.event_type === 'vencido');
    expect(evento?.object_id).toBe(vencida.id);
    expect(evento?.actor_type).toBe('sistema');
  });

  it('VIG-002: detecta review_due proximos y emite alerta con mensaje', async () => {
    await store.crearDecision({
      statement: 'Decision que requiere revision pronto',
      owner_user_id: 'u1',
      authority_status: 'aprobado',
      temporal_status: 'vigente',
      review_due: '2026-07-20T00:00:00Z',
    });

    const alertas: Array<{ mensaje: string }> = [];
    vigencia.on('alerta-vigencia', (payload) => alertas.push(payload));

    const resultado = await vigencia.revisar(new Date('2026-07-17T00:00:00Z'));

    expect(resultado.porRevisar).toHaveLength(1);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].mensaje).toContain('Por revisar');
    expect(alertas[0].mensaje).toContain('requiere revision');
  });

  it('VIG-003: sin vencidos ni revisiones no emite alerta', async () => {
    await store.crearDecision({
      statement: 'Decision sana',
      owner_user_id: 'u1',
      authority_status: 'aprobado',
      temporal_status: 'vigente',
      valid_until: '2030-01-01T00:00:00Z',
    });

    const alertas: unknown[] = [];
    vigencia.on('alerta-vigencia', (payload) => alertas.push(payload));
    const resultado = await vigencia.revisar(new Date('2026-07-17T00:00:00Z'));

    expect(resultado.vencidos).toHaveLength(0);
    expect(resultado.porRevisar).toHaveLength(0);
    expect(alertas).toHaveLength(0);
  });

  it('VIG-004: el mensaje de alerta lista vencidos y revisiones en espanol', () => {
    const mensaje = construirMensajeVigencia({
      vencidos: [{ objectType: 'decision', id: 'd1', label: 'Alcance del proyecto X' }],
      porRevisar: [{ objectType: 'claim', id: 'c1', label: 'Riesgo de dependencia', review_due: '2026-07-20T00:00:00Z' }],
    });

    expect(mensaje).toContain('Registros vencidos (1)');
    expect(mensaje).toContain('Alcance del proyecto X');
    expect(mensaje).toContain('Por revisar en 7 dias (1)');
    expect(mensaje).toContain('2026-07-20');
  });
});

describe('toEvidenceRef (locators)', () => {
  it('LOC-001: extrae localizador de linea y limpia la cita', () => {
    const ref = toEvidenceRef('[linea 42] acordamos iniciar en agosto');
    expect(ref.locator).toEqual({ tipo: 'linea', valor: '42' });
    expect(ref.excerpt).toBe('acordamos iniciar en agosto');
  });

  it('LOC-002: extrae localizador de minuto como timestamp', () => {
    const ref = toEvidenceRef('[minuto 03:15] Ernesto aprueba el presupuesto');
    expect(ref.locator).toEqual({ tipo: 'timestamp', valor: '03:15' });
    expect(ref.excerpt).toBe('Ernesto aprueba el presupuesto');
  });

  it('LOC-003: sin localizador la cita queda intacta (tolerancia)', () => {
    const ref = toEvidenceRef('cita normal sin localizador');
    expect(ref.locator).toBeUndefined();
    expect(ref.excerpt).toBe('cita normal sin localizador');
  });
});
