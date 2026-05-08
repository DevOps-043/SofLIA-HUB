import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { WindowsUIAQueueEntry, WindowsUIARunResult, WindowsUIAStatus, WindowsUIATaskOptions } from './types';

export interface WindowsUIAServiceCore {
  desktopAgent: DesktopAgentService;
  apiKey: string;
  genAI: GoogleGenerativeAI | null;
  status: WindowsUIAStatus;
  currentTask: string | null;
  currentStep: number;
  currentMaxSteps: number;
  currentWindowTitle: string | null;
  lastAction: string | null;
  lastVerification: string | null;
  lastTracePath: string | null;
  lastReportPath: string | null;
  lastScreenshotPath: string | null;
  lastRunResult: WindowsUIARunResult | null;
  abortController: AbortController | null;
  queue: WindowsUIAQueueEntry[];
  emit(eventName: string, ...args: any[]): boolean;
  executeTaskInternal(task: string, options?: WindowsUIATaskOptions): Promise<string>;
  processQueue(): void;
}
