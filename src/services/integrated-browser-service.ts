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

export interface IntegratedBrowserViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IntegratedBrowserResponse {
  success: boolean;
  state?: IntegratedBrowserState;
  error?: string;
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

export interface BrowserExtensionMetadata {
  installId: string;
  extensionId: string | null;
  name: string;
  version: string;
  permissions: string[];
  hostPermissions: string[];
  enabled: boolean;
  status: 'loaded' | 'disabled' | 'error';
  error: string | null;
}

export interface BrowserExtensionInstallPreview {
  token: string;
  name: string;
  version: string;
  permissions: string[];
  hostPermissions: string[];
}

export interface IntegratedBrowserDataResponse extends IntegratedBrowserResponse {
  history?: BrowserHistoryEntry[];
  credentials?: BrowserCredentialMetadata[];
  credential?: BrowserCredentialMetadata;
  extensions?: BrowserExtensionMetadata[];
  extension?: BrowserExtensionMetadata;
  preview?: BrowserExtensionInstallPreview;
  canceled?: boolean;
  cleared?: boolean;
  removed?: boolean;
}

export interface IntegratedBrowserCaptureResponse extends IntegratedBrowserResponse {
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

export interface IntegratedBrowserObservationResponse extends IntegratedBrowserResponse {
  observation?: BrowserObservationSnapshot | null;
  observationStatus?: BrowserObservationStatus;
}

export interface IntegratedBrowserApi {
  getState(): Promise<IntegratedBrowserResponse>;
  captureVisible(): Promise<IntegratedBrowserCaptureResponse>;
  getObservation(forceFresh?: boolean): Promise<IntegratedBrowserObservationResponse>;
  setObservationEnabled(enabled: boolean): Promise<IntegratedBrowserObservationResponse>;
  open(url?: string): Promise<IntegratedBrowserResponse>;
  navigate(target: string): Promise<IntegratedBrowserResponse>;
  createTab(url?: string): Promise<IntegratedBrowserResponse>;
  closeTab(tabId: string): Promise<IntegratedBrowserResponse>;
  activateTab(tabId: string): Promise<IntegratedBrowserResponse>;
  detachTab(tabId: string): Promise<IntegratedBrowserResponse>;
  reattachTab(tabId: string): Promise<IntegratedBrowserResponse>;
  setViewMode(mode: IntegratedBrowserViewMode, secondaryTabId?: string): Promise<IntegratedBrowserResponse>;
  goBack(): Promise<IntegratedBrowserResponse>;
  goForward(): Promise<IntegratedBrowserResponse>;
  reload(): Promise<IntegratedBrowserResponse>;
  stop(): Promise<IntegratedBrowserResponse>;
  focus(): Promise<IntegratedBrowserResponse>;
  setViewport(viewport: IntegratedBrowserViewport): Promise<IntegratedBrowserResponse>;
  hide(): Promise<IntegratedBrowserResponse>;
  listHistory(query?: string, limit?: number): Promise<IntegratedBrowserDataResponse>;
  clearHistory(): Promise<IntegratedBrowserDataResponse>;
  listCredentials(): Promise<IntegratedBrowserDataResponse>;
  saveCredential(input: { id?: string; username: string; password: string }): Promise<IntegratedBrowserDataResponse>;
  fillCredential(id: string): Promise<IntegratedBrowserDataResponse>;
  removeCredential(id: string): Promise<IntegratedBrowserDataResponse>;
  listExtensions(): Promise<IntegratedBrowserDataResponse>;
  installExtension(): Promise<IntegratedBrowserDataResponse>;
  confirmExtensionInstall(token: string): Promise<IntegratedBrowserDataResponse>;
  setExtensionEnabled(installId: string, enabled: boolean): Promise<IntegratedBrowserDataResponse>;
  removeExtension(installId: string): Promise<IntegratedBrowserDataResponse>;
  onStateChanged(callback: (state: IntegratedBrowserState) => void): () => void;
  onOpenRequested(callback: (request: { url?: string }) => void): () => void;
}

declare global {
  interface Window {
    integratedBrowser?: IntegratedBrowserApi;
  }
}

function requireApi(): IntegratedBrowserApi {
  if (!window.integratedBrowser) throw new Error('El navegador integrado no esta disponible en este entorno.');
  return window.integratedBrowser;
}

export const integratedBrowserService = {
  isAvailable: (): boolean => Boolean(window.integratedBrowser),
  getState: (): Promise<IntegratedBrowserResponse> => requireApi().getState(),
  captureVisible: (): Promise<IntegratedBrowserCaptureResponse> => requireApi().captureVisible(),
  getObservation: (forceFresh = false): Promise<IntegratedBrowserObservationResponse> => requireApi().getObservation(forceFresh),
  setObservationEnabled: (enabled: boolean): Promise<IntegratedBrowserObservationResponse> => requireApi().setObservationEnabled(enabled),
  open: (url?: string): Promise<IntegratedBrowserResponse> => requireApi().open(url),
  navigate: (target: string): Promise<IntegratedBrowserResponse> => requireApi().navigate(target),
  createTab: (url?: string): Promise<IntegratedBrowserResponse> => requireApi().createTab(url),
  closeTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().closeTab(tabId),
  activateTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().activateTab(tabId),
  detachTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().detachTab(tabId),
  reattachTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().reattachTab(tabId),
  setViewMode: (mode: IntegratedBrowserViewMode, secondaryTabId?: string): Promise<IntegratedBrowserResponse> => requireApi().setViewMode(mode, secondaryTabId),
  goBack: (): Promise<IntegratedBrowserResponse> => requireApi().goBack(),
  goForward: (): Promise<IntegratedBrowserResponse> => requireApi().goForward(),
  reload: (): Promise<IntegratedBrowserResponse> => requireApi().reload(),
  stop: (): Promise<IntegratedBrowserResponse> => requireApi().stop(),
  focus: (): Promise<IntegratedBrowserResponse> => requireApi().focus(),
  setViewport: (viewport: IntegratedBrowserViewport): Promise<IntegratedBrowserResponse> => requireApi().setViewport(viewport),
  hide: (): Promise<IntegratedBrowserResponse> => requireApi().hide(),
  listHistory: (query?: string, limit?: number): Promise<IntegratedBrowserDataResponse> => requireApi().listHistory(query, limit),
  clearHistory: (): Promise<IntegratedBrowserDataResponse> => requireApi().clearHistory(),
  listCredentials: (): Promise<IntegratedBrowserDataResponse> => requireApi().listCredentials(),
  saveCredential: (input: { id?: string; username: string; password: string }): Promise<IntegratedBrowserDataResponse> => requireApi().saveCredential(input),
  fillCredential: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().fillCredential(id),
  removeCredential: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().removeCredential(id),
  listExtensions: (): Promise<IntegratedBrowserDataResponse> => requireApi().listExtensions(),
  installExtension: (): Promise<IntegratedBrowserDataResponse> => requireApi().installExtension(),
  confirmExtensionInstall: (token: string): Promise<IntegratedBrowserDataResponse> => requireApi().confirmExtensionInstall(token),
  setExtensionEnabled: (installId: string, enabled: boolean): Promise<IntegratedBrowserDataResponse> => requireApi().setExtensionEnabled(installId, enabled),
  removeExtension: (installId: string): Promise<IntegratedBrowserDataResponse> => requireApi().removeExtension(installId),
  subscribe: (callbacks: {
    onStateChanged?: (state: IntegratedBrowserState) => void;
    onOpenRequested?: (request: { url?: string }) => void;
  }): (() => void) => {
    const api = requireApi();
    const cleanups: Array<() => void> = [];
    if (callbacks.onStateChanged) cleanups.push(api.onStateChanged(callbacks.onStateChanged));
    if (callbacks.onOpenRequested) cleanups.push(api.onOpenRequested(callbacks.onOpenRequested));
    return () => cleanups.forEach((cleanup) => cleanup());
  },
};

export const EMPTY_INTEGRATED_BROWSER_STATE: IntegratedBrowserState = {
  url: 'about:blank',
  title: 'Navegador',
  canGoBack: false,
  canGoForward: false,
  isLoading: false,
  isVisible: false,
  agentControlling: false,
  error: null,
  tabs: [],
  activeTabId: null,
  primaryTabId: null,
  secondaryTabId: null,
  viewMode: 'single',
};

export {};
