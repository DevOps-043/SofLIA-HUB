import type { DesktopActionPayload } from '../desktop-agent-types';

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
