import { screen as electronScreen } from 'electron';
import type { CaptureStrategy, DesktopAgentConfig } from './agent-config';
import type { ScreenshotVirtualBounds } from './types';
import {
  getFocusedCaptureBounds,
  getForegroundWindowDipBounds,
  type EncodedPowerShellExecutor,
} from './focused-capture-bounds';

export type { CaptureStrategy } from './agent-config';

export type ResolvedCaptureBounds = {
  bounds: ScreenshotVirtualBounds | null;
  strategy: CaptureStrategy;
};

export type CaptureStrategyDeps = {
  config: DesktopAgentConfig;
  psEncoded: EncodedPowerShellExecutor;
  /** Inyectables para tests; por defecto usan electron.screen. */
  getDisplayMatching?: (rect: ScreenshotVirtualBounds) => { bounds: ScreenshotVirtualBounds } | null;
  getCursorDisplay?: () => { bounds: ScreenshotVirtualBounds } | null;
};

/**
 * Resuelve que region del escritorio capturar segun la estrategia:
 * - 'all-monitors': todo el escritorio virtual (bounds null).
 * - 'active-monitor': SOLO el monitor de la ventana activa (o del cursor).
 *   Bounds estables entre decidir y actuar; los iconos quedan legibles.
 * - 'focused-window': solo la ventana en primer plano con padding.
 * Cualquier fallo degrada a 'all-monitors' en lugar de romper la captura.
 */
export async function resolveCaptureBounds(deps: CaptureStrategyDeps): Promise<ResolvedCaptureBounds> {
  const strategy = deps.config.captureStrategy;
  if (strategy === 'all-monitors') return { bounds: null, strategy };

  if (strategy === 'focused-window') {
    const bounds = await getFocusedCaptureBounds(deps.config, deps.psEncoded);
    return bounds
      ? { bounds, strategy }
      : { bounds: null, strategy: 'all-monitors' };
  }

  // 'active-monitor'
  const getDisplayMatching = deps.getDisplayMatching ?? defaultGetDisplayMatching;
  const getCursorDisplay = deps.getCursorDisplay ?? defaultGetCursorDisplay;

  const foreground = await getForegroundWindowDipBounds(deps.psEncoded);
  const anchorRect = foreground && !`${foreground.title} ${foreground.process}`.toLowerCase().includes('program manager')
    ? foreground.bounds
    : null;

  const display = anchorRect ? getDisplayMatching(anchorRect) : getCursorDisplay();
  if (!display) return { bounds: null, strategy: 'all-monitors' };
  return { bounds: { ...display.bounds }, strategy };
}

function defaultGetDisplayMatching(rect: ScreenshotVirtualBounds): { bounds: ScreenshotVirtualBounds } | null {
  try {
    return electronScreen.getDisplayMatching({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    });
  } catch {
    return null;
  }
}

function defaultGetCursorDisplay(): { bounds: ScreenshotVirtualBounds } | null {
  try {
    return electronScreen.getDisplayNearestPoint(electronScreen.getCursorScreenPoint());
  } catch {
    return null;
  }
}
