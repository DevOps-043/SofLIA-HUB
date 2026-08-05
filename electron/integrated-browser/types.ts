import type { Rectangle } from 'electron';

export const INTEGRATED_BROWSER_PARTITION = 'persist:soflia-integrated-browser';
export const INTEGRATED_BROWSER_HOME = 'https://www.google.com/';
export const INTEGRATED_BROWSER_AGENT_VIEWPORT_TIMEOUT_MS = 8_000;
export const INTEGRATED_BROWSER_MAX_TABS = 500;
export const INTEGRATED_BROWSER_MAX_LIVE_TABS = 8;
export const INTEGRATED_BROWSER_MAX_DETACHED_WINDOWS = 4;
export const INTEGRATED_BROWSER_OBSERVATION_INTERVAL_MS = 10_000;
export const INTEGRATED_BROWSER_OBSERVATION_IDLE_MS = 4_000;
export const INTEGRATED_BROWSER_OBSERVATION_MAX_EDGE = 1_024;

export type IntegratedBrowserViewMode = 'single' | 'split' | 'overlay';

export interface IntegratedBrowserTabState {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  error: string | null;
  isSuspended: boolean;
  isDetached: boolean;
}

export interface IntegratedBrowserState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  isVisible: boolean;
  agentControlling: boolean;
  error: string | null;
  tabs: IntegratedBrowserTabState[];
  activeTabId: string | null;
  primaryTabId: string | null;
  secondaryTabId: string | null;
  viewMode: IntegratedBrowserViewMode;
}

export interface IntegratedBrowserViewport extends Rectangle {}

export interface IntegratedBrowserResult {
  success: boolean;
  state?: IntegratedBrowserState;
  error?: string;
}

export interface IntegratedBrowserCaptureResult extends IntegratedBrowserResult {
  screenshot?: string;
}

export interface BrowserDomControl {
  ref: string;
  tag: string;
  role: string;
  name: string;
  text: string;
  type: string;
  href: string;
  disabled: boolean;
  checked: boolean | null;
  rect: { x: number; y: number; width: number; height: number };
  scope: string;
}

export interface BrowserDomSnapshot {
  title: string;
  url: string;
  language: string;
  text: string;
  headings: Array<{ level: number; text: string; scope: string }>;
  landmarks: Array<{ role: string; name: string; scope: string }>;
  controls: BrowserDomControl[];
  frames: Array<{ title: string; url: string; accessible: boolean }>;
  viewport: { width: number; height: number; scrollX: number; scrollY: number; documentWidth: number; documentHeight: number };
  truncated: boolean;
}

export interface BrowserObservationSnapshot {
  id: string;
  sequence: number;
  capturedAt: string;
  tabId: string;
  screenshot: string;
  dom: BrowserDomSnapshot;
}

export interface BrowserObservationStatus {
  enabled: boolean;
  capturing: boolean;
  intervalMs: number;
  lastCapturedAt: string | null;
  lastError: string | null;
}

export interface IntegratedBrowserObservationResult extends IntegratedBrowserResult {
  observation?: BrowserObservationSnapshot | null;
  observationStatus?: BrowserObservationStatus;
}

export interface IntegratedBrowserOpenInput {
  url?: string;
}

export interface IntegratedBrowserNavigateInput {
  target: string;
}

export interface IntegratedBrowserTabInput {
  tabId: string;
}

export interface IntegratedBrowserViewModeInput {
  mode: IntegratedBrowserViewMode;
  secondaryTabId?: string;
}

export interface BrowserHistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: string;
}

export interface BrowserCredentialMetadata {
  id: string;
  origin: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrowserCredentialSaveInput {
  id?: string;
  username: string;
  password: string;
}

export type BrowserExtensionStatus = 'loaded' | 'disabled' | 'error';

export interface BrowserExtensionMetadata {
  installId: string;
  extensionId: string | null;
  name: string;
  version: string;
  permissions: string[];
  hostPermissions: string[];
  enabled: boolean;
  status: BrowserExtensionStatus;
  error: string | null;
}

export interface BrowserExtensionInstallPreview {
  token: string;
  name: string;
  version: string;
  permissions: string[];
  hostPermissions: string[];
}
