import type { UIElement } from '../desktop-agent-types';

export type WindowsUIAStatus = 'idle' | 'executing';
export type WindowsUIAFailureCategory = 'none' | 'explicit_fail' | 'verification' | 'timeout' | 'no_elements' | 'no_window' | 'cancelled' | 'error';

export interface WindowsUIATaskOptions { maxSteps?: number }

export interface WindowsUIAQueueEntry {
  task: string;
  options?: WindowsUIATaskOptions;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

export interface WindowsUIAActionPayload {
  action: 'focus_window' | 'click_element' | 'type_in_element' | 'key' | 'scroll' | 'wait' | 'done' | 'fail';
  windowTitle?: string;
  elementId?: number;
  text?: string;
  key?: string;
  direction?: 'up' | 'down';
  amount?: number;
  expected?: string;
  message: string;
}

export interface WindowsUIASnapshot {
  currentWindowTitle: string;
  currentProcess: string;
  windows: Array<{ title: string; process: string; pid: number }>;
  elements: UIElement[];
  screenshotBase64: string;
  signature: string;
}

export interface WindowsUIAHistoryEntry {
  step: number;
  action: WindowsUIAActionPayload;
  success: boolean;
  windowTitle: string;
  error?: string;
  verification?: string;
}

export interface WindowsUIAArtifacts {
  taskId: string;
  runDirectory: string;
  reportPath: string;
  tracePath: string;
  finalScreenshotPath: string;
}

export interface WindowsUIAStatusSnapshot {
  status: WindowsUIAStatus;
  currentTask: string | null;
  currentStep: number;
  maxSteps: number;
  currentWindowTitle: string | null;
  lastAction: string | null;
  lastVerification: string | null;
  lastTracePath: string | null;
  lastReportPath: string | null;
  lastScreenshotPath: string | null;
  queuedTasks: number;
}

export interface WindowsUIARunResult {
  status: 'completed' | 'failed' | 'cancelled' | 'error';
  message: string;
  failureCategory: WindowsUIAFailureCategory;
  fallbackRecommended: boolean;
  verification: string | null;
  reportPath: string | null;
  tracePath: string | null;
  screenshotPath: string | null;
}
