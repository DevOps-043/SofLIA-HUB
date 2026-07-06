import type { DesktopAgentConfig, DesktopActionPayload, ResolvedActionTarget, UIElement } from '../desktop-agent-types';
import type { DeterministicActionResult } from './deterministic-actions';
import type { LocateAttempt } from './element-locator';

type Point = { x: number; y: number };

/** Resultado del click medido por texto (element-locator + click fisico). */
export type ClickByTextResult = {
  found: boolean;
  fuente?: 'uia' | 'ocr';
  texto?: string;
  x?: number;
  y?: number;
  resolvedTarget?: ResolvedActionTarget;
  intentos: LocateAttempt[];
};

export type DesktopActionExecutionContext = {
  config: DesktopAgentConfig;
  getUIElements: () => UIElement[];
  setLastZoomImage: (image: string) => void;
  /** Registra (en espacio IMAGEN) donde el modelo hizo zoom; evidencia para desbloquear un click. */
  recordZoom?: (x: number, y: number) => void;
  refineActionCoordinates: (action: DesktopActionPayload) => DesktopActionPayload;
  logActionCoordinateResolution: (action: DesktopActionPayload) => void;
  assertActionTargetsVisibleContent: (action: DesktopActionPayload) => void;
  setResolvedTarget?: (target: ResolvedActionTarget | null) => void;
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
  openApplication: (appName: string) => Promise<DeterministicActionResult>;
  openUrl: (url: string) => Promise<DeterministicActionResult>;
  /** `hint` = coordenada aproximada en espacio IMAGEN donde el modelo ve el elemento (desambigua textos repetidos). */
  clickElementByName: (elementName: string, doubleClick?: boolean, hint?: { x: number; y: number }) => Promise<ClickByTextResult>;
  takeZoomScreenshot: (x: number, y: number, radius: number) => Promise<string>;
  mapDesktopPointToScreenshotPoint: (x: number, y: number) => Point | null;
  delay: (ms: number) => Promise<void>;
};
