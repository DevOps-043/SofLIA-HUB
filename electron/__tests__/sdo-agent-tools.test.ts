import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabaseDb } from './sdo-store.fixture';

const fakeDb = new FakeSupabaseDb();

vi.mock('../sdo/sdo-hub-client', () => ({
  getSdoHubClient: () => fakeDb.client(),
}));

import { SdoStore } from '../sdo/sdo-store';
import { construirRespuestaProtocolo } from '../sdo/sdo-context-protocol';
import { executeSdoTool, isSdoTool, setSdoStoreForTests } from '../whatsapp-executors/sdo-executors';
import { SDO_TOOLS } from '../wa-tools/sdo';
import { WA_TOOL_DECLARATIONS } from '../wa-tools';

describe('SDO herramientas de agente', () => {
  let store: SdoStore;

  beforeEach(() => {
    fakeDb.reset();
    store = new SdoStore();
    setSdoStoreForTests(store);
  });

  it('AGT-001: la IA no tiene ruta de aprobacion (no existe sdo_approve)', () => {
    expect(isSdoTool('sdo_query')).toBe(true);
    expect(isSdoTool('sdo_propose')).toBe(true);
    expect(isSdoTool('sdo_approve')).toBe(false);

    const nombres = SDO_TOOLS.map((tool) => tool.name);
    expect(nombres).toEqual(['sdo_query', 'sdo_propose']);
    const declaradas = WA_TOOL_DECLARATIONS.functionDeclarations.map((tool) => tool.name);
    expect(declaradas).toContain('sdo_query');
    expect(declaradas).toContain('sdo_propose');
    expect(declaradas.some((nombre) => /sdo.*(approve|aprobar)/i.test(nombre))).toBe(false);
  });

  it('AGT-002: sdo_query responde en 5 bloques y separa confirmado de propuesto', async () => {
    await store.crearDecision({
      statement: 'Alcance de Charly aprobado hasta septiembre',
      owner_user_id: 'u1',
      authority_status: 'aprobado',
      temporal_status: 'vigente',
      epistemic_status: 'observado',
      approved_by_user_id: 'ernesto',
      metadata_json: {},
    });
    await store.crearDecision({
      statement: 'Incorporacion permanente de Charly',
      owner_user_id: 'u1',
      authority_status: 'pendiente',
      decision_owner: 'Ernesto',
      epistemic_status: 'desconocido',
    });

    const result = await executeSdoTool('sdo_query', { tema: 'Charly' }, '5215550000000', false);
    const response = result?.functionResponse.response as { success: boolean; respuesta_estructurada: string };

    expect(response.success).toBe(true);
    const texto = response.respuesta_estructurada;
    expect(texto).toContain('*1. Confirmado*');
    expect(texto).toContain('Alcance de Charly aprobado hasta septiembre');
    expect(texto).toContain('*4. Pendiente*');
    expect(texto).toContain('Incorporacion permanente de Charly — decide: *Ernesto*');
    expect(texto).toContain('*5. Restriccion:*');
    expect(texto).toContain('No presentar lo propuesto/pendiente como confirmado');
  });

  it('AGT-003: confidencialidad — P3 nunca sale y P2 no sale en grupos', async () => {
    await store.crearDecision({
      statement: 'Decision confidencial P3 sobre Andes',
      owner_user_id: 'u1',
      authority_status: 'aprobado',
      temporal_status: 'vigente',
      confidentiality: 'P3',
    });
    await store.crearDecision({
      statement: 'Decision P2 sobre Andes',
      owner_user_id: 'u1',
      authority_status: 'aprobado',
      temporal_status: 'vigente',
      epistemic_status: 'observado',
      confidentiality: 'P2',
    });

    const individual = await executeSdoTool('sdo_query', { tema: 'Andes' }, '5215550000000', false);
    const textoIndividual = (individual?.functionResponse.response as { respuesta_estructurada: string }).respuesta_estructurada;
    expect(textoIndividual).not.toContain('P3 sobre Andes');
    expect(textoIndividual).toContain('Decision P2 sobre Andes');

    const grupo = await executeSdoTool('sdo_query', { tema: 'Andes' }, '5215550000000', true);
    const responseGrupo = grupo?.functionResponse.response as { respuesta_estructurada: string; registros_ocultos_por_confidencialidad?: number };
    expect(responseGrupo.respuesta_estructurada).not.toContain('P2 sobre Andes');
    expect(responseGrupo.respuesta_estructurada).not.toContain('P3 sobre Andes');
    expect(responseGrupo.registros_ocultos_por_confidencialidad).toBe(2);
  });

  it('AGT-004: sdo_propose crea registros como propuestos por IA, nunca aprobados', async () => {
    const result = await executeSdoTool(
      'sdo_propose',
      { tipo: 'decision', statement: 'Contratar a Charly de planta', decision_owner: 'Ernesto' },
      '5215550000000',
      false,
    );

    const response = result?.functionResponse.response as { success: boolean; estado: string; mensaje: string };
    expect(response.success).toBe(true);
    expect(response.estado).toBe('propuesto');
    expect(response.mensaje).toContain('aprobacion humana');

    const fila = fakeDb.rows('sdo_decisions')[0];
    expect(fila.authority_status).toBe('propuesto');
    expect(fila.extracted_by).toBe('ia');
    expect(fila.owner_user_id).toBe('phone:5215550000000');
    expect(fila.approved_by_user_id ?? null).toBeNull();

    const riesgo = await executeSdoTool('sdo_propose', { tipo: 'riesgo', statement: 'Riesgo de rotacion', subject: 'Equipo' }, '5215550000000', false);
    expect((riesgo?.functionResponse.response as { success: boolean }).success).toBe(true);
    expect(fakeDb.rows('sdo_claims')[0].authority_status).toBe('propuesto');
  });

  it('AGT-005: el protocolo marca contradicciones y registros vencidos', () => {
    const texto = construirRespuestaProtocolo({
      tema: 'Presupuesto',
      decisiones: [],
      claims: [
        {
          id: 'c1', claim_type: 'hecho', statement: 'El presupuesto es de 100k', subject: 'Presupuesto',
          object_refs: [], source_refs: [], epistemic_status: 'disputado', authority_status: 'aprobado',
          temporal_status: 'vigente', valid_from: null, valid_until: null, review_due: null,
          supersedes_id: null, reviewer_user_id: null, approver_user_id: null, authority_basis: null,
          extracted_by: 'ia', model_version: null, prompt_version: null, confidence: null,
          idempotency_key: null, origin_system: null, origin_ref: null, confidentiality: 'P1',
          owner_user_id: 'u1', organization_id: null, trace_id: null, metadata_json: {},
          created_at: '2026-01-01', updated_at: '2026-01-01',
        },
      ],
      acciones: [],
    });

    expect(texto).toContain('*3. Contradicciones:*');
    expect(texto).toContain('[disputado] El presupuesto es de 100k');
  });
});
