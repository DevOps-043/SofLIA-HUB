import type { GuidancePoint, GuidanceRect, GuidanceTarget } from '../../src/shared/orb-guidance';

export const GUIDANCE_ORB_SIZE = { width: 208, height: 340 };
const MARGIN = 16;

export function intersectRect(a: GuidanceRect, b: GuidanceRect): GuidanceRect | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

/** Escoge el lado con menor oclusión; los monitores pueden tener origen negativo. */
export function placeOrb(target: GuidanceTarget, area: GuidanceRect, cursor?: GuidancePoint): GuidanceRect {
  const size = { width: Math.min(GUIDANCE_ORB_SIZE.width, area.width), height: Math.min(GUIDANCE_ORB_SIZE.height, area.height) };
  const box = target.rect ?? { ...target.point, width: 1, height: 1 };
  const candidates = [
    { x: box.x + box.width + MARGIN, y: target.point.y - size.height / 2 },
    { x: box.x - size.width - MARGIN, y: target.point.y - size.height / 2 },
    { x: target.point.x - size.width / 2, y: box.y + box.height + MARGIN },
    { x: target.point.x - size.width / 2, y: box.y - size.height - MARGIN },
    { x: area.x + MARGIN, y: area.y + MARGIN },
    { x: area.x + area.width - size.width - MARGIN, y: area.y + MARGIN },
  ].map(point => ({
    x: Math.round(Math.max(area.x, Math.min(area.x + area.width - size.width, point.x))),
    y: Math.round(Math.max(area.y, Math.min(area.y + area.height - size.height, point.y))),
    ...size,
  }));
  const score = (rect: GuidanceRect) => {
    const overlap = intersectRect(rect, box);
    const cursorCovered = cursor && cursor.x >= rect.x && cursor.x <= rect.x + rect.width && cursor.y >= rect.y && cursor.y <= rect.y + rect.height;
    return (overlap ? overlap.width * overlap.height * 1000 : 0) + (cursorCovered ? 100_000 : 0)
      + Math.hypot(rect.x + rect.width / 2 - target.point.x, rect.y + rect.height / 2 - target.point.y);
  };
  return candidates.sort((a, b) => score(a) - score(b))[0];
}

export function targetOnDisplay(target: GuidanceTarget, display: GuidanceRect): GuidanceTarget | null {
  const box = target.rect ? intersectRect(target.rect, display) : null;
  const inside = target.point.x >= display.x && target.point.x <= display.x + display.width
    && target.point.y >= display.y && target.point.y <= display.y + display.height;
  if (!inside && !box) return null;
  return {
    point: { x: target.point.x - display.x, y: target.point.y - display.y },
    ...(box ? { rect: { ...box, x: box.x - display.x, y: box.y - display.y } } : {}),
  };
}
