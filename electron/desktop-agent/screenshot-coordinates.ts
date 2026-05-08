import { screen as electronScreen } from 'electron';
import type { ScreenshotLayout } from './types';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type ScreenConverters = typeof electronScreen & {
  dipToScreenPoint?: (point: Point) => Point;
  screenToDipPoint?: (point: Point) => Point;
};

export function dipToScreenPoint(point: Point): Point {
  try {
    const converted = (electronScreen as ScreenConverters).dipToScreenPoint?.({
      x: Math.round(point.x),
      y: Math.round(point.y),
    });
    if (isFinitePoint(converted)) return { x: Math.round(converted.x), y: Math.round(converted.y) };
  } catch {
    // Keep fallback below.
  }
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

export function screenToDipPoint(point: Point): Point {
  try {
    const converted = (electronScreen as ScreenConverters).screenToDipPoint?.({
      x: Math.round(point.x),
      y: Math.round(point.y),
    });
    if (isFinitePoint(converted)) return { x: converted.x, y: converted.y };
  } catch {
    // Keep fallback below.
  }
  return { x: point.x, y: point.y };
}

export function mapScreenshotToDipPoint(x: number, y: number, layout: ScreenshotLayout | null): Point | null {
  if (!layout) return null;
  const relativeX = Math.max(0, Math.min(layout.virtualBounds.width, (x - layout.offsetX) / layout.renderScale));
  const relativeY = Math.max(0, Math.min(layout.virtualBounds.height, (y - layout.offsetY) / layout.renderScale));
  return { x: layout.virtualBounds.x + relativeX, y: layout.virtualBounds.y + relativeY };
}

export function mapDipPointToScreenshotPoint(x: number, y: number, layout: ScreenshotLayout | null): Point | null {
  if (!layout) return null;
  return {
    x: ((x - layout.virtualBounds.x) * layout.renderScale) + layout.offsetX,
    y: ((y - layout.virtualBounds.y) * layout.renderScale) + layout.offsetY,
  };
}

export function mapDesktopPointToScreenshotPoint(x: number, y: number, layout: ScreenshotLayout | null): Point | null {
  const dipPoint = screenToDipPoint({ x, y });
  return mapDipPointToScreenshotPoint(dipPoint.x, dipPoint.y, layout);
}

export function mapDesktopRectToScreenshotRect(rect: Rect, layout: ScreenshotLayout | null): Rect | null {
  const topLeft = mapDesktopPointToScreenshotPoint(rect.x, rect.y, layout);
  const bottomRight = mapDesktopPointToScreenshotPoint(rect.x + rect.width, rect.y + rect.height, layout);
  if (!topLeft || !bottomRight) return null;
  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: Math.min(topLeft.y, bottomRight.y),
    width: Math.max(1, Math.abs(bottomRight.x - topLeft.x)),
    height: Math.max(1, Math.abs(bottomRight.y - topLeft.y)),
  };
}

export function getDisplayRegionLabelFromScreenshotPoint(
  x: number,
  y: number,
  layout: ScreenshotLayout | null,
): string | null {
  if (!layout) return null;
  const regionIndex = layout.displayRegions.findIndex((region) => (
    x >= region.left
    && x <= (region.left + region.width)
    && y >= region.top
    && y <= (region.top + region.height)
  ));
  if (regionIndex === -1) return layout.offsetX > 0 || layout.offsetY > 0 ? 'padding' : null;
  const region = layout.displayRegions[regionIndex];
  return `monitor ${regionIndex + 1} (display ${region.displayId})`;
}

function isFinitePoint(point: Point | undefined): point is Point {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}
