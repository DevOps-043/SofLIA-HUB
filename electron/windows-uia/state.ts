import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIARunResult, WindowsUIAStatusSnapshot } from './types';

export function getStatusSnapshot(service: WindowsUIAServiceCore): WindowsUIAStatusSnapshot {
  return {
    status: service.status,
    currentTask: service.currentTask,
    currentStep: service.currentStep,
    maxSteps: service.currentMaxSteps,
    currentWindowTitle: service.currentWindowTitle,
    lastAction: service.lastAction,
    lastVerification: service.lastVerification,
    lastTracePath: service.lastTracePath,
    lastReportPath: service.lastReportPath,
    lastScreenshotPath: service.lastScreenshotPath,
    queuedTasks: service.queue.length,
  };
}

export function getLastRunResult(service: WindowsUIAServiceCore): WindowsUIARunResult | null {
  return service.lastRunResult ? { ...service.lastRunResult } : null;
}

export function isRunning(service: WindowsUIAServiceCore): boolean {
  return service.status !== 'idle' || service.queue.length > 0;
}

export function abortAll(service: WindowsUIAServiceCore): void {
  service.abortController?.abort();
  while (service.queue.length > 0) {
    service.queue.shift()?.reject(new Error('Tarea UIA cancelada antes de ejecutarse.'));
  }
}
