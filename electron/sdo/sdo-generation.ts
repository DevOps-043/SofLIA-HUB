/**
 * Trazabilidad de generacion IA del SDO (sdo_generation_runs).
 *
 * Cada salida generativa relevante registra: modelo, prompt (id + version +
 * hash del prompt renderizado), evidencia de entrada y registros de salida.
 * Si el hash cambia sin subir la version del prompt, se alerta en el log:
 * eso delata un cambio de prompt sin bump de version.
 */
import { getSdoHubClient } from './sdo-hub-client';
import { makeSdoId, sha256Hex, throwOnSdoError } from './sdo-shared';

export interface RegistrarGeneracionInput {
  trace_id: string;
  purpose: string;
  model_used: string;
  prompt_id: string;
  prompt_version: string;
  /** Prompt final renderizado; solo se persiste su hash sha256. */
  prompt_text: string;
  schema_version?: string | null;
  /** Ids de sdo_evidence, o referencias `sha256:<hash>` si aun no hay evidencia registrada. */
  input_evidence_ids?: string[];
  output_object_refs?: Array<{ object_type: string; object_id: string }>;
  ai_output_raw?: string | null;
  validation_json?: Record<string, unknown> | null;
  confidence?: number | null;
  owner_user_id?: string | null;
}

export async function registrarGeneracion(input: RegistrarGeneracionInput): Promise<string> {
  const supabase = getSdoHubClient();
  const id = makeSdoId('sdogen');
  const promptHash = sha256Hex(input.prompt_text);

  // Deteccion de cambio de prompt sin bump de version: comparar contra la
  // ultima corrida registrada con el mismo prompt_id + prompt_version.
  // Nota: el prompt renderizado incluye datos de la reunion, por lo que el
  // hash varia entre corridas; la senal util es informativa, no bloqueante.
  const { data: previa } = await supabase
    .from('sdo_generation_runs')
    .select('prompt_hash')
    .eq('prompt_id', input.prompt_id)
    .eq('prompt_version', input.prompt_version)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previa && previa.prompt_hash && previa.prompt_hash !== promptHash) {
    console.info(
      `[SDO] prompt_hash distinto para ${input.prompt_id}@${input.prompt_version} (esperado si el prompt incluye datos variables; si cambiaste la plantilla, sube PROMPT_VERSION).`,
    );
  }

  const { error } = await supabase.from('sdo_generation_runs').insert({
    id,
    trace_id: input.trace_id,
    purpose: input.purpose,
    model_used: input.model_used,
    prompt_id: input.prompt_id,
    prompt_version: input.prompt_version,
    prompt_hash: promptHash,
    schema_version: input.schema_version ?? null,
    input_evidence_ids: input.input_evidence_ids ?? [],
    output_object_refs: input.output_object_refs ?? [],
    ai_output_raw: input.ai_output_raw ?? null,
    validation_json: input.validation_json ?? null,
    confidence: input.confidence ?? null,
    owner_user_id: input.owner_user_id ?? null,
  });

  throwOnSdoError(error, 'registrarGeneracion');
  return id;
}
