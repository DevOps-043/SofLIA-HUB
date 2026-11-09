import type { DesktopInference } from './inference';
import type { DesktopActionPayload } from '../desktop-agent-types';
import { parseDesktopActionResponse } from './parsers';

export function startContinuousObservation(input: {
  signal?: AbortSignal;
  onCycleEnd?: () => void;
  objective: string;
  reactionRules?: string;
  intervalMs: number;
  modelName: string;
  ai: DesktopInference;
  isRunning: () => boolean;
  setRunning: (running: boolean) => void;
  takeScreenshot: () => Promise<string>;
  quickHash: (base64: string) => string;
  executeAction: (action: DesktopActionPayload) => Promise<void>;
  emit: (eventName: string, payload?: unknown) => void;
  getErrorMessage: (error: unknown) => string;
}): ReturnType<typeof setInterval> {
  let lastHash = '';
  const current = () => !input.signal?.aborted;
  const interval = setInterval(async () => {
    if (!current()) return;
    if (input.isRunning()) return;
    input.setRunning(true);

    try {
      const screenshot = await input.takeScreenshot();
      if (!current()) return;
      const hash = input.quickHash(screenshot);
      if (hash === lastHash) {
        return;
      }
      lastHash = hash;

      if (!current()) return;
      const result = await input.ai(buildObservationPrompt(input.objective, input.reactionRules), {
        images: [`data:image/png;base64,${screenshot}`], json: true, signal: input.signal,
      });
      if (!current()) return;
      const action = parseDesktopActionResponse(result);

      if (action.action !== 'wait') {
        input.emit('observation-action', action);
        if (!current()) return;
        await input.executeAction(action);
      }
    } catch (error: unknown) {
      if (current()) console.warn('[DesktopAgent] No se completó el ciclo de observación.');
      void error;
    } finally {
      input.onCycleEnd?.();
      if (current()) input.setRunning(false);
    }
  }, input.intervalMs);
  input.signal?.addEventListener('abort', () => clearInterval(interval), { once: true });
  if (!current()) clearInterval(interval);
  return interval;
}

function buildObservationPrompt(objective: string, reactionRules?: string): string {
  return `MODO OBSERVACION CONTINUA.
Objetivo: ${objective}
${reactionRules ? `Reglas de reaccion:\n${reactionRules}` : ''}

Analiza la pantalla. Si necesitas actuar, responde con una accion JSON.
Si no necesitas actuar, responde: {"action": "wait", "message": "observando..."}

Formato JSON (sin markdown):
{
  "action": "click|type|key|scroll|done|wait|...",
  "x": number, "y": number,
  "text": "...", "key": "...",
  "message": "descripcion"
}`;
}
