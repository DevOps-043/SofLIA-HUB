import type { WindowsUIAActionPayload } from './types';

export function parseAction(rawText: string): WindowsUIAActionPayload {
  const jsonText = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`No se pudo parsear la respuesta windows_uia: ${jsonText.slice(0, 240)}`);
    parsed = JSON.parse(match[0]);
  }

  return {
    action: parsed.action,
    windowTitle: typeof parsed.windowTitle === 'string' ? parsed.windowTitle.trim() : undefined,
    elementId: typeof parsed.elementId === 'number' ? parsed.elementId : undefined,
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
