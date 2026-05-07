/**
 * Helpers puros del agentic loop de WhatsApp.
 *
 * Sin acceso a `this`, sin efectos secundarios. Cubren:
 *  - Clasificación de evidencia por tool (`getEvidenceModeFromToolCall`)
 *  - Hashing estable para detección de bucles (`stableJson`, `sortKeysDeep`)
 *  - Detección de respuestas genéricas/desviadas del modelo
 *  - Resumen compacto de function responses para el contexto del loop
 */

import { normalizeComparableText } from '../whatsapp-text';
import {
  LOCAL_EVIDENCE_TOOLS,
  LOCAL_VISUAL_EVIDENCE_TOOLS,
  REMOTE_EVIDENCE_TOOLS,
} from './constants';
import type { EvidenceMode } from './types';

/**
 * Clasifica una function call por el tipo de evidencia que produce.
 * Caso especial: `use_computer` puede ser local-visual o remote según el
 * backend (browser → remote, desktop/uia → local-visual).
 */
export function getEvidenceModeFromToolCall(
  functionCall: { name?: string; args?: Record<string, any> },
): EvidenceMode {
  const toolName = functionCall.name || '';

  if (REMOTE_EVIDENCE_TOOLS.has(toolName)) {
    return 'remote';
  }

  if (toolName === 'use_computer') {
    const backend = String(functionCall.args?.backend || '').toLowerCase();
    const urlLikeArg = String(functionCall.args?.start_url || functionCall.args?.url || '').toLowerCase();
    if (backend === 'browser' || urlLikeArg.length > 0) {
      return 'remote';
    }
    return 'local_visual';
  }

  if (LOCAL_VISUAL_EVIDENCE_TOOLS.has(toolName)) {
    return 'local_visual';
  }

  if (LOCAL_EVIDENCE_TOOLS.has(toolName)) {
    return 'local';
  }

  return 'neutral';
}

/**
 * Ordena recursivamente las keys de un objeto. Necesario para producir un
 * hash JSON estable que no dependa del orden de inserción de propiedades.
 */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((a, b) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

/**
 * JSON.stringify con keys ordenadas. Usado para comparar function calls
 * entre iteraciones del loop guard sin que un cambio de orden de args
 * cause falsos negativos.
 */
export function stableJson(value: unknown): string {
  try {
    return JSON.stringify(sortKeysDeep(value));
  } catch {
    return String(value);
  }
}

/**
 * Detecta si la respuesta del modelo es un saludo/intro genérico
 * ("Hola, soy SofLIA, ¿en qué puedo ayudarte?") en lugar de una respuesta
 * útil. Cuando esto ocurre tras tools, es señal de que el modelo "se
 * confundió" y abortó la cadena.
 */
export function isGenericHelpResponse(text: string): boolean {
  const normalized = normalizeComparableText(text)
    .replace(/[!?.,¿¡]/g, '')
    .trim();
  return /^(hola )?(soy soflia )?(en que|como) puedo ayudarte( hoy)?$/.test(normalized);
}

/**
 * Detecta si el modelo prometió hacer algo en el futuro ("voy a buscar...",
 * "déjame revisar...") en lugar de actuar. Estas respuestas son
 * típicamente seguidas por silencio si el modelo no llama a la tool.
 */
export function isExecutionDeferralResponse(text: string): boolean {
  const normalized = normalizeComparableText(text);
  return /\b(voy a|hare|realizare|procedere|buscare|investigare|revisare|consultare|analizare|dame un momento|espera un momento|permiteme|me pongo a|voy a realizar una busqueda|voy a buscar|voy a investigar|voy a revisar|voy a analizar)\b/.test(
    normalized,
  );
}

/** Detecta saludos o pedidos de ayuda al inicio del mensaje del usuario. */
export function isGreetingOrHelpRequest(text: string): boolean {
  const normalized = normalizeComparableText(text);
  return /^(hola|buenos dias|buenas tardes|buenas noches|hey|que puedes hacer|como puedes ayudarme|ayuda|help|menu|comandos|que haces)\b/.test(
    normalized,
  );
}

/**
 * Reduce las function responses a un payload compacto para reinyectar
 * en el contexto del modelo sin gastar tokens en el resultado completo.
 * Solo conserva campos clave para que el modelo entienda éxito/error.
 */
export function summarizeFunctionResponses(
  functionResponses: Array<{ functionResponse: { name: string; response: any } }>,
): Array<Record<string, any>> {
  return functionResponses.map(({ functionResponse }) => {
    const response = functionResponse.response || {};
    const summary: Record<string, any> = {
      name: functionResponse.name,
    };

    if (typeof response.success === 'boolean') summary.success = response.success;
    if (typeof response.error === 'string') summary.error = response.error;
    if (typeof response.message === 'string') summary.message = response.message;
    if (typeof response.status === 'string') summary.status = response.status;
    if (typeof response.session_status === 'string') summary.session_status = response.session_status;
    if (typeof response.count === 'number') summary.count = response.count;
    if (typeof response.pid === 'number') summary.pid = response.pid;
    if (typeof response.session_id === 'string') summary.session_id = response.session_id;

    return summary;
  });
}
