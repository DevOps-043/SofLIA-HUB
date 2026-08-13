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
  /** La pagina pidio pantalla completa y la vista nativa cubre la ventana. */
  isFullscreen: boolean;
}

export const BROWSER_SITE_PERMISSION_KINDS = [
  'camera',
  'microphone',
  'geolocation',
  'notifications',
  'display-capture',
  'clipboard-read',
  'idle-detection',
  'window-management',
  'fullscreen',
  'pointer-lock',
  'keyboard-lock',
  'speaker-selection',
  'protected-media',
] as const;

export type BrowserSitePermissionKind = (typeof BROWSER_SITE_PERMISSION_KINDS)[number];
export type BrowserSitePermissionState = 'ask' | 'granted' | 'denied';

export interface BrowserSitePermissionEntry {
  kind: BrowserSitePermissionKind;
  label: string;
  state: BrowserSitePermissionState;
  requested: boolean;
}

export interface BrowserSitePermissionSummary {
  origin: string | null;
  url: string;
  secure: boolean;
  permissions: BrowserSitePermissionEntry[];
}

export interface BrowserSitePermissionResponse {
  success: boolean;
  site?: BrowserSitePermissionSummary;
  error?: string;
}

/**
 * Aviso de permiso que llega del proceso principal. Los permisos que la pagina
 * pide a la vez viajan juntos para preguntarlos en un solo globo.
 */
export interface BrowserPermissionPromptRequest {
  id: string;
  origin: string;
  kinds: BrowserSitePermissionKind[];
  /** Etiquetas legibles de `kinds`, en el mismo orden. */
  labels: string[];
}

export interface BrowserPermissionDecisionResponse {
  success: boolean;
  resolved?: boolean;
  error?: string;
}

export interface BrowserTabSummary {
  tabId: string;
  url: string;
  title: string;
  isCurrent: boolean;
  text: string;
}

export interface IntegratedBrowserTabSummariesResponse {
  success: boolean;
  summaries?: BrowserTabSummary[];
  error?: string;
}

export interface BrowserTabContentResponse {
  success: boolean;
  content?: {
    tabId: string;
    url: string;
    title: string;
    text: string;
  };
  error?: string;
}

export interface TabContextAttachment {
  tabId: string;
  url: string;
  title: string;
  text: string;
  isCurrent: boolean;
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

export const BROWSING_DATA_CATEGORIES = [
  'historial',
  'cookies',
  'cache',
  'contrasenas',
  'permisos',
] as const;

export type BrowsingDataCategory = (typeof BROWSING_DATA_CATEGORIES)[number];

export const BROWSING_DATA_RANGES = [
  'ultima-hora',
  'ultimo-dia',
  'ultima-semana',
  'ultimo-mes',
  'todo',
] as const;

export type BrowsingDataRange = (typeof BROWSING_DATA_RANGES)[number];

export interface BrowsingDataResult {
  category: BrowsingDataCategory;
  cleared: boolean;
  removed?: number;
  /** True cuando la categoría borró todo por no poder acotarse al rango. */
  ignoredRange: boolean;
  error?: string;
}

export interface BrowsingDataSummary {
  range: BrowsingDataRange;
  results: BrowsingDataResult[];
}

export interface BrowsingDataResponse extends IntegratedBrowserResponse {
  summary?: BrowsingDataSummary;
}

export interface IntegratedBrowserCaptureResponse extends IntegratedBrowserResponse {
  screenshot?: string;
  /** Rectangulo que ocupaba la vista nativa al capturar, en coordenadas de ventana. */
  captureBounds?: IntegratedBrowserViewport;
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

/**
 * Imagen de contenido de la pagina. Permite reutilizar el material grafico que
 * el usuario ya esta viendo en vez de generar uno nuevo. Refleja
 * `BrowserDomImage` de main: los iconos y pixeles de seguimiento se descartan
 * alli, antes de cruzar el IPC.
 */
export interface BrowserDomImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface BrowserDomSnapshot {
  title: string;
  url: string;
  language: string;
  text: string;
  headings: Array<{ level: number; text: string; scope: string }>;
  landmarks: Array<{ role: string; name: string; scope: string }>;
  controls: BrowserDomControl[];
  images: BrowserDomImage[];
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

export interface BrowserElementTargetSummary {
  ref: string;
  tag: string;
  role: string;
  name: string;
  type: string;
  href: string;
  disabled: boolean;
  editable: boolean;
  x: number;
  y: number;
  occluded: boolean;
}

export interface IntegratedBrowserInteractionResponse extends IntegratedBrowserResponse {
  target?: BrowserElementTargetSummary;
  warning?: string | null;
}

export interface IntegratedBrowserObservationResponse extends IntegratedBrowserResponse {
  observation?: BrowserObservationSnapshot | null;
  observationStatus?: BrowserObservationStatus;
}

export interface BrowserSelectionActionRequest {
  action: 'ask' | 'improve' | 'translate' | 'summarize';
  /** Texto seleccionado en la pagina; se adjunta al compositor, no se envia. */
  text: string;
  /** Titulo de la pestaña, para etiquetar la procedencia del adjunto. */
  title: string;
  /** Instruccion sugerida que se precarga en el campo de escritura. */
  instruction: string;
}

export interface BrowserReadingModeRequest {
  url: string;
  title: string;
  selection: string;
}

/**
 * Peticion del panel de redaccion que vive en la pagina. A diferencia de las
 * demas acciones no pasa por el chat: el renderer resuelve y devuelve el texto
 * para que la pagina lo ofrezca en su propio panel.
 */
export interface BrowserWritingRequest {
  requestId: string;
  /** Instruccion escrita por el usuario; vacia significa "mejorala sin mas". */
  prompt: string;
  /** Texto seleccionado; contenido no confiable de la pagina. */
  text: string;
  title: string;
  url: string;
}

export interface BrowserWritingResolution {
  requestId: string;
  text?: string;
  error?: string;
}

export type BrowserReadingBlockKind = 'heading' | 'paragraph' | 'list-item' | 'quote';

export interface BrowserReadingBlock {
  id: string;
  kind: BrowserReadingBlockKind;
  text: string;
  level: number | null;
  start: number;
  end: number;
}

export interface BrowserReadingContent {
  readingId: string;
  tabId: string;
  url: string;
  title: string;
  language: string;
  text: string;
  blocks: BrowserReadingBlock[];
  selectionOnly: boolean;
  truncated: boolean;
}

export interface BrowserReadingWordTiming {
  start: number;
  end: number;
  startTime: number;
  endTime: number;
}

export interface BrowserReadingSpeech {
  readingId: string;
  start: number;
  end: number;
  audioBase64: string;
  mimeType: 'audio/mpeg';
  durationSeconds: number;
  timings: BrowserReadingWordTiming[];
}

export type BrowserReadingToolbarActionName = 'toggle' | 'stop' | 'speed-down' | 'speed-up' | 'close' | 'closed';

export interface BrowserReadingToolbarAction {
  readingId: string;
  action: BrowserReadingToolbarActionName;
}

export interface BrowserReadingToolbarState {
  readingId: string;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'completed' | 'error';
  speed: number;
  message?: string;
}

export interface BrowserReadingResponse extends IntegratedBrowserResponse {
  reading?: BrowserReadingContent;
  speech?: BrowserReadingSpeech;
  toolbarAction?: BrowserReadingToolbarAction;
  toolbarVisible?: boolean;
  canceled?: boolean | number;
  highlighted?: boolean;
  closed?: boolean;
}

export interface IntegratedBrowserApi {
  getState(): Promise<IntegratedBrowserResponse>;
  captureVisible(): Promise<IntegratedBrowserCaptureResponse>;
  getObservation(forceFresh?: boolean): Promise<IntegratedBrowserObservationResponse>;
  setObservationEnabled(enabled: boolean): Promise<IntegratedBrowserObservationResponse>;
  open(url?: string): Promise<IntegratedBrowserResponse>;
  navigate(target: string): Promise<IntegratedBrowserResponse>;
  clickElement(ref: string): Promise<IntegratedBrowserInteractionResponse>;
  typeInElement(ref: string, text: string, submit?: boolean): Promise<IntegratedBrowserInteractionResponse>;
  scrollView(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<IntegratedBrowserResponse>;
  createTab(url?: string): Promise<IntegratedBrowserResponse>;
  closeTab(tabId: string): Promise<IntegratedBrowserResponse>;
  activateTab(tabId: string): Promise<IntegratedBrowserResponse>;
  detachTab(tabId: string): Promise<IntegratedBrowserResponse>;
  reattachTab(tabId: string): Promise<IntegratedBrowserResponse>;
  reorderTabs?: (sourceId: string, targetId: string) => Promise<IntegratedBrowserResponse>;
  setViewMode(mode: IntegratedBrowserViewMode, secondaryTabId?: string): Promise<IntegratedBrowserResponse>;
  goBack(): Promise<IntegratedBrowserResponse>;
  goForward(): Promise<IntegratedBrowserResponse>;
  reload(): Promise<IntegratedBrowserResponse>;
  stop(): Promise<IntegratedBrowserResponse>;
  focus(): Promise<IntegratedBrowserResponse>;
  toggleDevTools(): Promise<IntegratedBrowserResponse>;
  setViewport(viewport: { x: number; y: number; width: number; height: number }): Promise<IntegratedBrowserResponse>;
  setOverlayBounds?: (bounds: { x: number; y: number; width: number; height: number }) => Promise<IntegratedBrowserResponse>;
  setOverlayPosition?: (pos: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center') => Promise<IntegratedBrowserResponse>;
  hide(): Promise<IntegratedBrowserResponse>;
  prepareReadingMode(input?: { sourceUrl?: string; selection?: string }): Promise<BrowserReadingResponse>;
  synthesizeReadingSegment(input: { readingId: string; requestId: string; start: number; end: number }): Promise<BrowserReadingResponse>;
  highlightReadingRange(input: { readingId: string; start?: number; end?: number }): Promise<BrowserReadingResponse>;
  waitForReadingToolbarAction(input: { readingId: string }): Promise<BrowserReadingResponse>;
  syncReadingToolbar(input: BrowserReadingToolbarState): Promise<BrowserReadingResponse>;
  cancelReadingSpeech(input: { readingId: string; requestId?: string }): Promise<BrowserReadingResponse>;
  closeReadingMode(input: { readingId: string }): Promise<BrowserReadingResponse>;
  listHistory(query?: string, limit?: number): Promise<IntegratedBrowserDataResponse>;
  clearHistory(): Promise<IntegratedBrowserDataResponse>;
  clearBrowsingData(input: { categories: BrowsingDataCategory[]; range: BrowsingDataRange }): Promise<BrowsingDataResponse>;
  listCredentials(): Promise<IntegratedBrowserDataResponse>;
  saveCredential(input: { id?: string; username: string; password: string }): Promise<IntegratedBrowserDataResponse>;
  fillCredential(id: string): Promise<IntegratedBrowserDataResponse>;
  removeCredential(id: string): Promise<IntegratedBrowserDataResponse>;
  listExtensions(): Promise<IntegratedBrowserDataResponse>;
  installExtension(): Promise<IntegratedBrowserDataResponse>;
  confirmExtensionInstall(token: string): Promise<IntegratedBrowserDataResponse>;
  setExtensionEnabled(installId: string, enabled: boolean): Promise<IntegratedBrowserDataResponse>;
  removeExtension(installId: string): Promise<IntegratedBrowserDataResponse>;
  getSitePermissions(): Promise<BrowserSitePermissionResponse>;
  setSitePermission(input: {
    origin?: string;
    kind: BrowserSitePermissionKind;
    state: BrowserSitePermissionState;
  }): Promise<BrowserSitePermissionResponse>;
  resetSitePermissions(input?: { origin?: string }): Promise<BrowserSitePermissionResponse>;
  getTabSummaries(): Promise<IntegratedBrowserTabSummariesResponse>;
  getTabContent(tabId: string): Promise<BrowserTabContentResponse>;
  onStateChanged(callback: (state: IntegratedBrowserState) => void): () => void;
  onOpenRequested(callback: (request: { url?: string }) => void): () => void;
  onSelectionAction(callback: (request: BrowserSelectionActionRequest) => void): () => void;
  onReadingModeRequested(callback: (request: BrowserReadingModeRequest) => void): () => void;
  onWritingRequest(callback: (request: BrowserWritingRequest) => void): () => void;
  resolveWriting(input: BrowserWritingResolution): Promise<IntegratedBrowserResponse>;
  onSitePermissionsChanged(callback: () => void): () => void;
  decidePermissionPrompt(input: { id: string; granted: boolean }): Promise<BrowserPermissionDecisionResponse>;
  onPermissionPrompt(callback: (request: BrowserPermissionPromptRequest) => void): () => void;
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
  clickElement: (ref: string): Promise<IntegratedBrowserInteractionResponse> => requireApi().clickElement(ref),
  typeInElement: (ref: string, text: string, submit?: boolean): Promise<IntegratedBrowserInteractionResponse> =>
    requireApi().typeInElement(ref, text, submit),
  scrollView: (direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<IntegratedBrowserResponse> =>
    requireApi().scrollView(direction, amount),
  createTab: (url?: string): Promise<IntegratedBrowserResponse> => requireApi().createTab(url),
  closeTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().closeTab(tabId),
  activateTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().activateTab(tabId),
  detachTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().detachTab(tabId),
  reattachTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().reattachTab(tabId),
  reorderTabs: (sourceId: string, targetId: string): Promise<IntegratedBrowserResponse> =>
    requireApi().reorderTabs?.(sourceId, targetId) ?? Promise.resolve({ success: false }),
  setViewMode: (mode: IntegratedBrowserViewMode, secondaryTabId?: string): Promise<IntegratedBrowserResponse> => requireApi().setViewMode(mode, secondaryTabId),
  goBack: (): Promise<IntegratedBrowserResponse> => requireApi().goBack(),
  goForward: (): Promise<IntegratedBrowserResponse> => requireApi().goForward(),
  reload: (): Promise<IntegratedBrowserResponse> => requireApi().reload(),
  stop: (): Promise<IntegratedBrowserResponse> => requireApi().stop(),
  focus: (): Promise<IntegratedBrowserResponse> => requireApi().focus(),
  toggleDevTools: (): Promise<IntegratedBrowserResponse> => requireApi().toggleDevTools(),
  setViewport: (viewport: IntegratedBrowserViewport): Promise<IntegratedBrowserResponse> => requireApi().setViewport(viewport),
  setOverlayBounds: (bounds: { x: number; y: number; width: number; height: number }): Promise<IntegratedBrowserResponse> =>
    requireApi().setOverlayBounds?.(bounds) ?? Promise.resolve({ success: false }),
  setOverlayPosition: (pos: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center'): Promise<IntegratedBrowserResponse> =>
    requireApi().setOverlayPosition?.(pos) ?? Promise.resolve({ success: false }),
  hide: (): Promise<IntegratedBrowserResponse> => requireApi().hide(),
  prepareReadingMode: (input?: { sourceUrl?: string; selection?: string }): Promise<BrowserReadingResponse> => requireApi().prepareReadingMode(input),
  synthesizeReadingSegment: (input: { readingId: string; requestId: string; start: number; end: number }): Promise<BrowserReadingResponse> => requireApi().synthesizeReadingSegment(input),
  highlightReadingRange: (input: { readingId: string; start?: number; end?: number }): Promise<BrowserReadingResponse> => requireApi().highlightReadingRange(input),
  waitForReadingToolbarAction: (input: { readingId: string }): Promise<BrowserReadingResponse> => requireApi().waitForReadingToolbarAction(input),
  syncReadingToolbar: (input: BrowserReadingToolbarState): Promise<BrowserReadingResponse> => requireApi().syncReadingToolbar(input),
  cancelReadingSpeech: (input: { readingId: string; requestId?: string }): Promise<BrowserReadingResponse> => requireApi().cancelReadingSpeech(input),
  closeReadingMode: (input: { readingId: string }): Promise<BrowserReadingResponse> => requireApi().closeReadingMode(input),
  listHistory: (query?: string, limit?: number): Promise<IntegratedBrowserDataResponse> => requireApi().listHistory(query, limit),
  clearHistory: (): Promise<IntegratedBrowserDataResponse> => requireApi().clearHistory(),
  clearBrowsingData: (input: {
    categories: BrowsingDataCategory[];
    range: BrowsingDataRange;
  }): Promise<BrowsingDataResponse> => requireApi().clearBrowsingData(input),
  listCredentials: (): Promise<IntegratedBrowserDataResponse> => requireApi().listCredentials(),
  saveCredential: (input: { id?: string; username: string; password: string }): Promise<IntegratedBrowserDataResponse> => requireApi().saveCredential(input),
  fillCredential: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().fillCredential(id),
  removeCredential: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().removeCredential(id),
  listExtensions: (): Promise<IntegratedBrowserDataResponse> => requireApi().listExtensions(),
  installExtension: (): Promise<IntegratedBrowserDataResponse> => requireApi().installExtension(),
  confirmExtensionInstall: (token: string): Promise<IntegratedBrowserDataResponse> => requireApi().confirmExtensionInstall(token),
  setExtensionEnabled: (installId: string, enabled: boolean): Promise<IntegratedBrowserDataResponse> => requireApi().setExtensionEnabled(installId, enabled),
  removeExtension: (installId: string): Promise<IntegratedBrowserDataResponse> => requireApi().removeExtension(installId),
  getSitePermissions: (): Promise<BrowserSitePermissionResponse> => requireApi().getSitePermissions(),
  setSitePermission: (input: {
    origin?: string;
    kind: BrowserSitePermissionKind;
    state: BrowserSitePermissionState;
  }): Promise<BrowserSitePermissionResponse> => requireApi().setSitePermission(input),
  resetSitePermissions: (input?: { origin?: string }): Promise<BrowserSitePermissionResponse> => requireApi().resetSitePermissions(input),
  getTabSummaries: (): Promise<IntegratedBrowserTabSummariesResponse> => requireApi().getTabSummaries(),
  getTabContent: (tabId: string): Promise<BrowserTabContentResponse> => requireApi().getTabContent(tabId),
  decidePermissionPrompt: (input: { id: string; granted: boolean }): Promise<BrowserPermissionDecisionResponse> => (
    requireApi().decidePermissionPrompt(input)
  ),
  resolveWriting: (input: BrowserWritingResolution): Promise<IntegratedBrowserResponse> => requireApi().resolveWriting(input),
  subscribe: (callbacks: {
    onStateChanged?: (state: IntegratedBrowserState) => void;
    onOpenRequested?: (request: { url?: string }) => void;
    onSelectionAction?: (request: BrowserSelectionActionRequest) => void;
    onReadingModeRequested?: (request: BrowserReadingModeRequest) => void;
    onWritingRequest?: (request: BrowserWritingRequest) => void;
    onSitePermissionsChanged?: () => void;
    onPermissionPrompt?: (request: BrowserPermissionPromptRequest) => void;
  }): (() => void) => {
    const api = requireApi();
    const cleanups: Array<() => void> = [];
    if (callbacks.onStateChanged) cleanups.push(api.onStateChanged(callbacks.onStateChanged));
    if (callbacks.onOpenRequested) cleanups.push(api.onOpenRequested(callbacks.onOpenRequested));
    if (callbacks.onSelectionAction) cleanups.push(api.onSelectionAction(callbacks.onSelectionAction));
    if (callbacks.onReadingModeRequested) cleanups.push(api.onReadingModeRequested(callbacks.onReadingModeRequested));
    if (callbacks.onWritingRequest) cleanups.push(api.onWritingRequest(callbacks.onWritingRequest));
    if (callbacks.onSitePermissionsChanged) cleanups.push(api.onSitePermissionsChanged(callbacks.onSitePermissionsChanged));
    if (callbacks.onPermissionPrompt) cleanups.push(api.onPermissionPrompt(callbacks.onPermissionPrompt));
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
  isFullscreen: false,
};

export {};
