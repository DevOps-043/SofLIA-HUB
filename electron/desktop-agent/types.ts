export type { DesktopActionPayload } from '../desktop-agent-types';

export type DesktopTaskExecutionOptions = {
  maxSteps?: number;
  startUrl?: string;
  backend?: 'auto' | 'browser' | 'desktop' | 'uia';
  browserProfile?: string;
  browserIsolated?: boolean;
  resetBrowserProfile?: boolean;
  /**
   * Fuerza el uso del navegador REAL del usuario (predeterminado, con sus
   * sesiones y contraseñas) via backend visual + open_url, en lugar del
   * navegador automatizado de Playwright cuyo perfil no tiene sus logins.
   */
  useRealBrowser?: boolean;
  /** Cancelacion desde el llamador (p.ej. la conversacion que origino la tarea). */
  signal?: AbortSignal;
  /** Tiempo maximo en cola antes de expirar; 0 desactiva el timeout. */
  queueTimeoutMs?: number;
};

export type ScreenshotVirtualBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScreenshotDisplayRegion = {
  displayId: string;
  bounds: ScreenshotVirtualBounds;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ScreenshotLayout = {
  screenshotWidth: number;
  screenshotHeight: number;
  offsetX: number;
  offsetY: number;
  renderScale: number;
  virtualBounds: ScreenshotVirtualBounds;
  displayRegions: ScreenshotDisplayRegion[];
};

export type WindowsUIAFallbackRunResult = {
  message: string;
  failureCategory: string;
  verification: string | null;
  reportPath: string | null;
  tracePath: string | null;
};
