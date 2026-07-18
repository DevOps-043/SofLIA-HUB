import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabaseDb } from './sdo-store.fixture';

const fakeDb = new FakeSupabaseDb();

vi.mock('../sdo/sdo-hub-client', () => ({
  getSdoHubClient: () => fakeDb.client(),
}));

import { SdoStore } from '../sdo/sdo-store';

describe('SdoStore', () => {
  let store: SdoStore;

  beforeEach(() => {
    fakeDb.reset();
    store = new SdoStore();
  });

  it('SDO-001: crearDecision con idempotency_key no duplica al reintentar', async () => {
    const input = {
      statement: 'Adoptar el registro operativo gobernado',
      owner_user_id: 'user-1',
      idempotency_key: 'meeting:run1:decision:abc',
      extracted_by: 'ia' as const,
      authority_status: 'propuesto' as const,
    };

    const primera = await store.crearDecision(input);
    const segunda = await store.crearDecision(input);

    expect(fakeDb.rows('sdo_decisions')).toHaveLength(1);
    expect(segunda.id).toBe(primera.id);
    // Toda creacion deja bitacora (propuesto porque authority_status='propuesto').
    const eventos = fakeDb.rows('sdo_audit_events');
    expect(eventos.length).toBeGreaterThanOrEqual(1);
    expect(eventos[0].event_type).toBe('propuesto');
    expect(eventos[0].actor_type).toBe('ia');
  });

  it('SDO-002: aprobar exige usuario humano (la IA no puede aprobar)', async () => {
    const decision = await store.crearDecision({ statement: 'Decision X', owner_user_id: 'user-1' });

    await expect(
      store.aprobar({ objectType: 'decision', objectId: decision.id, decidedByUserId: '' }),
    ).rejects.toThrow(/usuario humano/i);

    await expect(
      store.aprobar({ objectType: 'decision', objectId: decision.id, decidedByUserId: '   ' }),
    ).rejects.toThrow(/usuario humano/i);

    expect(fakeDb.rows('sdo_approvals')).toHaveLength(0);
  });

  it('SDO-003: aprobar actualiza autoridad, vigencia y registra al aprobador', async () => {
    const decision = await store.crearDecision({ statement: 'Decision Y', owner_user_id: 'user-1' });

    const aprobacion = await store.aprobar({
      objectType: 'decision',
      objectId: decision.id,
      decidedByUserId: 'user-approver',
      comment: 'Revisado en comite',
    });

    expect(aprobacion.decision).toBe('aprobado');
    const fila = fakeDb.rows('sdo_decisions')[0];
    expect(fila.authority_status).toBe('aprobado');
    expect(fila.temporal_status).toBe('vigente');
    expect(fila.valid_from).toBeTruthy();
    expect(fila.approved_by_user_id).toBe('user-approver');

    // Idempotencia del acto: repetir la aprobacion no duplica registros.
    await store.aprobar({ objectType: 'decision', objectId: decision.id, decidedByUserId: 'user-approver' });
    expect(fakeDb.rows('sdo_approvals')).toHaveLength(1);

    const eventos = fakeDb.rows('sdo_audit_events').filter((e) => e.event_type === 'aprobado');
    expect(eventos.length).toBeGreaterThanOrEqual(1);
  });

  it('SDO-004: aprobar un sucesor marca al predecesor como reemplazado', async () => {
    const anterior = await store.crearDecision({ statement: 'Version 1', owner_user_id: 'user-1' });
    await store.aprobar({ objectType: 'decision', objectId: anterior.id, decidedByUserId: 'user-a' });

    const sucesora = await store.crearDecision({
      statement: 'Version 2',
      owner_user_id: 'user-1',
      supersedes_id: anterior.id,
    });
    await store.aprobar({ objectType: 'decision', objectId: sucesora.id, decidedByUserId: 'user-a' });

    const filaAnterior = fakeDb.rows('sdo_decisions').find((r) => r.id === anterior.id);
    expect(filaAnterior?.temporal_status).toBe('reemplazado');
    const eventoReemplazo = fakeDb.rows('sdo_audit_events').find((e) => e.event_type === 'reemplazado');
    expect(eventoReemplazo?.object_id).toBe(anterior.id);
    expect(eventoReemplazo?.actor_type).toBe('sistema');
  });

  it('SDO-005: rechazar deja authority_status rechazado sin tocar vigencia', async () => {
    const decision = await store.crearDecision({ statement: 'Decision Z', owner_user_id: 'user-1' });

    await store.rechazar({
      objectType: 'decision',
      objectId: decision.id,
      decidedByUserId: 'user-approver',
      comment: 'Falta evidencia',
    });

    const fila = fakeDb.rows('sdo_decisions')[0];
    expect(fila.authority_status).toBe('rechazado');
    expect(fila.temporal_status).toBe('futuro');
    expect(fakeDb.rows('sdo_approvals')[0].decision).toBe('rechazado');
  });

  it('SDO-006: listarDecisiones filtra por los tres ejes de estado', async () => {
    await store.crearDecision({ statement: 'A', owner_user_id: 'u1', authority_status: 'aprobado', temporal_status: 'vigente', epistemic_status: 'observado' });
    await store.crearDecision({ statement: 'B', owner_user_id: 'u1', authority_status: 'propuesto' });
    await store.crearDecision({ statement: 'C', owner_user_id: 'u2', authority_status: 'aprobado', temporal_status: 'vencido' });

    const vigentes = await store.listarDecisiones({ authorityStatus: 'aprobado', temporalStatus: 'vigente' });
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0].statement).toBe('A');

    const deU1 = await store.listarDecisiones({ ownerUserId: 'u1' });
    expect(deU1).toHaveLength(2);
  });

  it('SDO-007: crearFuente es idempotente por (system, external_ref) y la evidencia por (source_id, sha256)', async () => {
    const fuente1 = await store.crearFuente({
      system: 'meeting', source_type: 'transcripcion', uri: null, external_ref: 'art-1',
      custodian: null, confidentiality: 'P2', owner_user_id: 'u1', organization_id: null, trace_id: 't1',
    });
    const fuente2 = await store.crearFuente({
      system: 'meeting', source_type: 'transcripcion', uri: null, external_ref: 'art-1',
      custodian: null, confidentiality: 'P2', owner_user_id: 'u1', organization_id: null, trace_id: 't1',
    });
    expect(fuente2.id).toBe(fuente1.id);
    expect(fakeDb.rows('sdo_sources')).toHaveLength(1);

    await store.crearEvidencia({ source_id: fuente1.id, sha256: 'hash-x', storage_uri: null, mime_type: null, excerpt: null, confidentiality: 'P2', owner_user_id: 'u1' });
    await store.crearEvidencia({ source_id: fuente1.id, sha256: 'hash-x', storage_uri: null, mime_type: null, excerpt: null, confidentiality: 'P2', owner_user_id: 'u1' });
    expect(fakeDb.rows('sdo_evidence')).toHaveLength(1);
  });
});
