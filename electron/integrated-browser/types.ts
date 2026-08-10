import type { Rectangle } from 'electron';

export const INTEGRATED_BROWSER_PARTITION = 'persist:soflia-integrated-browser';
export const INTEGRATED_BROWSER_HOME = 'https://www.google.com/';
export const INTEGRATED_BROWSER_AGENT_VIEWPORT_TIMEOUT_MS = 8_000;
export const INTEGRATED_BROWSER_MAX_TABS = 500;
export const INTEGRATED_BROWSER_MAX_LIVE_TABS = 8;
export const INTEGRATED_BROWSER_MAX_DETACHED_WINDOWS = 4;
export const INTEGRATED_BROWSER_OBSERVATION_INTERVAL_MS = 10_000;
export const INTEGRATED_BROWSER_OBSERVATION_IDLE_MS = 4_000;
/** Las aplicaciones multimedia necesitan terminar XHR y render diferido sin
 * competir con el readback del compositor. La inspeccion explicita no usa
 * estos retrasos. */
export const INTEGRATED_BROWSER_MEDIA_OBSERVATION_INTERVAL_MS = 30_000;
export const INTEGRATED_BROWSER_MEDIA_OBSERVATION_IDLE_MS = 12_000;
/** Reprogramacion minima entre eventos de entrada seguidos. */
export const INTEGRATED_BROWSER_DEFER_THROTTLE_MS = 250;
/** Margen para que la seleccion se asiente antes de leerla y adjuntarla al chat. */
export const SELECTION_PROBE_DELAY_MS = 220;
export const INTEGRATED_BROWSER_OBSERVATION_MAX_EDGE = 1_024;
/** Calidad JPEG de la percepcion enviada al modelo. */
export const INTEGRATED_BROWSER_OBSERVATION_QUALITY = 80;
/** Calidad JPEG del respaldo visual mostrado mientras la vista esta oculta. */
export const INTEGRATED_BROWSER_BACKDROP_QUALITY = 92;

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
  /** La pagina pidio pantalla completa y la vista cubre la ventana. */
  isFullscreen: boolean;
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

/**
 * Imagen de contenido de la pagina. Se expone para que el agente pueda
 * reutilizar el material grafico que el usuario ya esta viendo en vez de
 * generar uno nuevo. Solo entran las de tamano real: los iconos y los pixeles
 * de seguimiento no aportan y ensucian la observacion.
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

export interface BrowserInteractionOutcome {
  target: BrowserElementTargetSummary;
  warning: string | null;
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

/**
 * Permisos que el navegador integrado administra por origen. La lista es la
 * traduccion de los nombres de Electron a las categorias que el usuario
 * reconoce en el panel del candado: `media` se abre en camara y microfono
 * porque se conceden por separado, y los permisos de dispositivo (`usb`,
 * `serial`, `hid`, `bluetooth`, MIDI) quedan fuera a proposito: se deniegan
 * siempre y no son configurables.
 */
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

/**
 * Estado inicial de cada permiso. Reproduce el criterio de un navegador de
 * escritorio: lo que abre un dispositivo, publica notificaciones o revela
 * presencia se pregunta; lo que solo altera la presentacion de la pagina y ya
 * exige un gesto del usuario en Chromium se concede sin interrumpir.
 */
export const BROWSER_SITE_PERMISSION_DEFAULTS: Record<BrowserSitePermissionKind, BrowserSitePermissionState> = {
  camera: 'ask',
  microphone: 'ask',
  geolocation: 'ask',
  notifications: 'ask',
  'display-capture': 'ask',
  'clipboard-read': 'ask',
  'idle-detection': 'ask',
  'window-management': 'ask',
  fullscreen: 'granted',
  'pointer-lock': 'granted',
  'keyboard-lock': 'granted',
  'speaker-selection': 'granted',
  'protected-media': 'granted',
};

export const BROWSER_SITE_PERMISSION_LABELS: Record<BrowserSitePermissionKind, string> = {
  camera: 'Cámara',
  microphone: 'Micrófono',
  geolocation: 'Ubicación',
  notifications: 'Notificaciones',
  'display-capture': 'Compartir pantalla',
  'clipboard-read': 'Leer el portapapeles',
  'idle-detection': 'Detección de inactividad',
  'window-management': 'Gestión de ventanas',
  fullscreen: 'Pantalla completa',
  'pointer-lock': 'Bloqueo del puntero',
  'keyboard-lock': 'Bloqueo del teclado',
  'speaker-selection': 'Elegir la salida de audio',
  'protected-media': 'Contenido protegido',
};

export interface BrowserSitePermissionDecision {
  state: BrowserSitePermissionState;
  decidedAt: string;
}

export interface BrowserSitePermissionEntry {
  kind: BrowserSitePermissionKind;
  label: string;
  state: BrowserSitePermissionState;
  /** Verdadero cuando la pagina lo solicito durante esta sesion del navegador. */
  requested: boolean;
}

export interface BrowserSitePermissionSummary {
  origin: string | null;
  url: string;
  secure: boolean;
  permissions: BrowserSitePermissionEntry[];
}
