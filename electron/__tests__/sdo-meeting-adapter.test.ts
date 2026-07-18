import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabaseDb } from './sdo-store.fixture';
import type { MeetingRunDetail } from '../meetings/meeting-types';

const fakeDb = new FakeSupabaseDb();

vi.mock('../sdo/sdo-hub-client', () => ({
  getSdoHubClient: () => fakeDb.client(),
}));

import { SdoService } from '../sdo/sdo-service';
import { registrarAprobacionAcciones, registrarAprobacionAsset } from '../sdo/adapters/meeting-adapter';

function buildDetail(): MeetingRunDetail {
  return {
    run: {
      id: 'run-1',
      organization_id: 'org-1',
      workspace_id: null,
      owner_user_id: 'user-1',
      origin_channel: 'app',
      origin_ref: null,
      meeting_title: 'Kickoff proyecto Andes',
      meeting_type: 'project',
      meeting_series_key: null,
      primary_source_uri: null,
      status: 'APPROVED',
      source_hash: 'srchash',
      source_version: 1,
      trace_id: 'trace-1',
      last_error: null,
      created_at: '2026-07-17T10:00:00Z',
      updated_at: '2026-07-17T10:00:00Z',
    },
    source_artifacts: [
      {
        id: 'art-1',
        meeting_run_id: 'run-1',
        source_system: 'drive',
        source_type: 'transcript',
        source_uri: 'drive://file-1',
        external_file_id: 'file-1',
        mime_type: 'text/plain',
        authority_level: 'google_workspace',
        sha256: 'sha-artifact-1',
        normalized_text: 'texto de la reunion',
        metadata: {},
        created_at: '2026-07-17T10:00:00Z',
      },
    ],
    latest_asset: {
      id: 'asset-1',
      meeting_run_id: 'run-1',
      schema_version: 'meeting_asset.v1',
      asset_version: 1,
      payload: {
        schema_version: 'meeting_asset.v1',
        trace_id: 'trace-1',
        meeting_title: 'Kickoff proyecto Andes',
        meeting_type: 'project',
        source_refs: [],
        participants: [],
        decisions: [
          {
            statement: 'Se aprueba iniciar el proyecto Andes en agosto',
            owner_candidate: 'Ernesto',
            approval_state: 'proposed',
            evidence_refs: [{ source_artifact_id: 'art-1', excerpt: 'iniciamos en agosto' }],
            confidence: 0.9,
          },
          {
            statement: 'Decision rechazada que no debe registrarse',
            approval_state: 'rejected',
            evidence_refs: [],
          },
        ],
        commitments: [],
        issues: [
          {
            statement: 'Riesgo de retraso por dependencia externa',
            severity: 'high',
            evidence_refs: [],
            confidence: 0.7,
          },
        ],
        open_questions: [],
        parking_lot: [],
        executive_summary: 'resumen',
        operational_summary: 'operativo',
        review_flags: [],
        proposed_actions: [],
        continuity_context: [],
      },
      executive_summary: 'resumen',
      operational_summary: 'operativo',
      review_flags: [],
      confidence: 0.9,
      created_at: '2026-07-17T10:05:00Z',
    },
    sync_actions: [
      {
        id: 'act-1',
        meeting_run_id: 'run-1',
        meeting_asset_id: 'asset-1',
        action_type: 'create_task',
        target_type: 'task_issue',
        payload: { title: 'Preparar plan', owner_candidate: 'Charly', due_date: '2026-08-01' },
        approval_state: 'approved',
        sync_state: 'approved',
        sync_target: 'iris_direct',
        idempotency_key: 'sync-act-1',
        external_ref: 'ISSUE-42',
        error_message: null,
        summary: 'Crear tarea: preparar plan del proyecto',
        blocking_flags: [],
        created_at: '2026-07-17T10:06:00Z',
        updated_at: '2026-07-17T10:06:00Z',
      },
      {
        id: 'act-2',
        meeting_run_id: 'run-1',
        meeting_asset_id: 'asset-1',
        action_type: 'create_task',
        target_type: 'task_issue',
        payload: {},
        approval_state: 'draft',
        sync_state: 'draft',
        sync_target: 'iris_direct',
        idempotency_key: 'sync-act-2',
        external_ref: null,
        error_message: null,
        summary: 'Borrador que no debe registrarse',
        blocking_flags: [],
        created_at: '2026-07-17T10:06:00Z',
        updated_at: '2026-07-17T10:06:00Z',
      },
    ],
    approvals: [],
  };
}

describe('meeting-adapter (meetings → SDO)', () => {
  let sdo: SdoService;

  beforeEach(() => {
    fakeDb.reset();
    sdo = new SdoService();
  });

  it('MAD-001: al aprobar la minuta registra fuentes, evidencia y decisiones aprobadas', async () => {
    await registrarAprobacionAsset(sdo, buildDetail(), 'user-approver');

    expect(fakeDb.rows('sdo_sources')).toHaveLength(1);
    expect(fakeDb.rows('sdo_evidence')).toHaveLength(1);
    expect(fakeDb.rows('sdo_evidence')[0].sha256).toBe('sha-artifact-1');

    const decisiones = fakeDb.rows('sdo_decisions');
    expect(decisiones).toHaveLength(1); // la rechazada no viaja
    expect(decisiones[0].statement).toContain('proyecto Andes');
    expect(decisiones[0].authority_status).toBe('aprobado');
    expect(decisiones[0].temporal_status).toBe('vigente');
    expect(decisiones[0].epistemic_status).toBe('observado'); // tiene evidencia
    expect(decisiones[0].approved_by_user_id).toBe('user-approver');
    expect(decisiones[0].extracted_by).toBe('ia');
    expect(decisiones[0].origin_ref).toBe('run-1');
    expect(decisiones[0].confidentiality).toBe('P2');

    // Los riesgos entran como claims PROPUESTOS (nadie los aprobo como hechos).
    const claims = fakeDb.rows('sdo_claims');
    expect(claims).toHaveLength(1);
    expect(claims[0].claim_type).toBe('riesgo');
    expect(claims[0].authority_status).toBe('propuesto');
    expect(claims[0].epistemic_status).toBe('inferido'); // sin evidencia

    expect(sdo.getStatus().lastAdapterError).toBeNull();
  });

  it('MAD-002: reejecutar el adaptador no duplica registros (idempotencia)', async () => {
    const detail = buildDetail();
    await registrarAprobacionAsset(sdo, detail, 'user-approver');
    await registrarAprobacionAsset(sdo, detail, 'user-approver');

    expect(fakeDb.rows('sdo_sources')).toHaveLength(1);
    expect(fakeDb.rows('sdo_evidence')).toHaveLength(1);
    expect(fakeDb.rows('sdo_decisions')).toHaveLength(1);
    expect(fakeDb.rows('sdo_claims')).toHaveLength(1);
  });

  it('MAD-003: al aprobar acciones registra solo las aprobadas/sincronizadas con external_ref', async () => {
    await registrarAprobacionAcciones(sdo, buildDetail(), 'user-approver');

    const acciones = fakeDb.rows('sdo_actions');
    expect(acciones).toHaveLength(1); // el borrador no viaja
    expect(acciones[0].description).toContain('preparar plan');
    expect(acciones[0].external_ref).toBe('ISSUE-42');
    expect(acciones[0].responsible).toBe('Charly');
    expect(acciones[0].authority_status).toBe('aprobado');

    // Idempotente por accion.
    await registrarAprobacionAcciones(sdo, buildDetail(), 'user-approver');
    expect(fakeDb.rows('sdo_actions')).toHaveLength(1);
  });

  it('MAD-004: un fallo del SDO no lanza (el flujo de meetings no se bloquea) y queda reportado', async () => {
    const detail = buildDetail();
    vi.spyOn(sdo.store, 'crearFuente').mockRejectedValueOnce(new Error('sin conexion al Hub'));

    await expect(registrarAprobacionAsset(sdo, detail, 'user-approver')).resolves.toBeUndefined();

    const status = sdo.getStatus();
    expect(status.lastAdapterError).toContain('sin conexion');
    expect(status.lastAdapterRunId).toBe('run-1');
  });
});
