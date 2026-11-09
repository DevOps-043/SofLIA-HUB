import { assertBackendTaskActive, runBackendTaskStage } from '../desktop-agent/task-cancellation';
import { generateSessionText } from '../ai-provider/text';
import { parseAction } from './parse-action';
import { buildPrompt } from './prompt';
import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIAActionPayload, WindowsUIAHistoryEntry, WindowsUIASnapshot } from './types';

export async function decideNextAction(
  _service: WindowsUIAServiceCore,
  task: string,
  snapshot: WindowsUIASnapshot,
  history: WindowsUIAHistoryEntry[],
  signal?: AbortSignal,
): Promise<WindowsUIAActionPayload> {
  const prompt = buildPrompt(task, snapshot, history);
  assertBackendTaskActive(signal);
  let text: string;
  try { text = await runBackendTaskStage(signal, () => generateSessionText(prompt, {
    json: true, signal, images: snapshot.screenshotBase64 ? [`data:image/png;base64,${snapshot.screenshotBase64}`] : [],
  })); } finally { assertBackendTaskActive(signal); }
  return parseAction(text);
}
