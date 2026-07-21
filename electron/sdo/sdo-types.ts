/**
 * SDO-AN — Tipos del Registro Operativo Gobernado.
 * Espejo de database/lia/migrations/sdo-tables.sql. Columnas en ingles, valores de estado en
 * espanol (regla del proyecto: los enums del SDO son en espanol).
 */

export type SdoEpistemicStatus = 'observado' | 'corroborado' | 'inferido' | 'disputado' | 'desconocido';
export type SdoAuthorityStatus = 'borrador' | 'propuesto' | 'pendiente' | 'aprobado' | 'rechazado';
export type SdoTemporalStatus = 'futuro' | 'vigente' | 'reemplazado' | 'vencido' | 'archivado';
export type SdoConfidentiality = 'P0' | 'P1' | 'P2' | 'P3';
export type SdoExtractedBy = 'humano' | 'ia';
export type SdoClaimType = 'hecho' | 'decision' | 'compromiso' | 'requisito' | 'riesgo' | 'propuesta';
export type SdoActionStatus = 'abierta' | 'en_curso' | 'bloqueada' | 'completada' | 'cancelada';
export type SdoApprovalObjectType = 'claim' | 'decision' | 'action' | 'artifact';
export type SdoApprovalDecision = 'aprobado' | 'rechazado';
export type SdoActorType = 'humano' | 'ia' | 'sistema';
export type SdoAuditEventType =
  | 'creado'
  | 'propuesto'
  | 'editado'
  | 'aprobado'
  | 'rechazado'
  | 'reemplazado'
  | 'vencido'
  | 'archivado'
  | 'publicado'
  | 'eliminacion_autorizada';

/** Localizador estructurado dentro de una evidencia (pagina, linea, minuto...). */
export interface SdoLocator {
  tipo: 'offset' | 'linea' | 'timestamp' | 'pagina';
  valor: string;
}

/** Referencia de un registro a su evidencia, con cita y localizador opcionales. */
export interface SdoSourceRef {
  evidence_id?: string;
  locator?: SdoLocator | null;
  excerpt?: string;
}

export interface SdoSource {
  id: string;
  system: string;
  source_type: string;
  uri: string | null;
  external_ref: string | null;
  custodian: string | null;
  captured_at: string;
  confidentiality: SdoConfidentiality;
  owner_user_id: string;
  organization_id: string | null;
  trace_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SdoEvidence {
  id: string;
  source_id: string;
  sha256: string;
  storage_uri: string | null;
  mime_type: string | null;
  excerpt: string | null;
  captured_at: string;
  confidentiality: SdoConfidentiality;
  owner_user_id: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

interface SdoGovernedBase {
  id: string;
  epistemic_status: SdoEpistemicStatus;
  authority_status: SdoAuthorityStatus;
  temporal_status: SdoTemporalStatus;
  valid_from: string | null;
  valid_until: string | null;
  review_due: string | null;
  supersedes_id: string | null;
  source_refs: SdoSourceRef[];
  origin_system: string | null;
  origin_ref: string | null;
  idempotency_key: string | null;
  extracted_by: SdoExtractedBy;
  model_version: string | null;
  prompt_version: string | null;
  confidence: number | null;
  confidentiality: SdoConfidentiality;
  owner_user_id: string;
  organization_id: string | null;
  trace_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SdoClaim extends SdoGovernedBase {
  claim_type: SdoClaimType;
  statement: string;
  subject: string | null;
  object_refs: string[];
  reviewer_user_id: string | null;
  approver_user_id: string | null;
  authority_basis: string | null;
}

export interface SdoDecision extends SdoGovernedBase {
  question: string | null;
  statement: string;
  context: string | null;
  options_json: unknown[];
  consequences: string | null;
  decision_owner: string | null;
  authority_basis: string | null;
  communication_rule: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
}

export interface SdoAction {
  id: string;
  description: string;
  responsible: string | null;
  decision_id: string | null;
  due_date: string | null;
  status: SdoActionStatus;
  authority_status: SdoAuthorityStatus;
  temporal_status: SdoTemporalStatus;
  valid_from: string | null;
  review_due: string | null;
  source_refs: SdoSourceRef[];
  origin_system: string | null;
  origin_ref: string | null;
  external_ref: string | null;
  idempotency_key: string | null;
  extracted_by: SdoExtractedBy;
  confidence: number | null;
  confidentiality: SdoConfidentiality;
  owner_user_id: string;
  organization_id: string | null;
  trace_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SdoApproval {
  id: string;
  object_type: SdoApprovalObjectType;
  object_id: string;
  requested_by_user_id: string;
  decided_by_user_id: string;
  role_at_time: string | null;
  decision: SdoApprovalDecision;
  comment: string | null;
  evidence_links: string[];
  object_version_before: number | null;
  object_version_after: number | null;
  idempotency_key: string;
  decided_at: string;
  organization_id: string | null;
  trace_id: string | null;
  created_at: string;
}

export interface SdoAuditEvent {
  id: string;
  actor_type: SdoActorType;
  actor_id: string | null;
  event_type: SdoAuditEventType;
  object_type: string;
  object_id: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  reason: string | null;
  trace_id: string | null;
  created_at: string;
}

/** Entradas de creacion (el store completa id/timestamps/defaults). */
export type SdoCreateSourceInput = Omit<SdoSource, 'id' | 'created_at' | 'updated_at' | 'captured_at' | 'metadata_json'> &
  Partial<Pick<SdoSource, 'id' | 'captured_at' | 'metadata_json'>>;

export type SdoCreateEvidenceInput = Omit<SdoEvidence, 'id' | 'created_at' | 'captured_at' | 'metadata_json'> &
  Partial<Pick<SdoEvidence, 'id' | 'captured_at' | 'metadata_json'>>;

export type SdoCreateClaimInput = Partial<Omit<SdoClaim, 'statement' | 'claim_type' | 'owner_user_id'>> &
  Pick<SdoClaim, 'statement' | 'claim_type' | 'owner_user_id'>;

export type SdoCreateDecisionInput = Partial<Omit<SdoDecision, 'statement' | 'owner_user_id'>> &
  Pick<SdoDecision, 'statement' | 'owner_user_id'>;

export type SdoCreateActionInput = Partial<Omit<SdoAction, 'description' | 'owner_user_id'>> &
  Pick<SdoAction, 'description' | 'owner_user_id'>;

export interface SdoListFilters {
  ownerUserId?: string;
  authorityStatus?: SdoAuthorityStatus;
  temporalStatus?: SdoTemporalStatus;
  epistemicStatus?: SdoEpistemicStatus;
  subject?: string;
  originRef?: string;
  limit?: number;
}

export interface SdoApproveInput {
  objectType: SdoApprovalObjectType;
  objectId: string;
  decidedByUserId: string;
  comment?: string;
  roleAtTime?: string;
  evidenceLinks?: string[];
}

export interface SdoServiceStatus {
  initialized: boolean;
  lastAdapterError: string | null;
  lastAdapterRunId: string | null;
  lastAdapterAt: string | null;
}
