import type { DesktopAgentConfig } from '../desktop-agent-types';
import type { ScreenshotLayout, ScreenshotVirtualBounds } from './types';

type ScreenScale = { scaleX: number; scaleY: number };

export type ResolvedScreenPoint = {
  x: number;
  y: number;
  dipX?: number;
  dipY?: number;
  source: 'layout' | 'scale';
  regionLabel?: string | null;
};

export function calculateScreenScaleState(input: {
  config: DesktopAgentConfig;
  getVirtualDesktopBounds: () => ScreenshotVirtualBounds;
  buildScreenshotLayout: (width: number, height: number) => ScreenshotLayout;
}): { screenScale: ScreenScale; lastScreenshotLayout: ScreenshotLayout | null } {
  try {
    const virtualBounds = input.getVirtualDesktopBounds();
    const layout = input.buildScreenshotLayout(input.config.screenshotWidth, input.config.screenshotHeight);
    console.log(
      `[DesktopAgent] Escala inicial: virtual ${virtualBounds.width}x${virtualBounds.height}, render ${layout.renderScale.toFixed(4)}, offset ${layout.offsetX},${layout.offsetY}`,
    );
    return {
      lastScreenshotLayout: layout,
      screenScale: {
        scaleX: virtualBounds.width / input.config.screenshotWidth,
        scaleY: virtualBounds.height / input.config.screenshotHeight,
      },
    };
  } catch {
    return {
      lastScreenshotLayout: null,
      screenScale: { scaleX: 1920 / input.config.screenshotWidth, scaleY: 1080 / input.config.screenshotHeight },
    };
  }
}

export function updateScreenScaleState(input: {
  actualWidth: number;
  actualHeight: number;
  currentScale: ScreenScale;
  lastScreenshotLayout: ScreenshotLayout | null;
  buildScreenshotLayout: (width: number, height: number) => ScreenshotLayout;
}): { screenScale: ScreenScale; lastScreenshotLayout: ScreenshotLayout | null } {
  try {
    const layout = input.lastScreenshotLayout ?? input.buildScreenshotLayout(input.actualWidth, input.actualHeight);
    const virtualBounds = layout.virtualBounds;
    const nextScale = {
      scaleX: virtualBounds.width / input.actualWidth,
      scaleY: virtualBounds.height / input.actualHeight,
    };

    if (Math.abs(nextScale.scaleX - input.currentScale.scaleX) > 0.01 || Math.abs(nextScale.scaleY - input.currentScale.scaleY) > 0.01) {
      console.log(
        `[DesktopAgent] Escala corregida: screenshot ${input.actualWidth}x${input.actualHeight} -> virtual ${virtualBounds.width}x${virtualBounds.height}, scale ${nextScale.scaleX.toFixed(2)}x${nextScale.scaleY.toFixed(2)}, render ${layout.renderScale.toFixed(4)}, offset ${layout.offsetX},${layout.offsetY}`,
      );
    }

    return { screenScale: nextScale, lastScreenshotLayout: layout };
  } catch {
    return { screenScale: input.currentScale, lastScreenshotLayout: input.lastScreenshotLayout };
  }
}

export function resolveScreenPointFromState(input: {
  x: number;
  y: number;
  screenScale: ScreenScale;
  /**
   * Fallback legacy 'scale' (x * scaleX): matematica ROTA en multi-monitor
   * (ignora offsets negativos del escritorio virtual). Solo se permite tras
   * el flag de compatibilidad; sin el, la falta de layout es un error
   * explicito en lugar de un click en coordenadas incorrectas.
   */
  legacyScaleFallbackEnabled: boolean;
  mapScreenshotToDipPoint: (x: number, y: number) => { x: number; y: number } | null;
  dipToScreenPoint: (point: { x: number; y: number }) => { x: number; y: number };
  getRegionLabel: (x: number, y: number) => string | null;
}): ResolvedScreenPoint {
  const dipPoint = input.mapScreenshotToDipPoint(input.x, input.y);
  if (dipPoint) {
    const screenPoint = input.dipToScreenPoint(dipPoint);
    return {
      x: screenPoint.x,
      y: screenPoint.y,
      dipX: dipPoint.x,
      dipY: dipPoint.y,
      source: 'layout',
      regionLabel: input.getRegionLabel(input.x, input.y),
    };
  }

  if (!input.legacyScaleFallbackEnabled) {
    throw new Error('Captura sin layout: no se puede resolver la coordenada con precision; se reintenta con captura nueva.');
  }

  return {
    x: Math.round(input.x * input.screenScale.scaleX),
    y: Math.round(input.y * input.screenScale.scaleY),
    source: 'scale',
  };
}
