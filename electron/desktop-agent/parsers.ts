import type { DesktopActionPayload } from '../desktop-agent-types';
import { isKnownDesktopAction } from './action-types';

export function parseVisionResponse(text: string): DesktopActionPayload {
  const jsonStr = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`No se pudo parsear la respuesta del LLM: ${jsonStr.slice(0, 200)}`);
  }
}

/**
 * Igual que parseVisionResponse pero valida que la accion exista en el
 * contrato antes de ejecutarla. Usar solo para respuestas de pasos de vision;
 * los planes/estrategias reutilizan parseVisionResponse como parser generico.
 */
export function parseDesktopActionResponse(text: string): DesktopActionPayload {
  const payload = parseVisionResponse(text);
  if (!isKnownDesktopAction(payload?.action)) {
    throw new Error(`El LLM devolvio una accion desconocida: "${String(payload?.action)}". No se ejecuta.`);
  }
  return payload;
}
