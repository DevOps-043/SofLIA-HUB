/**
 * Tipos del paquete browser-web.
 *
 * Sin lógica — solo contratos. Aislados aquí para que la clase principal
 * `BrowserWebService` quede focalizada en orquestación.
 */

export type BrowserTaskStatus = 'idle' | 'executing';
export type BrowserProfileMode = 'persistent' | 'isolated';

export interface BrowserTaskOptions {
  maxSteps?: number;
  startUrl?: string;
  profileId?: string;
  isolated?: boolean;
  resetProfile?: boolean;
}

export interface BrowserQueueEntry {
  task: string;
  options?: BrowserTaskOptions;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

export interface BrowserActionPayload {
  action: 'goto' | 'click_ref' | 'fill_ref' | 'press_key' | 'scroll' | 'wait' | 'done' | 'fail';
  ref?: string;
  url?: string;
  text?: string;
  key?: string;
  direction?: 'up' | 'down';
  amount?: number;
  message: string;
  expected?: string;
}

export interface BrowserElementSnapshot {
  ref: string;
  tag: string;
  role: string;
  text: string;
  label: string;
  placeholder: string;
  type: string;
  href: string;
  value: string;
  disabled: boolean;
  checked: boolean;
}

export interface BrowserPageSnapshot {
  url: string;
  title: string;
  textExcerpt: string;
  elements: BrowserElementSnapshot[];
  screenshotBase64: string;
  scrollY: number;
  activeRef: string;
  signature: string;
}

export interface BrowserHistoryEntry {
  step: number;
  action: BrowserActionPayload;
  success: boolean;
  url: string;
  title: string;
  error?: string;
  verification?: string;
}

export interface BrowserVerificationResult {
  success: boolean;
  message: string;
}

export interface BrowserStatusSnapshot {
  status: BrowserTaskStatus;
  currentTask: string | null;
  currentStep: number;
  maxSteps: number;
  currentUrl: string | null;
  currentProfileId: string | null;
  currentProfileMode: BrowserProfileMode | null;
  lastAction: string | null;
  lastVerification: string | null;
  lastTracePath: string | null;
  lastReportPath: string | null;
  lastScreenshotPath: string | null;
  queuedTasks: number;
}

export interface BrowserTaskArtifacts {
  taskId: string;
  runDirectory: string;
  tracePath: string;
  reportPath: string;
  finalScreenshotPath: string;
}

export interface BrowserProfileDescriptor {
  id: string;
  path: string;
  exists: boolean;
  lastModifiedAt: string | null;
}
