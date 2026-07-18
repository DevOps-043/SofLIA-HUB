import { getSdoHubClient } from './sdo-hub-client';
import { makeSdoId, throwOnSdoError } from './sdo-shared';
import type { SdoActorType, SdoAuditEvent, SdoAuditEventType } from './sdo-types';

export interface RegistrarEventoInput {
  actor_type: SdoActorType;
  actor_id?: string | null;
  event_type: SdoAuditEventType;
  object_type: string;
  object_id: string;
  before_json?: Record<string, unknown> | null;
  after_json?: Record<string, unknown> | null;
  reason?: string | null;
  trace_id?: string | null;
}

/**
 * Bitacora append-only del SDO. Solo INSERT: la tabla tiene un trigger que
 * bloquea UPDATE/DELETE. Los fallos de auditoria se lanzan al llamador,
 * que decide si son bloqueantes.
 */
export async function registrarEvento(input: RegistrarEventoInput): Promise<string> {
  const supabase = getSdoHubClient();
  const id = makeSdoId('sdoaud');

  const { error } = await supabase.from('sdo_audit_events').insert({
    id,
    actor_type: input.actor_type,
    actor_id: input.actor_id ?? null,
    event_type: input.event_type,
    object_type: input.object_type,
    object_id: input.object_id,
    before_json: input.before_json ?? null,
    after_json: input.after_json ?? null,
    reason: input.reason ?? null,
    trace_id: input.trace_id ?? null,
  });

  throwOnSdoError(error, 'registrarEvento');
  return id;
}

export async function listarEventos(objectType: string, objectId: string, limit = 100): Promise<SdoAuditEvent[]> {
  const supabase = getSdoHubClient();
  const { data, error } = await supabase
    .from('sdo_audit_events')
    .select('*')
    .eq('object_type', objectType)
    .eq('object_id', objectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  throwOnSdoError(error, 'listarEventos');
  return (data || []) as SdoAuditEvent[];
}
