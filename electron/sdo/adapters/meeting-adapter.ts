/**
 * Adaptador Meetings → SDO.
 *
 * Cuando un humano aprueba una minuta o acciones de reunion, el resultado
 * aprobado se registra en el Registro Operativo Gobernado (tablas sdo_*).
 * El flujo de meetings NUNCA depende del SDO: todo error aqui se reporta
 * al SdoService y se traga (la aprobacion de la reunion no falla).
 *
 * Traduccion de enums (meetings usa ingles, el SDO espanol):
 *   approval_state approved  → authority_status 'aprobado' + temporal 'vigente'
 *   evidencia presente       → epistemic_status 'observado'
 *   sin evidencia            → epistemic_status 'inferido'
 */
import type {
  MeetingDecision,
  MeetingEvidenceRef,
  MeetingRunDetail,
} from '../../meetings/meeting-types';
import { EXTRACTION_MODEL } from '../../meetings/meeting-ai/constants';
import { EXTRACTION_PROMPT_VERSION } from '../../meetings/meeting-ai/extraction-prompt';
import type { SdoService } from '../sdo-service';
import { sha256Hex } from '../sdo-shared';
import type { SdoSourceRef } from '../sdo-types';

/** Confidencialidad por defecto de material de reuniones (clientes/proyectos). */
const MEETING_CONFIDENTIALITY = 'P2' as const;

function mapEvidenceRefs(refs: MeetingEvidenceRef[] | undefined, artifactToEvidence: Map<string, string>): SdoSourceRef[] {
  return (refs || []).map((ref) => ({
    evidence_id: ref.source_artifact_id ? artifactToEvidence.get(ref.source_artifact_id) : undefined,
    excerpt: ref.excerpt,
    locator: ref.locator ?? null,
  }));
}

function epistemicDe(refs: MeetingEvidenceRef[] | undefined): 'observado' | 'inferido' {
  return refs && refs.length > 0 ? 'observado' : 'inferido';
}

function claveDecision(runId: string, decision: MeetingDecision): string {
  return `meeting:${runId}:decision:${sha256Hex(decision.statement)}`;
}

/**
 * Registra fuentes y evidencia del run. Devuelve el mapa
 * source_artifact_id → sdo_evidence_id para enlazar citas.
 */
async function registrarFuentes(sdo: SdoService, detail: MeetingRunDetail): Promise<Map<string, string>> {
  const { run, source_artifacts } = detail;
  const mapa = new Map<string, string>();

  for (const artifact of source_artifacts) {
    const fuente = await sdo.store.crearFuente({
      system: 'meeting',
      source_type: artifact.source_type,
      uri: artifact.source_uri,
      external_ref: artifact.id,
      custodian: run.owner_user_id,
      confidentiality: MEETING_CONFIDENTIALITY,
      owner_user_id: run.owner_user_id,
      organization_id: run.organization_id,
      trace_id: run.trace_id,
    });

    const evidencia = await sdo.store.crearEvidencia({
      source_id: fuente.id,
      sha256: artifact.sha256,
      storage_uri: artifact.source_uri,
      mime_type: artifact.mime_type,
      excerpt: null,
      confidentiality: MEETING_CONFIDENTIALITY,
      owner_user_id: run.owner_user_id,
      metadata_json: { authority_level: artifact.authority_level, meeting_run_id: run.id },
    });

    mapa.set(artifact.id, evidencia.id);
  }

  return mapa;
}

/**
 * Al aprobar la minuta (asset): registra fuentes, evidencia, decisiones
 * (aprobadas por quien aprobo la minuta) y riesgos (como claims propuestos).
 */
export async function registrarAprobacionAsset(sdo: SdoService, detail: MeetingRunDetail, decidedByUserId: string): Promise<void> {
  const { run, latest_asset } = detail;
  if (!latest_asset) return;

  try {
    const artifactToEvidence = await registrarFuentes(sdo, detail);
    const payload = latest_asset.payload;
    const ahora = new Date().toISOString();

    for (const decision of payload.decisions || []) {
      if (decision.approval_state === 'rejected') continue;

      await sdo.store.crearDecision({
        statement: decision.statement,
        decision_owner: decision.owner_candidate ?? null,
        source_refs: mapEvidenceRefs(decision.evidence_refs, artifactToEvidence),
        epistemic_status: epistemicDe(decision.evidence_refs),
        authority_status: 'aprobado',
        temporal_status: 'vigente',
        valid_from: ahora,
        approved_at: ahora,
        approved_by_user_id: decidedByUserId,
        origin_system: 'meeting',
        origin_ref: run.id,
        idempotency_key: claveDecision(run.id, decision),
        extracted_by: 'ia',
        model_version: EXTRACTION_MODEL,
        prompt_version: EXTRACTION_PROMPT_VERSION,
        confidence: decision.confidence ?? null,
        confidentiality: MEETING_CONFIDENTIALITY,
        owner_user_id: run.owner_user_id,
        organization_id: run.organization_id,
        trace_id: run.trace_id,
        metadata_json: { meeting_title: run.meeting_title },
      });
    }

    for (const issue of payload.issues || []) {
      await sdo.store.crearClaim({
        claim_type: 'riesgo',
        statement: issue.statement,
        subject: run.meeting_title,
        source_refs: mapEvidenceRefs(issue.evidence_refs, artifactToEvidence),
        epistemic_status: epistemicDe(issue.evidence_refs),
        authority_status: 'propuesto',
        temporal_status: 'futuro',
        origin_system: 'meeting',
        origin_ref: run.id,
        idempotency_key: `meeting:${run.id}:riesgo:${sha256Hex(issue.statement)}`,
        extracted_by: 'ia',
        model_version: EXTRACTION_MODEL,
        prompt_version: EXTRACTION_PROMPT_VERSION,
        confidence: issue.confidence ?? null,
        confidentiality: MEETING_CONFIDENTIALITY,
        owner_user_id: run.owner_user_id,
        organization_id: run.organization_id,
        trace_id: run.trace_id,
        metadata_json: { severity: issue.severity },
      });
    }

    sdo.reportarResultadoAdapter(run.id, null);
  } catch (error) {
    sdo.reportarResultadoAdapter(run.id, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Al aprobar acciones de sync: registra cada accion aprobada como
 * sdo_action (con external_ref al issue de IRIS si ya se sincronizo).
 */
export async function registrarAprobacionAcciones(sdo: SdoService, detail: MeetingRunDetail, decidedByUserId: string): Promise<void> {
  const { run, sync_actions } = detail;

  try {
    for (const action of sync_actions) {
      if (action.approval_state !== 'approved' && action.approval_state !== 'synced') continue;

      await sdo.store.crearAccion({
        description: action.summary,
        responsible: action.payload.owner_candidate ?? null,
        due_date: action.payload.due_date ?? null,
        status: 'abierta',
        authority_status: 'aprobado',
        temporal_status: 'vigente',
        valid_from: new Date().toISOString(),
        origin_system: 'meeting',
        origin_ref: run.id,
        external_ref: action.external_ref,
        idempotency_key: `meeting:action:${action.id}`,
        extracted_by: 'ia',
        confidentiality: MEETING_CONFIDENTIALITY,
        owner_user_id: run.owner_user_id,
        organization_id: run.organization_id,
        trace_id: run.trace_id,
        metadata_json: { action_type: action.action_type, approved_by: decidedByUserId },
      });
    }

    sdo.reportarResultadoAdapter(run.id, null);
  } catch (error) {
    sdo.reportarResultadoAdapter(run.id, error instanceof Error ? error.message : String(error));
  }
}
