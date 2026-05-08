export type DesktopTaskExecutionOptions = {
  maxSteps?: number;
  startUrl?: string;
  backend?: 'auto' | 'browser' | 'desktop' | 'uia';
  browserProfile?: string;
  browserIsolated?: boolean;
  resetBrowserProfile?: boolean;
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
