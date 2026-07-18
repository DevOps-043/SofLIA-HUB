/**
 * Wrapper del renderer para el Registro Operativo Gobernado (SDO-AN).
 * Habla con el proceso main via window.sdo (preload allowlist sdo:*).
 */

export type SdoEpistemicStatus = 'observado' | 'corroborado' | 'inferido' | 'disputado' | 'desconocido';
export type SdoAuthorityStatus = 'borrador' | 'propuesto' | 'pendiente' | 'aprobado' | 'rechazado';
export type SdoTemporalStatus = 'futuro' | 'vigente' | 'reemplazado' | 'vencido' | 'archivado';
export type SdoConfidentiality = 'P0' | 'P1' | 'P2' | 'P3';
export type SdoActionStatus = 'abierta' | 'en_curso' | 'bloqueada' | 'completada' | 'cancelada';
export type SdoApprovalObjectType = 'claim' | 'decision' | 'action' | 'artifact';

export interface SdoSourceRef {
  evidence_id?: string;
  locator?: { tipo: 'offset' | 'linea' | 'timestamp' | 'pagina'; valor: string } | null;
  excerpt?: string;
}

export interface SdoDecision {
  id: string;
  question: string | null;
  statement: string;
  context: string | null;
  consequences: string | null;
  decision_owner: string | null;
  authority_basis: string | null;
  communication_rule: string | null;
  source_refs: SdoSourceRef[];
  epistemic_status: SdoEpistemicStatus;
  authority_status: SdoAuthorityStatus;
  temporal_status: SdoTemporalStatus;
  valid_from: string | null;
  valid_until: string | null;
  review_due: string | null;
  supersedes_id: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
  origin_system: string | null;
  origin_ref: string | null;
  extracted_by: 'humano' | 'ia';
  model_version: string | null;
  prompt_version: string | null;
  confidence: number | null;
  confidentiality: SdoConfidentiality;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SdoClaim {
  id: string;
  claim_type: 'hecho' | 'decision' | 'compromiso' | 'requisito' | 'riesgo' | 'propuesta';
  statement: string;
  subject: string | null;
  source_refs: SdoSourceRef[];
  epistemic_status: SdoEpistemicStatus;
  authority_status: SdoAuthorityStatus;
  temporal_status: SdoTemporalStatus;
  valid_from: string | null;
  valid_until: string | null;
  review_due: string | null;
  extracted_by: 'humano' | 'ia';
  confidence: number | null;
  confidentiality: SdoConfidentiality;
  owner_user_id: string;
  created_at: string;
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
  external_ref: string | null;
  origin_system: string | null;
  origin_ref: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SdoApproval {
  id: string;
  object_type: SdoApprovalObjectType;
  object_id: string;
  decided_by_user_id: string;
  role_at_time: string | null;
  decision: 'aprobado' | 'rechazado';
  comment: string | null;
  decided_at: string;
}

export interface SdoAuditEvent {
  id: string;
  actor_type: 'humano' | 'ia' | 'sistema';
  actor_id: string | null;
  event_type: string;
  object_type: string;
  object_id: string;
  reason: string | null;
  created_at: string;
}

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
}

type SdoResult<T> = Promise<{ success: boolean; error?: string } & Partial<T>>;

declare global {
  interface Window {
    sdo: {
      listDecisions: (filters?: SdoListFilters) => SdoResult<{ decisions: SdoDecision[] }>;
      getDecision: (decisionId: string) => SdoResult<{ decision: SdoDecision; approvals: SdoApproval[]; audit: SdoAuditEvent[] }>;
      createDecision: (input: Partial<SdoDecision> & { statement: string; owner_user_id: string }) => SdoResult<{ decision: SdoDecision }>;
      listClaims: (filters?: SdoListFilters) => SdoResult<{ claims: SdoClaim[] }>;
      createClaim: (input: Partial<SdoClaim> & { statement: string; claim_type: SdoClaim['claim_type']; owner_user_id: string }) => SdoResult<{ claim: SdoClaim }>;
      listActions: (filters?: SdoListFilters & { status?: SdoActionStatus }) => SdoResult<{ actions: SdoAction[] }>;
      createAction: (input: Partial<SdoAction> & { description: string; owner_user_id: string }) => SdoResult<{ action: SdoAction }>;
      updateAction: (input: { actionId: string; updates: Partial<Pick<SdoAction, 'description' | 'responsible' | 'due_date' | 'status' | 'external_ref'>> }) => SdoResult<{ action: SdoAction }>;
      approve: (input: SdoApproveInput) => SdoResult<{ approval: SdoApproval }>;
      reject: (input: SdoApproveInput) => SdoResult<{ approval: SdoApproval }>;
      listAudit: (input: { objectType: string; objectId: string; limit?: number }) => SdoResult<{ events: SdoAuditEvent[] }>;
      generateDocument: (input: { tipo: 'minuta' | 'decision_record'; ref: string; titulo?: string }) => SdoResult<{ result: { artifactId: string; markdown: string; filePath: string } }>;
      getContextCard: (input: { sujeto: string; persistir?: boolean; ownerUserId?: string }) => SdoResult<{ card: { markdown: string; artifactId?: string; filePath?: string } }>;
      listArtifacts: (filters?: { ownerUserId?: string; artifactType?: string; limit?: number }) => SdoResult<{ artifacts: SdoArtifact[] }>;
      approveArtifact: (input: { artifactId: string; decidedByUserId: string; comment?: string }) => SdoResult<{ snapshot: { sha256: string } }>;
      getStatus: () => SdoResult<{ status: { initialized: boolean; lastAdapterError: string | null } }>;
    };
  }
}

export interface SdoArtifact {
  id: string;
  artifact_type: 'minuta' | 'decision_record' | 'tarjeta_contexto';
  title: string;
  template_id: string;
  template_version: string;
  authority_status: SdoAuthorityStatus;
  temporal_status: SdoTemporalStatus;
  local_path: string | null;
  sha256: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  owner_user_id: string;
  created_at: string;
}

export function listSdoDecisions(filters?: SdoListFilters) {
  return window.sdo.listDecisions(filters);
}

export function getSdoDecision(decisionId: string) {
  return window.sdo.getDecision(decisionId);
}

export function createSdoDecision(input: Partial<SdoDecision> & { statement: string; owner_user_id: string }) {
  return window.sdo.createDecision(input);
}

export function listSdoClaims(filters?: SdoListFilters) {
  return window.sdo.listClaims(filters);
}

export function listSdoActions(filters?: SdoListFilters & { status?: SdoActionStatus }) {
  return window.sdo.listActions(filters);
}

export function updateSdoAction(input: { actionId: string; updates: Partial<Pick<SdoAction, 'description' | 'responsible' | 'due_date' | 'status' | 'external_ref'>> }) {
  return window.sdo.updateAction(input);
}

export function approveSdoObject(input: SdoApproveInput) {
  return window.sdo.approve(input);
}

export function rejectSdoObject(input: SdoApproveInput) {
  return window.sdo.reject(input);
}

export function listSdoAudit(input: { objectType: string; objectId: string; limit?: number }) {
  return window.sdo.listAudit(input);
}

export function getSdoStatus() {
  return window.sdo.getStatus();
}

export function generateSdoDocument(input: { tipo: 'minuta' | 'decision_record'; ref: string; titulo?: string }) {
  return window.sdo.generateDocument(input);
}

export function getSdoContextCard(input: { sujeto: string; persistir?: boolean; ownerUserId?: string }) {
  return window.sdo.getContextCard(input);
}

export function listSdoArtifacts(filters?: { ownerUserId?: string; artifactType?: string; limit?: number }) {
  return window.sdo.listArtifacts(filters);
}

export function approveSdoArtifact(input: { artifactId: string; decidedByUserId: string; comment?: string }) {
  return window.sdo.approveArtifact(input);
}
