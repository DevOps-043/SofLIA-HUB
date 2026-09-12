import type { BrowserShortcutRequest, BrowserShortcutResponse } from '../shared/browser-agent-shortcuts';
import type { BrowserPolicyRecoveryRequest, BrowserPolicyRecoveryResponse } from '../shared/browser-policy-recovery';
import type { BrowserExtensionCatalogRequest, BrowserExtensionCatalogEntry } from '../shared/browser-extension-catalog';
import type { BrowserSemanticRequest, BrowserSemanticResponse } from '../shared/browser-semantic-memory';
import type { BrowserCredentialSessionRequest, BrowserCredentialSessionResponse } from '../shared/browser-credential-session';
import type { BrowserSensitiveHandoff } from '../shared/browser-sensitive-handoff';
import type { BrowserAgentTaskState, BrowserAgentControlRequest, BrowserAgentControlResponse } from '../shared/browser-agent-control';
export type IntegratedBrowserViewMode = 'single' | 'split' | 'overlay';
export type BrowserAuditRequest = { action: 'list'; offset: number } | { action: 'clear' } | { action: 'retention'; days: 7 | 30 | 90 };
export interface BrowserAuditPage {
  entries: Array<{ id: string; traceId: string; tab: string; origin: string | null; at: number; operation: string; result: string; confirmation: 'none' | 'accepted' | 'rejected' }>;
  total: number; offset: number; retentionDays: number;
}
export interface BrowserSyncDeviceStatus {
  enabled: boolean;
  state: 'disabled' | 'inactive' | 'registered';
  message: string;
  canceled?: boolean;
  devices: Array<{ id: string; label: string; current: boolean; createdAt: string; revokedAt: string | null }>;
}
export interface BrowserSyncDevicesResponse { success: boolean; error?: string; syncDevices?: BrowserSyncDeviceStatus; canceled?: boolean }

export interface BrowserRecentlyClosedTab { id: string; url: string; title: string; closedAt: string }
export interface BrowserHistoryRetention { days: number | null; managed: boolean; removed?: number }
export type BrowserProfileKind = 'authenticated' | 'guest' | 'private';
export interface BrowserProfileDescriptor { id: string; kind: BrowserProfileKind; label: string; persistent: boolean; managed: boolean }

export interface BrowserNavigationSafetyVerdict {
  action: 'allow' | 'warn' | 'block';
  source: 'local' | 'remote' | 'degraded';
  reason: string | null;
  checkedAt: string;
}

export interface IntegratedBrowserTabState {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  error: string | null;
  /** Opcional para compatibilidad con versiones anteriores de main. */
  navigationSafety?: BrowserNavigationSafetyVerdict | null;
  sensitiveHandoff?: BrowserSensitiveHandoff | null;
  isSuspended: boolean;
  isDetached: boolean;
  /** Opcionales durante la transición desde builds anteriores del proceso main. */
  muted?: boolean;
  zoomFactor?: number;
  find?: BrowserFindState | null;
  pinned?: boolean;
  groupId?: string | null;
  position?: number;
}

export type BrowserTabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan';
export interface BrowserTabGroup { id: string; name: string; color: BrowserTabGroupColor; collapsed: boolean }

export interface BrowserFindState {
  query: string;
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
}

export interface IntegratedBrowserState {
  profileRevision?: number;
  credentialUnlocked?: boolean;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  isVisible: boolean;
  agentControlling: boolean;
  agentTask?: BrowserAgentTaskState | null;
  agentPolicyPromptIds?: string[];
  error: string | null;
  tabs: IntegratedBrowserTabState[];
  activeTabId: string | null;
  primaryTabId: string | null;
  secondaryTabId: string | null;
  viewMode: IntegratedBrowserViewMode;
  /** La pagina pidio pantalla completa y la vista nativa cubre la ventana. */
  isFullscreen: boolean;
  tabLayout?: 'horizontal' | 'vertical';
  groups?: BrowserTabGroup[];
  canReopenClosedTab?: boolean;
  restoreAvailable?: { tabCount: number; savedAt: string; cleanExit: boolean } | null;
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
  documentToken?: string;
  tabId: string;
  url: string;
  title: string;
  isCurrent: boolean;
  text: string;
}

export interface IntegratedBrowserTabSummariesResponse {
  state?: IntegratedBrowserState;
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
  expected?: import('../shared/browser-tab-context').BrowserTabExpectation;
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

export type BrowserAgentPolicyMode = 'strict' | 'balanced';
export type BrowserAgentSiteDecision = 'ask' | 'allow-once' | 'allow-always' | 'block';
export type BrowserAgentCapability = 'observe-dom' | 'capture' | 'read-document' | 'act';
export interface BrowserAgentSitePolicy {
  enabled?: boolean;
  origin: string;
  mode: BrowserAgentPolicyMode;
  decision: BrowserAgentSiteDecision;
  managed: boolean;
  updatedAt: string;
}
export interface BrowserAgentPolicyPromptRequest {
  id: string;
  origin: string;
  capability: BrowserAgentCapability;
  label: string;
}
export type BrowserPrivacyLevel = 'off' | 'balanced' | 'strict';
export type BrowserPrivacyCategory = 'tracker' | 'advertising' | 'third-party-cookie' | 'tracking-parameter' | 'fingerprinting' | 'malware';
export interface BrowserPrivacySiteState {
  enabled?: boolean;
  managed?: boolean;
  origin: string;
  level: BrowserPrivacyLevel;
  blocked: Partial<Record<BrowserPrivacyCategory, number>>;
  exceptionCategories: BrowserPrivacyCategory[];
  degraded: boolean;
}

export interface BrowserRuntimeDiagnostic {
  appVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  nodeVersion: string;
  profileKind: 'authenticated' | 'guest' | 'private';
  protectionLevel: 'off' | 'balanced' | 'strict';
  managed: boolean;
  enterprisePolicyStatus?: 'disabled' | 'loading' | 'ready' | 'error';
  checkedAt: string;
}

export interface BrowserRuntimeDiagnosticResponse extends IntegratedBrowserResponse {
  diagnostic?: BrowserRuntimeDiagnostic;
}

export interface BrowserDiagnosticExportResponse extends IntegratedBrowserResponse {
  diagnosticExport?: { cancelled: boolean; exported: boolean };
}

export interface BrowserPageToolResponse extends IntegratedBrowserResponse {
  canceled?: boolean;
  filename?: string;
}

export interface BrowserHistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: string;
}

export interface BrowserBookmark {
  id: string;
  url: string;
  title: string;
  folderId: string | null;
  tags: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrowserBookmarkTransfer {
  cancelled: boolean;
  imported?: number;
  updated?: number;
  duplicates?: number;
  invalid?: number;
  skipped?: number;
  exported?: number;
}

export interface BrowserHistoryTransfer {
  cancelled: boolean;
  imported?: number;
  skipped?: number;
  duplicates?: number;
  invalid?: number;
}

export type BrowserDownloadState = 'pending' | 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted' | 'blocked';
export interface BrowserDownloadRecord {
  id: string;
  filename: string;
  origin: string;
  receivedBytes: number;
  totalBytes: number;
  progress: number | null;
  state: BrowserDownloadState;
  canResume: boolean;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface BrowserCredentialMetadata {
  id: string;
  origin: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrowserCredentialHealth {
  id: string;
  weak: boolean;
  reused: boolean;
  reasons: string[];
}

export interface BrowserExtensionMetadata {
  catalogId?: string;
  catalogRevision?: string;
  siteAccess?: string[];
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
  catalogName?: string;
  updateName?: string;
  token: string;
  name: string;
  version: string;
  permissions: string[];
  hostPermissions: string[];
}

export interface IntegratedBrowserDataResponse extends IntegratedBrowserResponse {
  catalog?: BrowserExtensionCatalogEntry[];
  recentlyClosedTabs?: BrowserRecentlyClosedTab[];
  historyRetention?: BrowserHistoryRetention;
  history?: BrowserHistoryEntry[];
  historyTransfer?: BrowserHistoryTransfer;
  profile?: BrowserProfileDescriptor;
  bookmarks?: BrowserBookmark[];
  bookmark?: BrowserBookmark;
  bookmarkTransfer?: BrowserBookmarkTransfer;
  bookmarkRecovery?: { cancelled: boolean; restored: number };
  agentPolicy?: BrowserAgentSitePolicy;
  audit?: BrowserAuditPage;
  auditChange?: { cancelled: boolean };
  privacySite?: BrowserPrivacySiteState;
  migration?: { imported: number; skipped: number };
  credentials?: BrowserCredentialMetadata[];
  credentialAutosaveEnabled?: boolean;
  credentialRecovery?: { cancelled: boolean; restored: number };
  credentialOrigin?: string;
  credential?: BrowserCredentialMetadata;
  credentialHealth?: BrowserCredentialHealth[];
  imported?: number;
  updated?: number;
  skipped?: number;
  exported?: number;
  cancelled?: boolean;
  extensions?: BrowserExtensionMetadata[];
  extension?: BrowserExtensionMetadata;
  preview?: BrowserExtensionInstallPreview;
  canceled?: boolean;
  cleared?: boolean;
  removed?: boolean;
  downloads?: BrowserDownloadRecord[];
  download?: BrowserDownloadRecord;
  opened?: boolean;
  revealed?: boolean;
  group?: BrowserTabGroup;
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

export interface BrowserDocumentContent {
  tabId: string;
  url: string;
  title: string;
  language: string;
  text: string;
  truncated: boolean;
}

export interface BrowserDocumentResponse extends IntegratedBrowserResponse {
  document?: BrowserDocumentContent;
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

export type { BrowserSyncControlStatus, BrowserSyncControlRequest, BrowserSyncCategory } from '../../electron/integrated-browser/platform-types';
import type { BrowserSyncControlStatus, BrowserSyncControlRequest } from '../../electron/integrated-browser/platform-types';
export interface BrowserSyncControlResponse extends IntegratedBrowserResponse { sync?: BrowserSyncControlStatus }

export interface IntegratedBrowserApi {
  getState(): Promise<IntegratedBrowserResponse>;
  getRuntimeDiagnostic(): Promise<BrowserRuntimeDiagnosticResponse>;
  getSyncDevices(): Promise<BrowserSyncDevicesResponse>;
  registerSyncDevice(): Promise<BrowserSyncDevicesResponse>;
  revokeSyncDevice(id: string): Promise<BrowserSyncDevicesResponse>;
  cancelSyncOperation(): Promise<BrowserSyncDevicesResponse>;
  controlSync(input: BrowserSyncControlRequest): Promise<BrowserSyncControlResponse>;
  exportRuntimeDiagnostic(): Promise<BrowserDiagnosticExportResponse>;
  restorePreviousSession(): Promise<IntegratedBrowserResponse>;
  discardPreviousSession(): Promise<IntegratedBrowserResponse>;
  captureVisible(): Promise<IntegratedBrowserCaptureResponse>;
  getObservation(forceFresh?: boolean): Promise<IntegratedBrowserObservationResponse>;
  setObservationEnabled(enabled: boolean): Promise<IntegratedBrowserObservationResponse>;
  open(url?: string): Promise<IntegratedBrowserResponse>;
  navigate(target: string): Promise<IntegratedBrowserResponse>;
  findInPage(query: string, forward?: boolean): Promise<IntegratedBrowserResponse>;
  stopFindInPage(): Promise<IntegratedBrowserResponse>;
  setZoom(action: 'in' | 'out' | 'reset'): Promise<IntegratedBrowserResponse>;
  setMuted(muted: boolean): Promise<IntegratedBrowserResponse>;
  toggleFullscreen(): Promise<IntegratedBrowserResponse>;
  printPage(): Promise<IntegratedBrowserResponse>;
  savePageAsPdf(): Promise<BrowserPageToolResponse>;
  listDownloads(): Promise<IntegratedBrowserDataResponse>;
  cancelDownload(id: string): Promise<IntegratedBrowserDataResponse>;
  resumeDownload(id: string): Promise<IntegratedBrowserDataResponse>;
  retryDownload(id: string): Promise<IntegratedBrowserDataResponse>;
  openDownload(id: string): Promise<IntegratedBrowserDataResponse>;
  revealDownload(id: string): Promise<IntegratedBrowserDataResponse>;
  clickElement(ref: string): Promise<IntegratedBrowserInteractionResponse>;
  typeInElement(ref: string, text: string, submit?: boolean): Promise<IntegratedBrowserInteractionResponse>;
  scrollView(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<IntegratedBrowserResponse>;
  createTab(url?: string): Promise<IntegratedBrowserResponse>;
  closeTab(tabId: string): Promise<IntegratedBrowserResponse>;
  duplicateTab(tabId: string): Promise<IntegratedBrowserResponse>;
  reopenClosedTab(tabId?: string): Promise<IntegratedBrowserResponse>;
  listRecentlyClosedTabs(): Promise<IntegratedBrowserDataResponse>;
  getHistoryRetention(): Promise<IntegratedBrowserDataResponse>;
  setHistoryRetention(days: number | null): Promise<IntegratedBrowserDataResponse>;
  closeOtherTabs(tabId: string): Promise<IntegratedBrowserResponse>;
  closeTabsToRight(tabId: string): Promise<IntegratedBrowserResponse>;
  setTabPinned(tabId: string, pinned: boolean): Promise<IntegratedBrowserResponse>;
  setTabLayout(layout: 'horizontal' | 'vertical'): Promise<IntegratedBrowserResponse>;
  createTabGroup(name: string, color: BrowserTabGroupColor): Promise<IntegratedBrowserDataResponse>;
  assignTabGroup(tabId: string, groupId: string | null): Promise<IntegratedBrowserResponse>;
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
  readActiveDocument(): Promise<BrowserDocumentResponse>;
  prepareReadingMode(input?: { sourceUrl?: string; selection?: string }): Promise<BrowserReadingResponse>;
  synthesizeReadingSegment(input: { readingId: string; requestId: string; start: number; end: number }): Promise<BrowserReadingResponse>;
  highlightReadingRange(input: { readingId: string; start?: number; end?: number }): Promise<BrowserReadingResponse>;
  waitForReadingToolbarAction(input: { readingId: string }): Promise<BrowserReadingResponse>;
  syncReadingToolbar(input: BrowserReadingToolbarState): Promise<BrowserReadingResponse>;
  cancelReadingSpeech(input: { readingId: string; requestId?: string }): Promise<BrowserReadingResponse>;
  closeReadingMode(input: { readingId: string }): Promise<BrowserReadingResponse>;
  listHistory(query?: string, limit?: number, filters?: { offset?: number; from?: string; to?: string; domain?: string }): Promise<IntegratedBrowserDataResponse>;
  importHistory(): Promise<IntegratedBrowserDataResponse>;
  getProfile(): Promise<IntegratedBrowserDataResponse>;
  setProfile(kind: BrowserProfileKind): Promise<IntegratedBrowserDataResponse>;
  listBookmarks(query?: string): Promise<IntegratedBrowserDataResponse>;
  saveBookmark(input: { id?: string; url: string; title: string; folderId?: string | null; tags?: string[]; position?: number }): Promise<IntegratedBrowserDataResponse>;
  removeBookmark(id: string): Promise<IntegratedBrowserDataResponse>;
  migrateLegacyBookmarks(entries: unknown[]): Promise<IntegratedBrowserDataResponse>;
  importBookmarksHtml(): Promise<IntegratedBrowserDataResponse>;
  exportBookmarksHtml(): Promise<IntegratedBrowserDataResponse>;
  recoverBookmarks(): Promise<IntegratedBrowserDataResponse>;
  recoverPolicyStore(input: BrowserPolicyRecoveryRequest): Promise<BrowserPolicyRecoveryResponse>;
  getAgentPolicy(origin?: string): Promise<IntegratedBrowserDataResponse>;
  agentAudit(input: BrowserAuditRequest): Promise<IntegratedBrowserDataResponse>;
  agentShortcuts(input: BrowserShortcutRequest): Promise<BrowserShortcutResponse>;
  semanticMemoryCommand(input: BrowserSemanticRequest): Promise<BrowserSemanticResponse>;
  credentialSessionCommand(input: BrowserCredentialSessionRequest): Promise<BrowserCredentialSessionResponse>;
  controlAgentTask(input: BrowserAgentControlRequest): Promise<BrowserAgentControlResponse>;
  setAgentPolicy(input: { origin?: string; mode: BrowserAgentPolicyMode; decision: 'ask' | 'allow-always' | 'block' }): Promise<IntegratedBrowserDataResponse>;
  decideAgentPolicy(input: { id: string; decision: 'allow-once' | 'allow-always' | 'block' }): Promise<BrowserPermissionDecisionResponse>;
  getPrivacySite(origin?: string): Promise<IntegratedBrowserDataResponse>;
  setPrivacySite(input: { origin?: string; level: BrowserPrivacyLevel; exceptionCategories: BrowserPrivacyCategory[] }): Promise<IntegratedBrowserDataResponse>;
  clearHistory(): Promise<IntegratedBrowserDataResponse>;
  clearBrowsingData(input: { categories: BrowsingDataCategory[]; range: BrowsingDataRange }): Promise<BrowsingDataResponse>;
  listCredentials(): Promise<IntegratedBrowserDataResponse>;
  setCredentialAutosave(enabled: boolean): Promise<IntegratedBrowserDataResponse>;
  analyzeCredentialHealth(): Promise<IntegratedBrowserDataResponse>;
  importCredentials(): Promise<IntegratedBrowserDataResponse>;
  exportCredentials(): Promise<IntegratedBrowserDataResponse>;
  recoverCredentials(): Promise<IntegratedBrowserDataResponse>;
  saveCredential(input: { id?: string; username: string; password: string; expectedOrigin: string }): Promise<IntegratedBrowserDataResponse>;
  fillCredential(id: string): Promise<IntegratedBrowserDataResponse>;
  removeCredential(id: string): Promise<IntegratedBrowserDataResponse>;
  listExtensions(): Promise<IntegratedBrowserDataResponse>;
  extensionCatalog(input: BrowserExtensionCatalogRequest): Promise<IntegratedBrowserDataResponse>;
  installExtension(): Promise<IntegratedBrowserDataResponse>;
  confirmExtensionInstall(token: string): Promise<IntegratedBrowserDataResponse>;
  setExtensionEnabled(installId: string, enabled: boolean): Promise<IntegratedBrowserDataResponse>;
  restrictExtensionSites(installId: string, sites: string[]): Promise<IntegratedBrowserDataResponse>;
  removeExtension(installId: string): Promise<IntegratedBrowserDataResponse>;
  getSitePermissions(): Promise<BrowserSitePermissionResponse>;
  setSitePermission(input: {
    origin?: string;
    kind: BrowserSitePermissionKind;
    state: BrowserSitePermissionState;
  }): Promise<BrowserSitePermissionResponse>;
  resetSitePermissions(input?: { origin?: string }): Promise<BrowserSitePermissionResponse>;
  getTabSummaries(): Promise<IntegratedBrowserTabSummariesResponse>;
  getTabContent(tabId: string, expected?: import('../shared/browser-tab-context').BrowserTabExpectation): Promise<BrowserTabContentResponse>;
  onStateChanged(callback: (state: IntegratedBrowserState) => void): () => void;
  onDownloadsChanged(callback: (downloads: BrowserDownloadRecord[]) => void): () => void;
  onFindRequested(callback: () => void): () => void;
  onOpenRequested(callback: (request: { url?: string }) => void): () => void;
  onSelectionAction(callback: (request: BrowserSelectionActionRequest) => void): () => void;
  onReadingModeRequested(callback: (request: BrowserReadingModeRequest) => void): () => void;
  onWritingRequest(callback: (request: BrowserWritingRequest) => void): () => void;
  resolveWriting(input: BrowserWritingResolution): Promise<IntegratedBrowserResponse>;
  onSitePermissionsChanged(callback: () => void): () => void;
  decidePermissionPrompt(input: { id: string; granted: boolean }): Promise<BrowserPermissionDecisionResponse>;
  onPermissionPrompt(callback: (request: BrowserPermissionPromptRequest) => void): () => void;
  onAgentPolicyPrompt(callback: (request: BrowserAgentPolicyPromptRequest) => void): () => void;
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
  getRuntimeDiagnostic: (): Promise<BrowserRuntimeDiagnosticResponse> => requireApi().getRuntimeDiagnostic(),
  getSyncDevices: (): Promise<BrowserSyncDevicesResponse> => requireApi().getSyncDevices(),
  registerSyncDevice: (): Promise<BrowserSyncDevicesResponse> => requireApi().registerSyncDevice(),
  revokeSyncDevice: (id: string): Promise<BrowserSyncDevicesResponse> => requireApi().revokeSyncDevice(id),
  cancelSyncOperation: (): Promise<BrowserSyncDevicesResponse> => requireApi().cancelSyncOperation(),
  controlSync: (input: BrowserSyncControlRequest): Promise<BrowserSyncControlResponse> => requireApi().controlSync(input),
  exportRuntimeDiagnostic: (): Promise<BrowserDiagnosticExportResponse> => requireApi().exportRuntimeDiagnostic(),
  restorePreviousSession: (): Promise<IntegratedBrowserResponse> => requireApi().restorePreviousSession(),
  discardPreviousSession: (): Promise<IntegratedBrowserResponse> => requireApi().discardPreviousSession(),
  captureVisible: (): Promise<IntegratedBrowserCaptureResponse> => requireApi().captureVisible(),
  getObservation: (forceFresh = false): Promise<IntegratedBrowserObservationResponse> => requireApi().getObservation(forceFresh),
  setObservationEnabled: (enabled: boolean): Promise<IntegratedBrowserObservationResponse> => requireApi().setObservationEnabled(enabled),
  open: (url?: string): Promise<IntegratedBrowserResponse> => requireApi().open(url),
  navigate: (target: string): Promise<IntegratedBrowserResponse> => requireApi().navigate(target),
  findInPage: (query: string, forward = true): Promise<IntegratedBrowserResponse> => requireApi().findInPage(query, forward),
  stopFindInPage: (): Promise<IntegratedBrowserResponse> => requireApi().stopFindInPage(),
  setZoom: (action: 'in' | 'out' | 'reset'): Promise<IntegratedBrowserResponse> => requireApi().setZoom(action),
  setMuted: (muted: boolean): Promise<IntegratedBrowserResponse> => requireApi().setMuted(muted),
  toggleFullscreen: (): Promise<IntegratedBrowserResponse> => requireApi().toggleFullscreen(),
  printPage: (): Promise<IntegratedBrowserResponse> => requireApi().printPage(),
  savePageAsPdf: (): Promise<BrowserPageToolResponse> => requireApi().savePageAsPdf(),
  listDownloads: (): Promise<IntegratedBrowserDataResponse> => requireApi().listDownloads(),
  cancelDownload: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().cancelDownload(id),
  resumeDownload: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().resumeDownload(id),
  retryDownload: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().retryDownload(id),
  openDownload: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().openDownload(id),
  revealDownload: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().revealDownload(id),
  clickElement: (ref: string): Promise<IntegratedBrowserInteractionResponse> => requireApi().clickElement(ref),
  typeInElement: (ref: string, text: string, submit?: boolean): Promise<IntegratedBrowserInteractionResponse> =>
    requireApi().typeInElement(ref, text, submit),
  scrollView: (direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<IntegratedBrowserResponse> =>
    requireApi().scrollView(direction, amount),
  createTab: (url?: string): Promise<IntegratedBrowserResponse> => requireApi().createTab(url),
  closeTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().closeTab(tabId),
  duplicateTab: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().duplicateTab(tabId),
  reopenClosedTab: (tabId?: string): Promise<IntegratedBrowserResponse> => tabId === undefined ? requireApi().reopenClosedTab() : requireApi().reopenClosedTab(tabId),
  listRecentlyClosedTabs: (): Promise<IntegratedBrowserDataResponse> => requireApi().listRecentlyClosedTabs(),
  getHistoryRetention: (): Promise<IntegratedBrowserDataResponse> => requireApi().getHistoryRetention(),
  setHistoryRetention: (days: number | null): Promise<IntegratedBrowserDataResponse> => requireApi().setHistoryRetention(days),
  closeOtherTabs: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().closeOtherTabs(tabId),
  closeTabsToRight: (tabId: string): Promise<IntegratedBrowserResponse> => requireApi().closeTabsToRight(tabId),
  setTabPinned: (tabId: string, pinned: boolean): Promise<IntegratedBrowserResponse> => requireApi().setTabPinned(tabId, pinned),
  setTabLayout: (layout: 'horizontal' | 'vertical'): Promise<IntegratedBrowserResponse> => requireApi().setTabLayout(layout),
  createTabGroup: (name: string, color: BrowserTabGroupColor): Promise<IntegratedBrowserDataResponse> => requireApi().createTabGroup(name, color),
  assignTabGroup: (tabId: string, groupId: string | null): Promise<IntegratedBrowserResponse> => requireApi().assignTabGroup(tabId, groupId),
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
  readActiveDocument: (): Promise<BrowserDocumentResponse> => requireApi().readActiveDocument(),
  prepareReadingMode: (input?: { sourceUrl?: string; selection?: string }): Promise<BrowserReadingResponse> => requireApi().prepareReadingMode(input),
  synthesizeReadingSegment: (input: { readingId: string; requestId: string; start: number; end: number }): Promise<BrowserReadingResponse> => requireApi().synthesizeReadingSegment(input),
  highlightReadingRange: (input: { readingId: string; start?: number; end?: number }): Promise<BrowserReadingResponse> => requireApi().highlightReadingRange(input),
  waitForReadingToolbarAction: (input: { readingId: string }): Promise<BrowserReadingResponse> => requireApi().waitForReadingToolbarAction(input),
  syncReadingToolbar: (input: BrowserReadingToolbarState): Promise<BrowserReadingResponse> => requireApi().syncReadingToolbar(input),
  cancelReadingSpeech: (input: { readingId: string; requestId?: string }): Promise<BrowserReadingResponse> => requireApi().cancelReadingSpeech(input),
  closeReadingMode: (input: { readingId: string }): Promise<BrowserReadingResponse> => requireApi().closeReadingMode(input),
  listHistory: (query?: string, limit?: number, filters?: { offset?: number; from?: string; to?: string; domain?: string }): Promise<IntegratedBrowserDataResponse> => (
    filters === undefined ? requireApi().listHistory(query, limit) : requireApi().listHistory(query, limit, filters)
  ),
  importHistory: (): Promise<IntegratedBrowserDataResponse> => requireApi().importHistory(),
  getProfile: (): Promise<IntegratedBrowserDataResponse> => requireApi().getProfile(),
  setProfile: (kind: BrowserProfileKind): Promise<IntegratedBrowserDataResponse> => requireApi().setProfile(kind),
  listBookmarks: (query?: string): Promise<IntegratedBrowserDataResponse> => requireApi().listBookmarks(query),
  saveBookmark: (input: { id?: string; url: string; title: string; folderId?: string | null; tags?: string[]; position?: number }): Promise<IntegratedBrowserDataResponse> => requireApi().saveBookmark(input),
  removeBookmark: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().removeBookmark(id),
  migrateLegacyBookmarks: (entries: unknown[]): Promise<IntegratedBrowserDataResponse> => requireApi().migrateLegacyBookmarks(entries),
  importBookmarksHtml: (): Promise<IntegratedBrowserDataResponse> => requireApi().importBookmarksHtml(),
  exportBookmarksHtml: (): Promise<IntegratedBrowserDataResponse> => requireApi().exportBookmarksHtml(),
  recoverBookmarks: (): Promise<IntegratedBrowserDataResponse> => requireApi().recoverBookmarks(),
  recoverPolicyStore: (input: BrowserPolicyRecoveryRequest): Promise<BrowserPolicyRecoveryResponse> => requireApi().recoverPolicyStore(input),
  getAgentPolicy: (origin?: string): Promise<IntegratedBrowserDataResponse> => requireApi().getAgentPolicy(origin),
  agentAudit: (input: BrowserAuditRequest): Promise<IntegratedBrowserDataResponse> => requireApi().agentAudit(input),
  agentShortcuts: (input: BrowserShortcutRequest): Promise<BrowserShortcutResponse> => requireApi().agentShortcuts(input),
  semanticMemoryCommand: (input: BrowserSemanticRequest): Promise<BrowserSemanticResponse> => requireApi().semanticMemoryCommand(input),
  credentialSessionCommand: (input: BrowserCredentialSessionRequest): Promise<BrowserCredentialSessionResponse> => requireApi().credentialSessionCommand(input),
  controlAgentTask: (input: BrowserAgentControlRequest): Promise<BrowserAgentControlResponse> => requireApi().controlAgentTask(input),
  setAgentPolicy: (input: { origin?: string; mode: BrowserAgentPolicyMode; decision: 'ask' | 'allow-always' | 'block' }): Promise<IntegratedBrowserDataResponse> => requireApi().setAgentPolicy(input),
  decideAgentPolicy: (input: { id: string; decision: 'allow-once' | 'allow-always' | 'block' }): Promise<BrowserPermissionDecisionResponse> => requireApi().decideAgentPolicy(input),
  getPrivacySite: (origin?: string): Promise<IntegratedBrowserDataResponse> => requireApi().getPrivacySite(origin),
  setPrivacySite: (input: { origin?: string; level: BrowserPrivacyLevel; exceptionCategories: BrowserPrivacyCategory[] }): Promise<IntegratedBrowserDataResponse> => requireApi().setPrivacySite(input),
  clearHistory: (): Promise<IntegratedBrowserDataResponse> => requireApi().clearHistory(),
  clearBrowsingData: (input: {
    categories: BrowsingDataCategory[];
    range: BrowsingDataRange;
  }): Promise<BrowsingDataResponse> => requireApi().clearBrowsingData(input),
  listCredentials: (): Promise<IntegratedBrowserDataResponse> => requireApi().listCredentials(),
  setCredentialAutosave: (enabled: boolean): Promise<IntegratedBrowserDataResponse> => requireApi().setCredentialAutosave(enabled),
  analyzeCredentialHealth: (): Promise<IntegratedBrowserDataResponse> => requireApi().analyzeCredentialHealth(),
  importCredentials: (): Promise<IntegratedBrowserDataResponse> => requireApi().importCredentials(),
  exportCredentials: (): Promise<IntegratedBrowserDataResponse> => requireApi().exportCredentials(),
  recoverCredentials: (): Promise<IntegratedBrowserDataResponse> => requireApi().recoverCredentials(),
  saveCredential: (input: { id?: string; username: string; password: string; expectedOrigin: string }): Promise<IntegratedBrowserDataResponse> => requireApi().saveCredential(input),
  fillCredential: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().fillCredential(id),
  removeCredential: (id: string): Promise<IntegratedBrowserDataResponse> => requireApi().removeCredential(id),
  listExtensions: (): Promise<IntegratedBrowserDataResponse> => requireApi().listExtensions(),
  extensionCatalog: (input: BrowserExtensionCatalogRequest): Promise<IntegratedBrowserDataResponse> => requireApi().extensionCatalog(input),
  installExtension: (): Promise<IntegratedBrowserDataResponse> => requireApi().installExtension(),
  confirmExtensionInstall: (token: string): Promise<IntegratedBrowserDataResponse> => requireApi().confirmExtensionInstall(token),
  setExtensionEnabled: (installId: string, enabled: boolean): Promise<IntegratedBrowserDataResponse> => requireApi().setExtensionEnabled(installId, enabled),
  restrictExtensionSites: (installId: string, sites: string[]): Promise<IntegratedBrowserDataResponse> => requireApi().restrictExtensionSites(installId, sites),
  removeExtension: (installId: string): Promise<IntegratedBrowserDataResponse> => requireApi().removeExtension(installId),
  getSitePermissions: (): Promise<BrowserSitePermissionResponse> => requireApi().getSitePermissions(),
  setSitePermission: (input: {
    origin?: string;
    kind: BrowserSitePermissionKind;
    state: BrowserSitePermissionState;
  }): Promise<BrowserSitePermissionResponse> => requireApi().setSitePermission(input),
  resetSitePermissions: (input?: { origin?: string }): Promise<BrowserSitePermissionResponse> => requireApi().resetSitePermissions(input),
  getTabSummaries: (): Promise<IntegratedBrowserTabSummariesResponse> => requireApi().getTabSummaries(),
  getTabContent: (tabId: string, expected?: import('../shared/browser-tab-context').BrowserTabExpectation): Promise<BrowserTabContentResponse> => expected ? requireApi().getTabContent(tabId, expected) : requireApi().getTabContent(tabId),
  decidePermissionPrompt: (input: { id: string; granted: boolean }): Promise<BrowserPermissionDecisionResponse> => (
    requireApi().decidePermissionPrompt(input)
  ),
  resolveWriting: (input: BrowserWritingResolution): Promise<IntegratedBrowserResponse> => requireApi().resolveWriting(input),
  subscribe: (callbacks: {
    onStateChanged?: (state: IntegratedBrowserState) => void;
    onDownloadsChanged?: (downloads: BrowserDownloadRecord[]) => void;
    onFindRequested?: () => void;
    onOpenRequested?: (request: { url?: string }) => void;
    onSelectionAction?: (request: BrowserSelectionActionRequest) => void;
    onReadingModeRequested?: (request: BrowserReadingModeRequest) => void;
    onWritingRequest?: (request: BrowserWritingRequest) => void;
    onSitePermissionsChanged?: () => void;
    onPermissionPrompt?: (request: BrowserPermissionPromptRequest) => void;
    onAgentPolicyPrompt?: (request: BrowserAgentPolicyPromptRequest) => void;
  }): (() => void) => {
    const api = requireApi();
    const cleanups: Array<() => void> = [];
    if (callbacks.onStateChanged) cleanups.push(api.onStateChanged(callbacks.onStateChanged));
    if (callbacks.onDownloadsChanged) cleanups.push(api.onDownloadsChanged(callbacks.onDownloadsChanged));
    if (callbacks.onFindRequested) cleanups.push(api.onFindRequested(callbacks.onFindRequested));
    if (callbacks.onOpenRequested) cleanups.push(api.onOpenRequested(callbacks.onOpenRequested));
    if (callbacks.onSelectionAction) cleanups.push(api.onSelectionAction(callbacks.onSelectionAction));
    if (callbacks.onReadingModeRequested) cleanups.push(api.onReadingModeRequested(callbacks.onReadingModeRequested));
    if (callbacks.onWritingRequest) cleanups.push(api.onWritingRequest(callbacks.onWritingRequest));
    if (callbacks.onSitePermissionsChanged) cleanups.push(api.onSitePermissionsChanged(callbacks.onSitePermissionsChanged));
    if (callbacks.onPermissionPrompt) cleanups.push(api.onPermissionPrompt(callbacks.onPermissionPrompt));
    if (callbacks.onAgentPolicyPrompt) cleanups.push(api.onAgentPolicyPrompt(callbacks.onAgentPolicyPrompt));
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
  tabLayout: 'horizontal',
  groups: [],
  canReopenClosedTab: false,
  restoreAvailable: null,
};

export {};
