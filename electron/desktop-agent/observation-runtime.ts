import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { DesktopActionPayload } from '../desktop-agent-types';
import { parseDesktopActionResponse } from './parsers';

type VisionContentPart = { inlineData: { mimeType: 'image/png'; data: string } } | { text: string };

export function startContinuousObservation(input: {
  objective: string;
  reactionRules?: string;
  intervalMs: number;
  modelName: string;
  ai: GoogleGenerativeAI;
  isRunning: () => boolean;
  setRunning: (running: boolean) => void;
  takeScreenshot: () => Promise<string>;
  quickHash: (base64: string) => string;
  executeAction: (action: DesktopActionPayload) => Promise<void>;
  emit: (eventName: string, payload?: unknown) => void;
  getErrorMessage: (error: unknown) => string;
}): ReturnType<typeof setInterval> {
  let lastHash = '';
  return setInterval(async () => {
    if (input.isRunning()) return;
    input.setRunning(true);

    try {
      const screenshot = await input.takeScreenshot();
      const hash = input.quickHash(screenshot);
      if (hash === lastHash) {
        input.setRunning(false);
        return;
      }
      lastHash = hash;

      const model = input.ai.getGenerativeModel({ model: input.modelName });
      const parts: VisionContentPart[] = [
        { inlineData: { mimeType: 'image/png', data: screenshot } },
        { text: buildObservationPrompt(input.objective, input.reactionRules) },
      ];
      const result = await model.generateContent(parts);
      const action = parseDesktopActionResponse(result.response.text());

      if (action.action !== 'wait') {
        input.emit('observation-action', action);
        await input.executeAction(action);
      }
    } catch (error: unknown) {
      console.error('[DesktopAgent] Error en observacion:', input.getErrorMessage(error));
    } finally {
      input.setRunning(false);
    }
  }, input.intervalMs);
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
