import { DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL } from './constants';
import { getGenAI } from './ai';
import { parseAction } from './parse-action';
import { buildPrompt } from './prompt';
import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIAActionPayload, WindowsUIAHistoryEntry, WindowsUIASnapshot } from './types';

export async function decideNextAction(
  service: WindowsUIAServiceCore,
  task: string,
  snapshot: WindowsUIASnapshot,
  history: WindowsUIAHistoryEntry[],
): Promise<WindowsUIAActionPayload> {
  const prompt = buildPrompt(task, snapshot, history);
  const ai = getGenAI(service);

  for (const modelId of [DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]) {
    try {
      const model = ai.getGenerativeModel({ model: modelId });
      const parts: any[] = [];
      if (snapshot.screenshotBase64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: snapshot.screenshotBase64 } });
      }
      parts.push({ text: prompt });
      const result = await model.generateContent(parts);
      return parseAction(result.response.text());
    } catch (err: any) {
      if (modelId === DEFAULT_FALLBACK_MODEL) throw err;
    }
  }

  throw new Error('No se pudo obtener una accion del modelo para windows_uia.');
}
