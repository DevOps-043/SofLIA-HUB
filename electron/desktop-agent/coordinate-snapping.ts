import type { UIElement } from '../desktop-agent-types';
import { getDisplayRegionLabelFromScreenshotPoint } from './screenshot-coordinates';
import type { ScreenshotLayout } from './types';

type Rect = { x: number; y: number; width: number; height: number };

export function snapPointToVisibleRegion(
  x: number,
  y: number,
  layout: ScreenshotLayout | null,
  tolerance = 28,
): { x: number; y: number; adjusted: boolean; regionLabel?: string | null } {
  if (!layout) return { x, y, adjusted: false };

  const directRegion = getDisplayRegionLabelFromScreenshotPoint(x, y, layout);
  if (directRegion && directRegion !== 'padding') {
    return { x, y, adjusted: false, regionLabel: directRegion };
  }

  let bestCandidate: { x: number; y: number; distance: number; regionLabel: string | null } | null = null;
  for (const [index, region] of layout.displayRegions.entries()) {
    const snappedX = Math.min(Math.max(x, region.left), region.left + region.width);
    const snappedY = Math.min(Math.max(y, region.top), region.top + region.height);
    const distance = Math.hypot(snappedX - x, snappedY - y);
    const regionLabel = `monitor ${index + 1} (display ${region.displayId})`;
    if (!bestCandidate || distance < bestCandidate.distance) {
      bestCandidate = { x: snappedX, y: snappedY, distance, regionLabel };
    }
  }

  if (bestCandidate && bestCandidate.distance <= tolerance) {
    return { x: bestCandidate.x, y: bestCandidate.y, adjusted: true, regionLabel: bestCandidate.regionLabel };
  }
  return { x, y, adjusted: false, regionLabel: directRegion };
}

export function snapPointToStructuredElement(params: {
  x: number;
  y: number;
  elements: UIElement[];
  mapRect: (rect: Rect) => Rect | null;
  tolerance?: number;
}): { x: number; y: number; element: UIElement; reason: 'inside' | 'near' } | null {
  const { x, y, elements, mapRect, tolerance = 40 } = params;
  if (elements.length === 0) return null;

  const candidates = elements
    .filter((element) => element.isEnabled !== false)
    .map((element) => buildElementCandidate({ element, x, y, mapRect }))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .filter((candidate) => candidate.contains || candidate.distance <= tolerance)
    .sort((a, b) => {
      if (a.contains !== b.contains) return a.contains ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (Math.abs(a.distance - b.distance) > 0.5) return a.distance - b.distance;
      return a.area - b.area;
    });

  const best = candidates[0];
  if (!best) return null;
  return {
    x: best.rect.x + (best.rect.width / 2),
    y: best.rect.y + (best.rect.height / 2),
    element: best.element,
    reason: best.contains ? 'inside' : 'near',
  };
}

function buildElementCandidate(params: {
  element: UIElement;
  x: number;
  y: number;
  mapRect: (rect: Rect) => Rect | null;
}) {
  const rect = params.mapRect(params.element.boundingRect);
  if (!rect) return null;
  const contains = params.x >= rect.x && params.x <= (rect.x + rect.width)
    && params.y >= rect.y && params.y <= (rect.y + rect.height);
  const distance = getPointDistanceToRect(params.x, params.y, rect);
  return {
    element: params.element,
    rect,
    contains,
    distance,
    area: rect.width * rect.height,
    priority: getUIElementPriority(params.element.controlType),
  };
}

function getPointDistanceToRect(x: number, y: number, rect: Rect): number {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.width));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function getUIElementPriority(controlType: string): number {
  const priorities: Record<string, number> = { Button: 100, Edit: 95, TextBox: 95, ComboBox: 90, MenuItem: 85, TabItem: 85, CheckBox: 82, RadioButton: 82, Hyperlink: 80, ListItem: 76, TreeItem: 76, DataItem: 68, Document: 10 };
  return priorities[controlType] ?? 40;
}
