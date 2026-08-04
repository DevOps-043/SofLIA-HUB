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
