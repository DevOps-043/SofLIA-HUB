import type { DesktopInference } from './inference';
import { startContinuousObservation } from './observation-runtime';
import type { DesktopActionPayload } from '../desktop-agent-types';

export function startDesktopAgentObservation(params: {
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
  console.log(`[DesktopAgent] Modo observacion: "${params.objective}"`);
  params.emit('observation-started', { objective: params.objective });
  return startContinuousObservation({
    signal: params.signal,
    onCycleEnd: params.onCycleEnd,
    objective: params.objective,
    reactionRules: params.reactionRules,
    intervalMs: params.intervalMs,
    modelName: params.modelName,
    ai: params.ai,
    isRunning: params.isRunning,
    setRunning: params.setRunning,
    takeScreenshot: params.takeScreenshot,
    quickHash: params.quickHash,
    executeAction: params.executeAction,
    emit: params.emit,
    getErrorMessage: params.getErrorMessage,
  });
}

export function stopDesktopAgentObservation(params: {
  observationInterval: ReturnType<typeof setInterval> | null;
  setIntervalRef: (interval: ReturnType<typeof setInterval> | null) => void;
  setRunning: (running: boolean) => void;
  setStatusIdle: () => void;
  emit: (eventName: string) => void;
}): void {
  if (params.observationInterval) {
    clearInterval(params.observationInterval);
    params.setIntervalRef(null);
  }
  params.setRunning(false);
  params.setStatusIdle();
  params.emit('observation-stopped');
  console.log('[DesktopAgent] Observacion detenida.');
}
