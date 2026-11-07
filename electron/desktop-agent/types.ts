import type { DesktopTaskOptions, ScreenshotVirtualBounds } from '../../src/shared/desktop-agent';
export type { ScreenshotVirtualBounds } from '../../src/shared/desktop-agent';
export type { DesktopActionPayload } from '../desktop-agent-types';

export type DesktopTaskExecutionOptions = DesktopTaskOptions & {
  /** Cancelacion desde el llamador (p.ej. la conversacion que origino la tarea). */
  signal?: AbortSignal;
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
