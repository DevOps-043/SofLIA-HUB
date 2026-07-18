/**
 * Ejecutores de las herramientas SDO del agente WhatsApp.
 *
 * Gobierno aplicado aqui:
 * - No existe ruta de aprobacion: solo consulta y propuesta.
 * - Confidencialidad: P3 nunca sale por el agente; P2 no sale en grupos.
 * - Toda propuesta queda como 'propuesto' + extracted_by 'ia'.
 */
import { SdoStore } from '../sdo/sdo-store';
import { construirRespuestaProtocolo } from '../sdo/sdo-context-protocol';
import { phoneOwnerKey } from '../memory/scope';
import type { SdoClaimType } from '../sdo/sdo-types';

interface SdoFunctionResponse {
  functionResponse: {
    name: string;
    response: Record<string, unknown>;
  };
}

const SDO_TOOL_NAMES = new Set(['sdo_query', 'sdo_propose']);

let storeSingleton: SdoStore | null = null;

function getStore(): SdoStore {
  if (!storeSingleton) storeSingleton = new SdoStore();
  return storeSingleton;
}

/** Solo para tests: permite inyectar un store falso. */
export function setSdoStoreForTests(store: SdoStore | null): void {
  storeSingleton = store;
}

export function isSdoTool(toolName: string): boolean {
  return SDO_TOOL_NAMES.has(toolName);
}

const TIPO_CLAIM: Record<string, SdoClaimType> = {
  riesgo: 'riesgo',
  hecho: 'hecho',
  compromiso: 'compromiso',
};

export async function executeSdoTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  senderNumber: string,
  isGroup: boolean,
): Promise<SdoFunctionResponse | null> {
  if (!SDO_TOOL_NAMES.has(toolName)) return null;

  try {
    if (toolName === 'sdo_query') {
      return { functionResponse: { name: toolName, response: await ejecutarQuery(toolArgs, isGroup) } };
    }
    return { functionResponse: { name: toolName, response: await ejecutarPropose(toolArgs, senderNumber) } };
  } catch (error) {
    return {
      functionResponse: {
        name: toolName,
        response: { success: false, error: error instanceof Error ? error.message : String(error) },
      },
    };
  }
}

async function ejecutarQuery(toolArgs: Record<string, unknown>, isGroup: boolean): Promise<Record<string, unknown>> {
  const tema = String(toolArgs.tema || '').trim();
  if (!tema) return { success: false, error: 'Falta el tema a consultar.' };

  const soloVigentes = toolArgs.solo_vigentes === true;
  const store = getStore();

  const [decisiones, claims, acciones] = await Promise.all([
    store.listarDecisiones({ subject: tema, limit: 30 }),
    store.listarClaims({ subject: tema, limit: 30 }),
    store.listarAcciones({ limit: 50 }),
  ]);

  // Confidencialidad: P3 nunca sale por el agente; P2 no sale en grupos.
  const nivelPermitido = (confidencialidad: string) =>
    confidencialidad !== 'P3' && !(isGroup && confidencialidad === 'P2');

  const decisionesVisibles = decisiones
    .filter((d) => nivelPermitido(d.confidentiality))
    .filter((d) => !soloVigentes || (d.authority_status === 'aprobado' && d.temporal_status === 'vigente'));
  const claimsVisibles = claims
    .filter((c) => nivelPermitido(c.confidentiality))
    .filter((c) => !soloVigentes || (c.authority_status === 'aprobado' && c.temporal_status === 'vigente'));
  const accionesVisibles = acciones.filter(
    (a) => nivelPermitido(a.confidentiality) && a.description.toLowerCase().includes(tema.toLowerCase()),
  );

  const ocultos = decisiones.length + claims.length - decisionesVisibles.length - claimsVisibles.length;

  const respuesta = construirRespuestaProtocolo({
    tema,
    decisiones: decisionesVisibles,
    claims: claimsVisibles,
    acciones: accionesVisibles,
  });

  return {
    success: true,
    respuesta_estructurada: respuesta,
    registros_ocultos_por_confidencialidad: ocultos > 0 ? ocultos : undefined,
    instruccion: 'Responde usando los 5 bloques tal cual. No presentes lo no confirmado o pendiente como decidido.',
  };
}

async function ejecutarPropose(toolArgs: Record<string, unknown>, senderNumber: string): Promise<Record<string, unknown>> {
  const tipo = String(toolArgs.tipo || '').trim().toLowerCase();
  const statement = String(toolArgs.statement || '').trim();
  if (!statement) return { success: false, error: 'Falta el enunciado (statement) de la propuesta.' };

  const store = getStore();
  const ownerKey = phoneOwnerKey(senderNumber);
  const subject = toolArgs.subject ? String(toolArgs.subject) : null;

  if (tipo === 'decision') {
    const decision = await store.crearDecision({
      statement,
      decision_owner: toolArgs.decision_owner ? String(toolArgs.decision_owner) : null,
      authority_status: 'propuesto',
      temporal_status: 'futuro',
      epistemic_status: 'inferido',
      extracted_by: 'ia',
      origin_system: 'whatsapp',
      owner_user_id: ownerKey,
      confidentiality: 'P2',
      metadata_json: { subject },
    });
    return {
      success: true,
      id: decision.id,
      estado: 'propuesto',
      mensaje: 'Propuesta registrada. Requiere aprobacion humana en el Hub (Registro de decisiones) antes de ser oficial.',
    };
  }

  const claimType = TIPO_CLAIM[tipo];
  if (!claimType) {
    return { success: false, error: `Tipo invalido: ${tipo}. Usa decision, riesgo, hecho o compromiso.` };
  }

  const claim = await store.crearClaim({
    claim_type: claimType,
    statement,
    subject,
    authority_status: 'propuesto',
    temporal_status: 'futuro',
    epistemic_status: 'inferido',
    extracted_by: 'ia',
    origin_system: 'whatsapp',
    owner_user_id: ownerKey,
    confidentiality: 'P2',
  });

  return {
    success: true,
    id: claim.id,
    estado: 'propuesto',
    mensaje: 'Registro propuesto. Requiere aprobacion humana en el Hub antes de tratarse como oficial.',
  };
}
