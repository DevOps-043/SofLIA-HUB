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

export interface IntegratedBrowserDataResponse extends IntegratedBrowserResponse {
  history?: BrowserHistoryEntry[];
  credentials?: BrowserCredentialMetadata[];
  credential?: BrowserCredentialMetadata;
  extensions?: BrowserExtensionMetadata[];
  extension?: BrowserExtensionMetadata;
  canceled?: boolean;
  cleared?: boolean;
  removed?: boolean;
}

export interface IntegratedBrowserApi {
  getState(): Promise<IntegratedBrowserResponse>;
  open(url?: string): Promise<IntegratedBrowserResponse>;
  navigate(target: string): Promise<IntegratedBrowserResponse>;
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
  open: (url?: string): Promise<IntegratedBrowserResponse> => requireApi().open(url),
  navigate: (target: string): Promise<IntegratedBrowserResponse> => requireApi().navigate(target),
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
};

export {};
