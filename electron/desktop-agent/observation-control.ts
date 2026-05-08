import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { DesktopActionPayload, DesktopAgentConfig } from '../desktop-agent-types';
import { getErrorMessage } from './error-utils';
import {
  startDesktopAgentObservation,
  stopDesktopAgentObservation,
} from './observation-api';

type ObservationIntervalRef = ReturnType<typeof setInterval> | null;

export function startContinuousDesktopObservation(input: {
  currentInterval: ObservationIntervalRef;
  stopObservation: () => void;
  apiKey: string;
  objective: string;
  reactionRules?: string;
  config: DesktopAgentConfig;
  ai: GoogleGenerativeAI;
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
  if (!input.apiKey) throw new Error('API key de Gemini no configurada.');

  input.setStatusObserving();
  input.calculateScreenScale();
  return startDesktopAgentObservation({
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
