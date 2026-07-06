import { screen as electronScreen } from 'electron';
import type { ScreenshotDisplayRegion, ScreenshotLayout, ScreenshotVirtualBounds } from './types';

export interface ScreenshotDisplayLike {
  id?: string | number;
  bounds: ScreenshotVirtualBounds;
}

export type ScreenshotLayoutOptions = {
  displays?: ScreenshotDisplayLike[];
  targetWidth: number;
  targetHeight: number;
  captureBounds?: ScreenshotVirtualBounds | null;
};

export function getVirtualDesktopBounds(
  displays: ScreenshotDisplayLike[] = electronScreen.getAllDisplays(),
): ScreenshotVirtualBounds {
  if (!displays.length) return { x: 0, y: 0, width: 1920, height: 1080 };

  const minX = Math.min(...displays.map((display) => display.bounds.x));
  const minY = Math.min(...displays.map((display) => display.bounds.y));
  const maxX = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
  const maxY = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function intersectBounds(
  a: ScreenshotVirtualBounds,
  b: ScreenshotVirtualBounds,
): ScreenshotVirtualBounds | null {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right <= left || bottom <= top
    ? null
    : { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

export type AdaptiveTargetSizeOptions = {
  targetWidth: number;
  targetHeight: number;
  minRenderScale: number;
  maxScreenshotEdge: number;
};

/**
 * Calcula el tamano objetivo del screenshot garantizando renderScale >= minRenderScale
 * cuando sea posible (acotado por maxScreenshotEdge). Evita comprimir escritorios
 * anchos (p.ej. 5206px de 3 monitores) en una caja fija donde los iconos quedan
 * ilegibles para el modelo.
 */
export function computeAdaptiveTargetSize(
  bounds: ScreenshotVirtualBounds,
  options: AdaptiveTargetSizeOptions,
): { width: number; height: number } {
  const baseScale = Math.min(options.targetWidth / bounds.width, options.targetHeight / bounds.height);
  if (baseScale >= options.minRenderScale) {
    return { width: options.targetWidth, height: options.targetHeight };
  }
  const maxEdge = Math.max(options.targetWidth, options.targetHeight, options.maxScreenshotEdge);
  const scale = Math.min(options.minRenderScale, maxEdge / Math.max(bounds.width, bounds.height));
  return {
    width: Math.max(1, Math.min(maxEdge, Math.round(bounds.width * scale))),
    height: Math.max(1, Math.min(maxEdge, Math.round(bounds.height * scale))),
  };
}

export function buildScreenshotLayout(options: ScreenshotLayoutOptions): ScreenshotLayout {
  const displays = options.displays ?? electronScreen.getAllDisplays();
  const { targetWidth, targetHeight, captureBounds } = options;
  const virtualBounds = captureBounds || getVirtualDesktopBounds(displays);
  const renderScale = Math.min(targetWidth / virtualBounds.width, targetHeight / virtualBounds.height);
  const contentWidth = Math.max(1, Math.round(virtualBounds.width * renderScale));
  const contentHeight = Math.max(1, Math.round(virtualBounds.height * renderScale));
  const offsetX = Math.max(0, Math.floor((targetWidth - contentWidth) / 2));
  const offsetY = Math.max(0, Math.floor((targetHeight - contentHeight) / 2));
  const displayRegions = displays.reduce<ScreenshotDisplayRegion[]>((regions, display, index) => {
    const intersection = intersectBounds(display.bounds, virtualBounds);
    if (!intersection) return regions;
    regions.push({
      displayId: String(display.id ?? index + 1),
      bounds: intersection,
      left: Math.round((intersection.x - virtualBounds.x) * renderScale) + offsetX,
      top: Math.round((intersection.y - virtualBounds.y) * renderScale) + offsetY,
      width: Math.max(1, Math.round(intersection.width * renderScale)),
      height: Math.max(1, Math.round(intersection.height * renderScale)),
    });
    return regions;
  }, []);
  return { screenshotWidth: targetWidth, screenshotHeight: targetHeight, offsetX, offsetY, renderScale, virtualBounds, displayRegions };
}
