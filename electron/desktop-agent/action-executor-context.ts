import type { DesktopAgentConfig, DesktopActionPayload, UIElement } from '../desktop-agent-types';

type Point = { x: number; y: number };

export type DesktopActionExecutionContext = {
  config: DesktopAgentConfig;
  getUIElements: () => UIElement[];
  setLastZoomImage: (image: string) => void;
  refineActionCoordinates: (action: DesktopActionPayload) => DesktopActionPayload;
  logActionCoordinateResolution: (action: DesktopActionPayload) => void;
  assertActionTargetsVisibleContent: (action: DesktopActionPayload) => void;
  mouseClick: (x: number, y: number) => Promise<void>;
  mouseDoubleClick: (x: number, y: number) => Promise<void>;
  mouseRightClick: (x: number, y: number) => Promise<void>;
  mouseDrag: (x1: number, y1: number, x2: number, y2: number) => Promise<void>;
  mouseDown: (x: number, y: number) => Promise<void>;
  mouseUp: (x?: number, y?: number) => Promise<void>;
  mouseMove: (x: number, y: number) => Promise<void>;
  mouseScroll: (direction: 'up' | 'down', amount: number) => Promise<void>;
  keyboardType: (text: string) => Promise<void>;
  keyboardKey: (key: string) => Promise<void>;
  focusWindow: (title: string) => Promise<boolean>;
  minimizeWindow: (title: string) => Promise<boolean>;
  maximizeWindow: (title: string) => Promise<boolean>;
  restoreWindow: (title: string) => Promise<boolean>;
  closeWindow: (title: string) => Promise<boolean>;
  waitForScreenChange: (timeoutMs: number) => Promise<boolean>;
  waitForWindow: (title: string, timeoutMs: number) => Promise<boolean>;
  takeZoomScreenshot: (x: number, y: number, radius: number) => Promise<string>;
  mapDesktopPointToScreenshotPoint: (x: number, y: number) => Point | null;
  delay: (ms: number) => Promise<void>;
};
