import type { BrowserActionPayload } from './types';

export function parseBrowserAction(rawText: string): BrowserActionPayload {
  const jsonText = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: any;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`No se pudo parsear la respuesta del backend web: ${jsonText.slice(0, 240)}`);
    }
    parsed = JSON.parse(match[0]);
  }

  return {
    action: parsed.action,
    ref: typeof parsed.ref === 'string' ? parsed.ref.trim() : undefined,
    url: typeof parsed.url === 'string' ? parsed.url.trim() : undefined,
    text: typeof parsed.text === 'string' ? parsed.text : undefined,
    key: typeof parsed.key === 'string' ? parsed.key.trim() : undefined,
    direction: parsed.direction === 'up' ? 'up' : 'down',
    amount: typeof parsed.amount === 'number' ? parsed.amount : undefined,
    expected: typeof parsed.expected === 'string' ? parsed.expected.trim() : undefined,
    message: typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message.trim()
      : `Accion ${typeof parsed.action === 'string' ? parsed.action : 'desconocida'}`,
  };
}
