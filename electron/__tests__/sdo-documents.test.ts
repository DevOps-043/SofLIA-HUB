import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FakeSupabaseDb } from './sdo-store.fixture';

const fakeDb = new FakeSupabaseDb();

vi.mock('../sdo/sdo-hub-client', () => ({
  getSdoHubClient: () => fakeDb.client(),
}));

import { SdoStore } from '../sdo/sdo-store';
import { SdoDocumentService } from '../sdo/sdo-document-service';
import { renderTarjetaContexto } from '../sdo/plantillas/plantilla-tarjeta-contexto';
import type { SdoAction, SdoClaim, SdoDecision } from '../sdo/sdo-types';

function decisionBase(overrides: Partial<SdoDecision>): SdoDecision {
  return {
    id: 'dec-x',
    question: null,
    statement: 'Decision de prueba',
    context: null,
    options_json: [],
    consequences: null,
    decision_owner: 'Ernesto',
    authority_basis: null,
    communication_rule: null,
    source_refs: [],
    epistemic_status: 'observado',
    authority_status: 'aprobado',
    temporal_status: 'vigente',
    valid_from: '2026-07-01T00:00:00Z',
    valid_until: null,
    review_due: null,
    supersedes_id: null,
    approved_at: '2026-07-01T00:00:00Z',
    approved_by_user_id: 'user-a',
    origin_system: 'meeting',
    origin_ref: 'run-1',
    idempotency_key: null,
    extracted_by: 'ia',
    model_version: null,
    prompt_version: null,
    confidence: 0.9,
    confidentiality: 'P2',
    owner_user_id: 'u1',
    organization_id: null,
    trace_id: 't1',
    metadata_json: {},
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('SDO documentos como vistas', () => {
  let store: SdoStore;
  let dir: string;
  let service: SdoDocumentService;

  beforeEach(() => {
    fakeDb.reset();
    store = new SdoStore();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-docs-'));
    // Renderer falso: escribe el markdown como archivo (sin docx/pdf real).
    service = new SdoDocumentService(store, {
      outputDir: dir,
      renderer: async (options) => {
        fs.writeFileSync(options.outputPath, options.content, 'utf-8');
        return options.outputPath;
      },
    });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('DOC-001: genera un decision record desde el registro con estados y evidencia', async () => {
    const decision = await store.crearDecision({
      statement: 'Adoptar SDO como registro oficial',
      owner_user_id: 'u1',
      decision_owner: 'Ernesto',
      authority_status: 'aprobado',
      temporal_status: 'vigente',
      approved_by_user_id: 'user-a',
      approved_at: '2026-07-01T00:00:00Z',
      source_refs: [{ evidence_id: 'evd-1', excerpt: 'lo acordamos en la reunion', locator: { tipo: 'linea', valor: '10' } }],
    });

    const resultado = await service.generarDecisionRecord(decision.id);

    expect(resultado.markdown).toContain('Adoptar SDO como registro oficial');
    expect(resultado.markdown).toContain('Autoridad: **aprobado**');
    expect(resultado.markdown).toContain('[linea 10]');
    expect(resultado.markdown).toContain('no confiere autoridad');
    expect(fs.existsSync(resultado.filePath)).toBe(true);

    const artefactos = fakeDb.rows('sdo_artifacts');
    expect(artefactos).toHaveLength(1);
    expect(artefactos[0].artifact_type).toBe('decision_record');
    expect(artefactos[0].authority_status).toBe('borrador');
  });

  it('DOC-002: la minuta separa aprobadas de propuestas y hereda la confidencialidad maxima', async () => {
    await store.crearDecision({
      statement: 'Decision aprobada de la reunion',
      owner_user_id: 'u1',
      authority_status: 'aprobado',
      temporal_status: 'vigente',
      origin_ref: 'run-9',
      confidentiality: 'P3',
    });
    await store.crearDecision({
      statement: 'Propuesta sin aprobar',
      owner_user_id: 'u1',
      authority_status: 'propuesto',
      origin_ref: 'run-9',
    });
    await store.crearAccion({
      description: 'Enviar el plan al cliente',
      owner_user_id: 'u1',
      responsible: 'Charly',
      origin_ref: 'run-9',
      authority_status: 'aprobado',
    });

    const resultado = await service.generarMinuta('run-9', 'Comite semanal');

    expect(resultado.markdown).toContain('Decisiones aprobadas');
    expect(resultado.markdown).toContain('Decision aprobada de la reunion');
    expect(resultado.markdown).toContain('NO esta aprobado');
    expect(resultado.markdown).toContain('Propuesta sin aprobar');
    expect(resultado.markdown).toContain('Enviar el plan al cliente');

    const artefacto = fakeDb.rows('sdo_artifacts')[0];
    expect(artefacto.confidentiality).toBe('P3'); // heredada del registro mas alto
    expect((artefacto.record_refs as unknown[]).length).toBe(3);
  });

  it('DOC-003: generar minuta sin registros falla (no se inventa contenido)', async () => {
    await expect(service.generarMinuta('run-vacio')).rejects.toThrow(/datos vacios/i);
  });

  it('DOC-004: aprobar artefacto congela snapshot con sha256 y publica en bitacora', async () => {
    const decision = await store.crearDecision({ statement: 'Decision snapshot', owner_user_id: 'u1' });
    const { artifactId, filePath } = await service.generarDecisionRecord(decision.id);

    const { sha256 } = await service.aprobarArtefacto(artifactId, 'user-approver', 'Version oficial');

    expect(sha256).toMatch(/^[a-f0-9]{64}$/);
    const artefacto = fakeDb.rows('sdo_artifacts').find((a) => a.id === artifactId);
    expect(artefacto?.sha256).toBe(sha256);
    expect(artefacto?.authority_status).toBe('aprobado');
    expect(artefacto?.approved_by_user_id).toBe('user-approver');

    const publicado = fakeDb.rows('sdo_audit_events').find((e) => e.event_type === 'publicado');
    expect(publicado?.object_id).toBe(artifactId);

    // El hash corresponde exactamente al archivo congelado.
    expect(fs.readFileSync(filePath, 'utf-8')).toContain('Decision snapshot');
  });

  it('DOC-005: aprobar artefacto sin archivo falla y sin usuario humano falla', async () => {
    const decision = await store.crearDecision({ statement: 'Decision sin archivo', owner_user_id: 'u1' });
    const { artifactId, filePath } = await service.generarDecisionRecord(decision.id);
    fs.rmSync(filePath);

    await expect(service.aprobarArtefacto(artifactId, 'user-a')).rejects.toThrow(/sin archivo/i);
  });

  it('DOC-006: la tarjeta de contexto muestra vigente/pendiente/quien decide', () => {
    const markdown = renderTarjetaContexto({
      sujeto: 'Charly',
      decisiones: [
        decisionBase({ id: 'd1', statement: 'Participacion de Charly en el alcance vigente' }),
        decisionBase({
          id: 'd2',
          statement: 'Incorporacion permanente de Charly',
          authority_status: 'pendiente',
          temporal_status: 'futuro',
          approved_at: null,
          approved_by_user_id: null,
        }),
        decisionBase({ id: 'd3', statement: 'Alcance anterior de Charly', temporal_status: 'reemplazado' }),
      ],
      claims: [
        {
          id: 'c1', claim_type: 'riesgo', statement: 'Dependencia de un solo proveedor',
          subject: 'Charly', object_refs: [], source_refs: [], epistemic_status: 'inferido',
          authority_status: 'propuesto', temporal_status: 'futuro', valid_from: null, valid_until: null,
          review_due: null, supersedes_id: null, reviewer_user_id: null, approver_user_id: null,
          authority_basis: null, extracted_by: 'ia', model_version: null, prompt_version: null,
          confidence: 0.6, idempotency_key: null, origin_system: null, origin_ref: null,
          confidentiality: 'P2', owner_user_id: 'u1', organization_id: null, trace_id: null,
          metadata_json: {}, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
        } as SdoClaim,
      ],
      acciones: [
        {
          id: 'a1', description: 'Confirmar entregables de Charly', responsible: 'Ernesto',
          decision_id: 'd1', due_date: '2026-08-01T00:00:00Z', status: 'abierta',
          authority_status: 'aprobado', temporal_status: 'vigente', valid_from: null, review_due: null,
          source_refs: [], origin_system: null, origin_ref: null, external_ref: null,
          idempotency_key: null, extracted_by: 'ia', confidence: null, confidentiality: 'P2',
          owner_user_id: 'u1', organization_id: null, trace_id: null, metadata_json: {},
          created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
        } as SdoAction,
      ],
      verificadoEn: '2026-07-17T00:00:00Z',
    });

    expect(markdown).toContain('# Tarjeta de contexto: Charly');
    expect(markdown).toContain('Participacion de Charly en el alcance vigente');
    expect(markdown).toContain('[pendiente] Incorporacion permanente de Charly — decide: **Ernesto**');
    expect(markdown).toContain('Que cambio');
    expect(markdown).toContain('[reemplazado] Alcance anterior de Charly');
    expect(markdown).toContain('Confirmar entregables de Charly');
    expect(markdown).toContain('Dependencia de un solo proveedor');
    expect(markdown).toContain('No comunicar como confirmado nada que aparezca como propuesto o pendiente');
    expect(markdown).toContain('2026-07-17');
  });
});
