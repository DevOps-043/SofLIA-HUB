import type { Rectangle } from 'electron';

export const INTEGRATED_BROWSER_PARTITION = 'persist:soflia-integrated-browser';
export const INTEGRATED_BROWSER_HOME = 'https://www.google.com/';
export const INTEGRATED_BROWSER_AGENT_VIEWPORT_TIMEOUT_MS = 8_000;

export interface IntegratedBrowserState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  isVisible: boolean;
  agentControlling: boolean;
  error: string | null;
}

export interface IntegratedBrowserViewport extends Rectangle {}

export interface IntegratedBrowserResult {
  success: boolean;
  state?: IntegratedBrowserState;
  error?: string;
}

export interface IntegratedBrowserOpenInput {
  url?: string;
}

export interface IntegratedBrowserNavigateInput {
  target: string;
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
