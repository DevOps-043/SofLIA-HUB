import type { DesktopInference } from './inference';
import type { DesktopActionPayload, DesktopAgentConfig } from '../desktop-agent-types';
import { getErrorMessage } from './error-utils';
import {
  startDesktopAgentObservation,
  stopDesktopAgentObservation,
} from './observation-api';

type ObservationIntervalRef = ReturnType<typeof setInterval> | null;

export function startContinuousDesktopObservation(input: {
  signal?: AbortSignal;
  onCycleEnd?: () => void;
  currentInterval: ObservationIntervalRef;
  stopObservation: () => void;
  objective: string;
  reactionRules?: string;
  config: DesktopAgentConfig;
  ai: DesktopInference;
  isRunning: () => boolean;
  setRunning: (running: boolean) => void;
  setStatusObserving: () => void;
  calculateScreenScale: () => void;
  takeScreenshot: () => Promise<string>;
  quickHash: (base64: string) => string;
  executeAction: (action: DesktopActionPayload) => Promise<void>;
  emit: (eventName: string, payload?: unknown) => void;
}): ObservationIntervalRef {
  if (input.currentInterval) input.stopObservation();

  input.setStatusObserving();
  input.calculateScreenScale();
  return startDesktopAgentObservation({
    signal: input.signal,
    onCycleEnd: input.onCycleEnd,
    objective: input.objective,
    reactionRules: input.reactionRules,
    intervalMs: input.config.continuousObservationInterval,
    modelName: input.config.model,
    ai: input.ai,
    isRunning: input.isRunning,
    setRunning: input.setRunning,
    takeScreenshot: input.takeScreenshot,
    quickHash: input.quickHash,
    executeAction: input.executeAction,
    emit: input.emit,
    getErrorMessage,
  });
}

export function stopContinuousDesktopObservation(input: {
  observationInterval: ObservationIntervalRef;
  setIntervalRef: (interval: ObservationIntervalRef) => void;
  setRunning: (running: boolean) => void;
  setStatusIdle: () => void;
  emit: (eventName: string) => void;
}): void {
  stopDesktopAgentObservation(input);
}
