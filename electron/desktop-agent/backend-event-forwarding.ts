import type { EventEmitter } from 'node:events';

interface BackendEventForwardingOptions {
  source: EventEmitter;
  emit: (eventName: string, payload: unknown) => void;
  markTaskStarted: (payload: BackendTaskStartedPayload) => void;
  markStep: (payload: BackendStepPayload) => void;
  restoreLegacyStatus: () => void;
}

type BackendTaskStartedPayload = { task?: string | null };
type BackendStepPayload = { step?: number };

export function registerBackendEventForwarding(options: BackendEventForwardingOptions): void {
  const {
    source,
    emit,
    markTaskStarted,
    markStep,
    restoreLegacyStatus,
  } = options;

  source.on('task-queued', (payload: unknown) => {
    emit('task-queued', payload);
  });
  source.on('task-started', (payload: unknown) => {
    markTaskStarted(toTaskStartedPayload(payload));
    emit('task-started', payload);
  });
  source.on('step', (payload: unknown) => {
    markStep(toStepPayload(payload));
    emit('step', payload);
  });
  source.on('step-result', (payload: unknown) => {
    emit('step-result', payload);
  });

  const completeExternalTask = (eventName: string, payload: unknown) => {
    restoreLegacyStatus();
    emit(eventName, payload);
  };

  source.on('task-completed', (payload: unknown) => {
    completeExternalTask('task-completed', payload);
  });
  source.on('task-failed', (payload: unknown) => {
    completeExternalTask('task-failed', payload);
  });
}

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
}

function toTaskStartedPayload(payload: unknown): BackendTaskStartedPayload {
  const record = asRecord(payload);
  return { task: typeof record.task === 'string' ? record.task : null };
}

function toStepPayload(payload: unknown): BackendStepPayload {
  const record = asRecord(payload);
  return { step: typeof record.step === 'number' ? record.step : undefined };
}
