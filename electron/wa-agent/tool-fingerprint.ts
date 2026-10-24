import { createHmac, randomBytes } from 'node:crypto';
import { stableJson } from './loop-helpers/stable-json';
import { summarizeFunctionResponses, type ToolResultEnvelope } from './loop-helpers/function-response-summary';

const keys = new WeakMap<object, Buffer>();
/** Comparación privada por turno; la clave y las firmas no se persisten. */
export function toolFingerprint(turn: object, value: unknown): string {
  let key = keys.get(turn);
  if (!key) { key = randomBytes(32); keys.set(turn, key); }
  return createHmac('sha256', key).update(stableJson(value)).digest('hex');
}
export function responseFingerprint(turn: object, results: ToolResultEnvelope[]): string {
  const summary = summarizeFunctionResponses(results);
  const observations = results.map(({ functionResponse }, index) => {
    const response = functionResponse.response;
    const relevant: Record<string, unknown> = { ...summary[index] };
    // Una referencia nueva del mismo fallo no es progreso ni cambia su identidad.
    delete relevant.correlationId;
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      for (const key of ['error', 'message', 'status', 'session_status', 'session_id', 'pid']) {
        const value = (response as Record<string, unknown>)[key];
        if (typeof value === 'string' || typeof value === 'number') relevant[key] = value;
      }
    }
    return relevant;
  });
  return toolFingerprint(turn, observations);
}
