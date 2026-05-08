import { executeAction } from './action-executor';
import { collectSnapshot } from './snapshot';
import { appendTrace, summarizeSnapshot } from './trace';
import { verifyActionOutcome } from './verification';
import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIAActionPayload, WindowsUIAHistoryEntry, WindowsUIASnapshot } from './types';

export async function executeActionStep(
  service: WindowsUIAServiceCore,
  action: WindowsUIAActionPayload,
  snapshot: WindowsUIASnapshot,
  step: number,
  tracePath: string,
): Promise<{ success: boolean; errorMessage: string; verificationMessage: string; afterSnapshot: WindowsUIASnapshot | null }> {
  let success = false;
  let errorMessage = '';
  let verificationMessage = '';
  let afterSnapshot: WindowsUIASnapshot | null = null;

  try {
    await executeAction(service, action, snapshot);
    afterSnapshot = await collectSnapshot(service);
    const verification = verifyActionOutcome(action, snapshot, afterSnapshot);
    success = verification.success;
    verificationMessage = verification.message;
    service.lastVerification = verification.message;
    if (!success) errorMessage = verification.message;
  } catch (err: any) {
    errorMessage = err.message || 'Error desconocido';
    verificationMessage = errorMessage;
    service.lastVerification = errorMessage;
  }

  appendTrace(tracePath, {
    type: 'step',
    timestamp: new Date().toISOString(),
    step,
    action,
    success,
    verification: verificationMessage || null,
    error: errorMessage || null,
    before: summarizeSnapshot(snapshot, action.elementId),
    after: afterSnapshot ? summarizeSnapshot(afterSnapshot, action.elementId) : null,
  });
  return { success, errorMessage, verificationMessage, afterSnapshot };
}

export function pushHistory(
  history: WindowsUIAHistoryEntry[],
  step: number,
  action: WindowsUIAActionPayload,
  success: boolean,
  errorMessage: string,
  verificationMessage: string,
  windowTitle: string | null,
): void {
  history.push({
    step,
    action,
    success,
    error: errorMessage || undefined,
    verification: verificationMessage || undefined,
    windowTitle: windowTitle || '',
  });
}
