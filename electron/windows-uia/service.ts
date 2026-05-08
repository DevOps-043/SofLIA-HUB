import { EventEmitter } from 'node:events';
import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { DesktopAgentService } from '../desktop-agent-service';
import { abortAll, getLastRunResult, getStatusSnapshot, isRunning } from './state';
import { executeQueuedTask, processQueue } from './queue';
import { executeTaskInternal } from './runner';
import type { WindowsUIAServiceCore } from './core';
import type {
  WindowsUIAQueueEntry,
  WindowsUIARunResult,
  WindowsUIAStatus,
  WindowsUIAStatusSnapshot,
  WindowsUIATaskOptions,
} from './types';

export class WindowsUIAService extends EventEmitter implements WindowsUIAServiceCore {
  apiKey = '';
  genAI: GoogleGenerativeAI | null = null;
  status: WindowsUIAStatus = 'idle';
  currentTask: string | null = null;
  currentStep = 0;
  currentMaxSteps = 0;
  currentWindowTitle: string | null = null;
  lastAction: string | null = null;
  lastVerification: string | null = null;
  lastTracePath: string | null = null;
  lastReportPath: string | null = null;
  lastScreenshotPath: string | null = null;
  lastRunResult: WindowsUIARunResult | null = null;
  abortController: AbortController | null = null;
  queue: WindowsUIAQueueEntry[] = [];

  constructor(public readonly desktopAgent: DesktopAgentService) {
    super();
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    this.genAI = null;
  }

  getStatus(): WindowsUIAStatusSnapshot {
    return getStatusSnapshot(this);
  }

  getLastRunResult(): WindowsUIARunResult | null {
    return getLastRunResult(this);
  }

  isRunning(): boolean {
    return isRunning(this);
  }

  abortAll(): void {
    abortAll(this);
  }

  executeTask(task: string, options?: WindowsUIATaskOptions): Promise<string> {
    return executeQueuedTask(this, task, options);
  }

  executeTaskInternal(task: string, options?: WindowsUIATaskOptions): Promise<string> {
    return executeTaskInternal(this, task, options);
  }

  processQueue(): void {
    processQueue(this);
  }
}
