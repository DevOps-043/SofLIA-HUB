/**
 * SdoStore — persistencia del Registro Operativo Gobernado en la base
 * de Pulse Hub (tablas sdo_*).
 *
 * Reglas de gobierno que aplica este store:
 * - Aprobar/rechazar exige un usuario humano (decided_by_user_id no vacio).
 * - Toda mutacion relevante deja un evento en la bitacora append-only.
 * - Las escrituras de adaptadores usan idempotency_key para no duplicar.
 * - Al aprobar un registro con supersedes_id, el predecesor pasa a
 *   temporal_status 'reemplazado'.
 */
import { getSdoHubClient } from './sdo-hub-client';
import { registrarEvento, listarEventos } from './sdo-audit';
import { makeSdoId, nowIso, parseJson, throwOnSdoError } from './sdo-shared';
import type {
  SdoAction,
  SdoApproval,
  SdoApprovalObjectType,
  SdoApproveInput,
  SdoAuditEvent,
  SdoClaim,
  SdoCreateActionInput,
  SdoCreateClaimInput,
  SdoCreateDecisionInput,
  SdoCreateEvidenceInput,
  SdoCreateSourceInput,
  SdoDecision,
  SdoEvidence,
  SdoListFilters,
  SdoSource,
  SdoSourceRef,
} from './sdo-types';

const OBJECT_TABLES: Record<SdoApprovalObjectType, string> = {
  claim: 'sdo_claims',
  decision: 'sdo_decisions',
  action: 'sdo_actions',
  artifact: 'sdo_artifacts',
};

type Row = Record<string, unknown>;

function mapSourceRefs(value: unknown): SdoSourceRef[] {
  return parseJson<SdoSourceRef[]>(value, []);
}

function mapClaim(row: Row): SdoClaim {
  return {
    ...(row as unknown as SdoClaim),
    object_refs: parseJson<string[]>(row.object_refs, []),
    source_refs: mapSourceRefs(row.source_refs),
    metadata_json: parseJson<Record<string, unknown>>(row.metadata_json, {}),
  };
}

function mapDecision(row: Row): SdoDecision {
  return {
    ...(row as unknown as SdoDecision),
    options_json: parseJson<unknown[]>(row.options_json, []),
    source_refs: mapSourceRefs(row.source_refs),
    metadata_json: parseJson<Record<string, unknown>>(row.metadata_json, {}),
  };
}

function mapAction(row: Row): SdoAction {
  return {
    ...(row as unknown as SdoAction),
    source_refs: mapSourceRefs(row.source_refs),
    metadata_json: parseJson<Record<string, unknown>>(row.metadata_json, {}),
  };
}

function exigirUsuarioHumano(decidedByUserId: string | undefined | null): string {
  const userId = (decidedByUserId || '').trim();
  if (!userId) {
    throw new Error('Una aprobacion del SDO requiere un usuario humano (decided_by_user_id). La IA no puede aprobar.');
  }
  return userId;
}

export class SdoStore {
  // ------------------------------------------------------------------
  // Fuentes y evidencia
  // ------------------------------------------------------------------

  async obtenerFuentePorRef(system: string, externalRef: string): Promise<SdoSource | null> {
    const supabase = getSdoHubClient();
    const { data, error } = await supabase
      .from('sdo_sources')
      .select('*')
      .eq('system', system)
      .eq('external_ref', externalRef)
      .maybeSingle();

    throwOnSdoError(error, 'obtenerFuentePorRef');
    return (data as SdoSource | null) ?? null;
  }

  async crearFuente(input: SdoCreateSourceInput): Promise<SdoSource> {
    if (input.external_ref) {
      const existente = await this.obtenerFuentePorRef(input.system, input.external_ref);
      if (existente) return existente;
    }

    const supabase = getSdoHubClient();
    const id = input.id ?? makeSdoId('sdosrc');
    const { data, error } = await supabase
      .from('sdo_sources')
      .insert({
        id,
        system: input.system,
        source_type: input.source_type,
        uri: input.uri ?? null,
        external_ref: input.external_ref ?? null,
        custodian: input.custodian ?? null,
        captured_at: input.captured_at ?? nowIso(),
        confidentiality: input.confidentiality ?? 'P1',
        owner_user_id: input.owner_user_id,
        organization_id: input.organization_id ?? null,
        trace_id: input.trace_id ?? null,
        metadata_json: input.metadata_json ?? {},
      })
      .select()
      .single();

    throwOnSdoError(error, 'crearFuente');
    return data as SdoSource;
  }

  async crearEvidencia(input: SdoCreateEvidenceInput): Promise<SdoEvidence> {
    const supabase = getSdoHubClient();
    const id = input.id ?? makeSdoId('sdoevd');
    const { data, error } = await supabase
      .from('sdo_evidence')
      .upsert(
        {
          id,
          source_id: input.source_id,
          sha256: input.sha256,
          storage_uri: input.storage_uri ?? null,
          mime_type: input.mime_type ?? null,
          excerpt: input.excerpt ?? null,
          captured_at: input.captured_at ?? nowIso(),
          confidentiality: input.confidentiality ?? 'P1',
          owner_user_id: input.owner_user_id,
          metadata_json: input.metadata_json ?? {},
        },
        { onConflict: 'source_id,sha256', ignoreDuplicates: false },
      )
      .select()
      .single();

    throwOnSdoError(error, 'crearEvidencia');
    return data as SdoEvidence;
  }

  // ------------------------------------------------------------------
  // Claims
  // ------------------------------------------------------------------

  async crearClaim(input: SdoCreateClaimInput): Promise<SdoClaim> {
    const supabase = getSdoHubClient();
    const id = input.id ?? makeSdoId('sdoclm');
    const fila = {
      id,
      claim_type: input.claim_type,
      statement: input.statement,
      subject: input.subject ?? null,
      object_refs: input.object_refs ?? [],
      source_refs: input.source_refs ?? [],
      epistemic_status: input.epistemic_status ?? 'desconocido',
      authority_status: input.authority_status ?? 'borrador',
      temporal_status: input.temporal_status ?? 'futuro',
      valid_from: input.valid_from ?? null,
      valid_until: input.valid_until ?? null,
      review_due: input.review_due ?? null,
      supersedes_id: input.supersedes_id ?? null,
      reviewer_user_id: input.reviewer_user_id ?? null,
      approver_user_id: input.approver_user_id ?? null,
      authority_basis: input.authority_basis ?? null,
      extracted_by: input.extracted_by ?? 'humano',
      model_version: input.model_version ?? null,
      prompt_version: input.prompt_version ?? null,
      confidence: input.confidence ?? null,
      idempotency_key: input.idempotency_key ?? null,
      origin_system: input.origin_system ?? null,
      origin_ref: input.origin_ref ?? null,
      confidentiality: input.confidentiality ?? 'P1',
      owner_user_id: input.owner_user_id,
      organization_id: input.organization_id ?? null,
      trace_id: input.trace_id ?? null,
      metadata_json: input.metadata_json ?? {},
      updated_at: nowIso(),
    };

    const query = input.idempotency_key
      ? supabase.from('sdo_claims').upsert(fila, { onConflict: 'idempotency_key', ignoreDuplicates: false })
      : supabase.from('sdo_claims').insert(fila);

    const { data, error } = await query.select().single();
    throwOnSdoError(error, 'crearClaim');

    const claim = mapClaim(data as Row);
    await registrarEvento({
      actor_type: claim.extracted_by === 'ia' ? 'ia' : 'humano',
      actor_id: claim.owner_user_id,
      event_type: claim.authority_status === 'propuesto' ? 'propuesto' : 'creado',
      object_type: 'claim',
      object_id: claim.id,
      after_json: { statement: claim.statement, claim_type: claim.claim_type },
      trace_id: claim.trace_id,
    });
    return claim;
  }

  async listarClaims(filters?: SdoListFilters): Promise<SdoClaim[]> {
    const supabase = getSdoHubClient();
    let query = supabase.from('sdo_claims').select('*').order('created_at', { ascending: false });
    if (filters?.ownerUserId) query = query.eq('owner_user_id', filters.ownerUserId);
    if (filters?.authorityStatus) query = query.eq('authority_status', filters.authorityStatus);
    if (filters?.temporalStatus) query = query.eq('temporal_status', filters.temporalStatus);
    if (filters?.epistemicStatus) query = query.eq('epistemic_status', filters.epistemicStatus);
    if (filters?.subject) query = query.ilike('subject', `%${filters.subject}%`);
    if (filters?.originRef) query = query.eq('origin_ref', filters.originRef);
    query = query.limit(filters?.limit ?? 100);

    const { data, error } = await query;
    throwOnSdoError(error, 'listarClaims');
    return ((data || []) as Row[]).map(mapClaim);
  }

  // ------------------------------------------------------------------
  // Decisiones
  // ------------------------------------------------------------------

  async crearDecision(input: SdoCreateDecisionInput): Promise<SdoDecision> {
    const supabase = getSdoHubClient();
    const id = input.id ?? makeSdoId('sdodec');
    const fila = {
      id,
      question: input.question ?? null,
      statement: input.statement,
      context: input.context ?? null,
      options_json: input.options_json ?? [],
      consequences: input.consequences ?? null,
      decision_owner: input.decision_owner ?? null,
      authority_basis: input.authority_basis ?? null,
      communication_rule: input.communication_rule ?? null,
      source_refs: input.source_refs ?? [],
      epistemic_status: input.epistemic_status ?? 'desconocido',
      authority_status: input.authority_status ?? 'borrador',
      temporal_status: input.temporal_status ?? 'futuro',
      valid_from: input.valid_from ?? null,
      valid_until: input.valid_until ?? null,
      review_due: input.review_due ?? null,
      supersedes_id: input.supersedes_id ?? null,
      approved_at: input.approved_at ?? null,
      approved_by_user_id: input.approved_by_user_id ?? null,
      origin_system: input.origin_system ?? null,
      origin_ref: input.origin_ref ?? null,
      idempotency_key: input.idempotency_key ?? null,
      extracted_by: input.extracted_by ?? 'humano',
      model_version: input.model_version ?? null,
      prompt_version: input.prompt_version ?? null,
      confidence: input.confidence ?? null,
      confidentiality: input.confidentiality ?? 'P1',
      owner_user_id: input.owner_user_id,
      organization_id: input.organization_id ?? null,
      trace_id: input.trace_id ?? null,
      metadata_json: input.metadata_json ?? {},
      updated_at: nowIso(),
    };

    const query = input.idempotency_key
      ? supabase.from('sdo_decisions').upsert(fila, { onConflict: 'idempotency_key', ignoreDuplicates: false })
      : supabase.from('sdo_decisions').insert(fila);

    const { data, error } = await query.select().single();
    throwOnSdoError(error, 'crearDecision');

    const decision = mapDecision(data as Row);
    await registrarEvento({
      actor_type: decision.extracted_by === 'ia' ? 'ia' : 'humano',
      actor_id: decision.owner_user_id,
      event_type: decision.authority_status === 'propuesto' ? 'propuesto' : 'creado',
      object_type: 'decision',
      object_id: decision.id,
      after_json: { statement: decision.statement, authority_status: decision.authority_status },
      trace_id: decision.trace_id,
    });
    return decision;
  }

  async obtenerDecision(id: string): Promise<SdoDecision | null> {
    const supabase = getSdoHubClient();
    const { data, error } = await supabase.from('sdo_decisions').select('*').eq('id', id).maybeSingle();
    throwOnSdoError(error, 'obtenerDecision');
    return data ? mapDecision(data as Row) : null;
  }

  async listarDecisiones(filters?: SdoListFilters): Promise<SdoDecision[]> {
    const supabase = getSdoHubClient();
    let query = supabase.from('sdo_decisions').select('*').order('created_at', { ascending: false });
    if (filters?.ownerUserId) query = query.eq('owner_user_id', filters.ownerUserId);
    if (filters?.authorityStatus) query = query.eq('authority_status', filters.authorityStatus);
    if (filters?.temporalStatus) query = query.eq('temporal_status', filters.temporalStatus);
    if (filters?.epistemicStatus) query = query.eq('epistemic_status', filters.epistemicStatus);
    if (filters?.subject) query = query.ilike('statement', `%${filters.subject}%`);
    if (filters?.originRef) query = query.eq('origin_ref', filters.originRef);
    query = query.limit(filters?.limit ?? 100);

    const { data, error } = await query;
    throwOnSdoError(error, 'listarDecisiones');
    return ((data || []) as Row[]).map(mapDecision);
  }

  // ------------------------------------------------------------------
  // Acciones
  // ------------------------------------------------------------------

  async crearAccion(input: SdoCreateActionInput): Promise<SdoAction> {
    const supabase = getSdoHubClient();
    const id = input.id ?? makeSdoId('sdoact');
    const fila = {
      id,
      description: input.description,
      responsible: input.responsible ?? null,
      decision_id: input.decision_id ?? null,
      due_date: input.due_date ?? null,
      status: input.status ?? 'abierta',
      authority_status: input.authority_status ?? 'borrador',
      temporal_status: input.temporal_status ?? 'futuro',
      valid_from: input.valid_from ?? null,
      review_due: input.review_due ?? null,
      source_refs: input.source_refs ?? [],
      origin_system: input.origin_system ?? null,
      origin_ref: input.origin_ref ?? null,
      external_ref: input.external_ref ?? null,
      idempotency_key: input.idempotency_key ?? null,
      extracted_by: input.extracted_by ?? 'humano',
      confidence: input.confidence ?? null,
      confidentiality: input.confidentiality ?? 'P1',
      owner_user_id: input.owner_user_id,
      organization_id: input.organization_id ?? null,
      trace_id: input.trace_id ?? null,
      metadata_json: input.metadata_json ?? {},
      updated_at: nowIso(),
    };

    const query = input.idempotency_key
      ? supabase.from('sdo_actions').upsert(fila, { onConflict: 'idempotency_key', ignoreDuplicates: false })
      : supabase.from('sdo_actions').insert(fila);

    const { data, error } = await query.select().single();
    throwOnSdoError(error, 'crearAccion');

    const accion = mapAction(data as Row);
    await registrarEvento({
      actor_type: accion.extracted_by === 'ia' ? 'ia' : 'humano',
      actor_id: accion.owner_user_id,
      event_type: accion.authority_status === 'propuesto' ? 'propuesto' : 'creado',
      object_type: 'action',
      object_id: accion.id,
      after_json: { description: accion.description, status: accion.status },
      trace_id: accion.trace_id,
    });
    return accion;
  }

  async listarAcciones(filters?: SdoListFilters & { status?: SdoAction['status'] }): Promise<SdoAction[]> {
    const supabase = getSdoHubClient();
    let query = supabase.from('sdo_actions').select('*').order('created_at', { ascending: false });
    if (filters?.ownerUserId) query = query.eq('owner_user_id', filters.ownerUserId);
    if (filters?.authorityStatus) query = query.eq('authority_status', filters.authorityStatus);
    if (filters?.temporalStatus) query = query.eq('temporal_status', filters.temporalStatus);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.originRef) query = query.eq('origin_ref', filters.originRef);
    query = query.limit(filters?.limit ?? 100);

    const { data, error } = await query;
    throwOnSdoError(error, 'listarAcciones');
    return ((data || []) as Row[]).map(mapAction);
  }

  async actualizarAccion(id: string, updates: Partial<Pick<SdoAction, 'description' | 'responsible' | 'due_date' | 'status' | 'external_ref' | 'review_due'>>): Promise<SdoAction> {
    const supabase = getSdoHubClient();
    const { data: antes, error: errorAntes } = await supabase.from('sdo_actions').select('*').eq('id', id).maybeSingle();
    throwOnSdoError(errorAntes, 'actualizarAccion.select');
    if (!antes) throw new Error('No encontre la accion del SDO solicitada.');

    const { data, error } = await supabase
      .from('sdo_actions')
      .update({ ...updates, updated_at: nowIso() })
      .eq('id', id)
      .select()
      .single();

    throwOnSdoError(error, 'actualizarAccion');
    const accion = mapAction(data as Row);
    await registrarEvento({
      actor_type: 'humano',
      actor_id: accion.owner_user_id,
      event_type: 'editado',
      object_type: 'action',
      object_id: id,
      before_json: { status: (antes as Row).status, responsible: (antes as Row).responsible },
      after_json: { status: accion.status, responsible: accion.responsible },
      trace_id: accion.trace_id,
    });
    return accion;
  }

  // ------------------------------------------------------------------
  // Aprobaciones (acto de autoridad — siempre humano)
  // ------------------------------------------------------------------

  async aprobar(input: SdoApproveInput): Promise<SdoApproval> {
    return this.decidir(input, 'aprobado');
  }

  async rechazar(input: SdoApproveInput): Promise<SdoApproval> {
    return this.decidir(input, 'rechazado');
  }

  private async decidir(input: SdoApproveInput, decision: 'aprobado' | 'rechazado'): Promise<SdoApproval> {
    const userId = exigirUsuarioHumano(input.decidedByUserId);
    const tabla = OBJECT_TABLES[input.objectType];
    if (!tabla) throw new Error(`Tipo de objeto SDO desconocido: ${input.objectType}`);

    const supabase = getSdoHubClient();
    const { data: objeto, error: errorObjeto } = await supabase.from(tabla).select('*').eq('id', input.objectId).maybeSingle();
    throwOnSdoError(errorObjeto, 'decidir.selectObjeto');
    if (!objeto) throw new Error(`No encontre el objeto ${input.objectType} ${input.objectId} en el SDO.`);

    const objetoRow = objeto as Row;
    const ahora = nowIso();

    // Idempotencia del acto: repetir la misma decision no crea duplicados.
    const idempotencyKey = `sdo:${input.objectType}:${input.objectId}:${decision}`;
    const aprobacion = {
      id: makeSdoId('sdoapr'),
      object_type: input.objectType,
      object_id: input.objectId,
      requested_by_user_id: userId,
      decided_by_user_id: userId,
      role_at_time: input.roleAtTime ?? null,
      decision,
      comment: input.comment ?? null,
      evidence_links: input.evidenceLinks ?? [],
      object_version_before: null,
      object_version_after: null,
      idempotency_key: idempotencyKey,
      decided_at: ahora,
      trace_id: (objetoRow.trace_id as string | null) ?? null,
      organization_id: (objetoRow.organization_id as string | null) ?? null,
    };

    const { data: aprobacionRow, error: errorAprobacion } = await supabase
      .from('sdo_approvals')
      .upsert(aprobacion, { onConflict: 'idempotency_key', ignoreDuplicates: false })
      .select()
      .single();
    throwOnSdoError(errorAprobacion, 'decidir.insertAprobacion');

    // Actualizar el estado de autoridad (y vigencia si se aprueba).
    const updates: Row = {
      authority_status: decision,
      updated_at: ahora,
    };
    if (decision === 'aprobado') {
      updates.temporal_status = 'vigente';
      updates.valid_from = (objetoRow.valid_from as string | null) ?? ahora;
      if (input.objectType === 'decision') {
        updates.approved_at = ahora;
        updates.approved_by_user_id = userId;
      }
      if (input.objectType === 'claim') {
        updates.approver_user_id = userId;
      }
    }

    const { error: errorUpdate } = await supabase.from(tabla).update(updates).eq('id', input.objectId);
    throwOnSdoError(errorUpdate, 'decidir.updateObjeto');

    // Sustitucion explicita: el predecesor queda 'reemplazado'.
    const supersedesId = (objetoRow.supersedes_id as string | null) ?? null;
    if (decision === 'aprobado' && supersedesId) {
      const { error: errorSupersede } = await supabase
        .from(tabla)
        .update({ temporal_status: 'reemplazado', updated_at: ahora })
        .eq('id', supersedesId);
      throwOnSdoError(errorSupersede, 'decidir.marcarReemplazado');
      await registrarEvento({
        actor_type: 'sistema',
        event_type: 'reemplazado',
        object_type: input.objectType,
        object_id: supersedesId,
        reason: `Sustituido por ${input.objectId} al aprobarse.`,
        trace_id: (objetoRow.trace_id as string | null) ?? null,
      });
    }

    await registrarEvento({
      actor_type: 'humano',
      actor_id: userId,
      event_type: decision,
      object_type: input.objectType,
      object_id: input.objectId,
      before_json: { authority_status: objetoRow.authority_status, temporal_status: objetoRow.temporal_status },
      after_json: { authority_status: decision, temporal_status: decision === 'aprobado' ? 'vigente' : objetoRow.temporal_status },
      reason: input.comment ?? null,
      trace_id: (objetoRow.trace_id as string | null) ?? null,
    });

    return aprobacionRow as SdoApproval;
  }

  // ------------------------------------------------------------------
  // Artefactos (vistas generadas desde registros; snapshot al aprobar)
  // ------------------------------------------------------------------

  async crearArtefacto(input: {
    artifact_type: 'minuta' | 'decision_record' | 'tarjeta_contexto';
    title: string;
    template_id: string;
    template_version: string;
    record_refs: Array<{ object_type: string; object_id: string }>;
    local_path?: string | null;
    confidentiality?: string;
    owner_user_id: string;
    organization_id?: string | null;
    trace_id?: string | null;
    metadata_json?: Record<string, unknown>;
  }): Promise<Row> {
    const supabase = getSdoHubClient();
    const id = makeSdoId('sdoart');
    const { data, error } = await supabase
      .from('sdo_artifacts')
      .insert({
        id,
        artifact_type: input.artifact_type,
        title: input.title,
        template_id: input.template_id,
        template_version: input.template_version,
        record_refs: input.record_refs,
        authority_status: 'borrador',
        temporal_status: 'futuro',
        local_path: input.local_path ?? null,
        confidentiality: input.confidentiality ?? 'P1',
        owner_user_id: input.owner_user_id,
        organization_id: input.organization_id ?? null,
        trace_id: input.trace_id ?? null,
        metadata_json: input.metadata_json ?? {},
        updated_at: nowIso(),
      })
      .select()
      .single();

    throwOnSdoError(error, 'crearArtefacto');
    await registrarEvento({
      actor_type: 'sistema',
      event_type: 'creado',
      object_type: 'artifact',
      object_id: id,
      after_json: { artifact_type: input.artifact_type, title: input.title },
      trace_id: input.trace_id ?? null,
    });
    return data as Row;
  }

  async obtenerArtefacto(id: string): Promise<Row | null> {
    const supabase = getSdoHubClient();
    const { data, error } = await supabase.from('sdo_artifacts').select('*').eq('id', id).maybeSingle();
    throwOnSdoError(error, 'obtenerArtefacto');
    return (data as Row | null) ?? null;
  }

  async listarArtefactos(filters?: { ownerUserId?: string; artifactType?: string; limit?: number }): Promise<Row[]> {
    const supabase = getSdoHubClient();
    let query = supabase.from('sdo_artifacts').select('*').order('created_at', { ascending: false });
    if (filters?.ownerUserId) query = query.eq('owner_user_id', filters.ownerUserId);
    if (filters?.artifactType) query = query.eq('artifact_type', filters.artifactType);
    query = query.limit(filters?.limit ?? 100);

    const { data, error } = await query;
    throwOnSdoError(error, 'listarArtefactos');
    return (data || []) as Row[];
  }

  async actualizarArtefacto(id: string, updates: Row): Promise<void> {
    const supabase = getSdoHubClient();
    const { error } = await supabase
      .from('sdo_artifacts')
      .update({ ...updates, updated_at: nowIso() })
      .eq('id', id);
    throwOnSdoError(error, 'actualizarArtefacto');
  }

  async listarAprobaciones(objectType: SdoApprovalObjectType, objectId: string): Promise<SdoApproval[]> {
    const supabase = getSdoHubClient();
    const { data, error } = await supabase
      .from('sdo_approvals')
      .select('*')
      .eq('object_type', objectType)
      .eq('object_id', objectId)
      .order('decided_at', { ascending: false });

    throwOnSdoError(error, 'listarAprobaciones');
    return (data || []) as SdoApproval[];
  }

  async listarBitacora(objectType: string, objectId: string, limit = 100): Promise<SdoAuditEvent[]> {
    return listarEventos(objectType, objectId, limit);
  }
}
