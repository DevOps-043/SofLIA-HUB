import type { ScreenshotDisplayRegion, ScreenshotLayout, ScreenshotVirtualBounds } from './types';

export type DisplayLike = {
  id?: number | string;
  bounds: ScreenshotVirtualBounds;
};

export type ScreenPointAdapter = {
  dipToScreenPoint?: (point: { x: number; y: number }) => { x: number; y: number };
  screenToDipPoint?: (point: { x: number; y: number }) => { x: number; y: number };
};

export function getVirtualDesktopBounds(displays: DisplayLike[]): ScreenshotVirtualBounds {
  if (!displays.length) return { x: 0, y: 0, width: 1920, height: 1080 };

  const minX = Math.min(...displays.map((display) => display.bounds.x));
  const minY = Math.min(...displays.map((display) => display.bounds.y));
  const maxX = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
  const maxY = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function intersectBounds(a: ScreenshotVirtualBounds, b: ScreenshotVirtualBounds): ScreenshotVirtualBounds | null {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right <= left || bottom <= top ? null : { x: left, y: top, width: right - left, height: bottom - top };
}

export function buildScreenshotLayout(
  displays: DisplayLike[],
  targetWidth: number,
  targetHeight: number,
  captureBounds?: ScreenshotVirtualBounds | null,
): ScreenshotLayout {
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

export function dipToScreenPoint(adapter: ScreenPointAdapter, point: { x: number; y: number }): { x: number; y: number } {
  try {
    const converted = adapter.dipToScreenPoint?.({ x: Math.round(point.x), y: Math.round(point.y) });
    if (converted && Number.isFinite(converted.x) && Number.isFinite(converted.y)) {
      return { x: Math.round(converted.x), y: Math.round(converted.y) };
    }
  } catch {}
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

export function screenToDipPoint(adapter: ScreenPointAdapter, point: { x: number; y: number }): { x: number; y: number } {
  try {
    const converted = adapter.screenToDipPoint?.({ x: Math.round(point.x), y: Math.round(point.y) });
    if (converted && Number.isFinite(converted.x) && Number.isFinite(converted.y)) return converted;
  } catch {}
  return point;
}

export function mapScreenshotToDipPoint(layout: ScreenshotLayout | null, x: number, y: number): { x: number; y: number } | null {
  if (!layout) return null;
  const relativeX = Math.max(0, Math.min(layout.virtualBounds.width, (x - layout.offsetX) / layout.renderScale));
  const relativeY = Math.max(0, Math.min(layout.virtualBounds.height, (y - layout.offsetY) / layout.renderScale));
  return { x: layout.virtualBounds.x + relativeX, y: layout.virtualBounds.y + relativeY };
}

export function mapDipPointToScreenshotPoint(layout: ScreenshotLayout | null, x: number, y: number): { x: number; y: number } | null {
  if (!layout) return null;
  return { x: ((x - layout.virtualBounds.x) * layout.renderScale) + layout.offsetX, y: ((y - layout.virtualBounds.y) * layout.renderScale) + layout.offsetY };
}
