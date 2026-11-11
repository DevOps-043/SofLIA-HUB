export interface FloatingBounds { left: number; top: number; width: number; height: number; moved: boolean }
export interface FloatingPoint { left: number; top: number }
const MARGIN = 8;

export function clampFloatingPosition(point: FloatingPoint, panel: { width: number; height: number }, surface: { width: number; height: number }): FloatingPoint {
  return {
    left: Math.max(MARGIN, Math.min(point.left, Math.max(MARGIN, surface.width - panel.width - MARGIN))),
    top: Math.max(MARGIN, Math.min(point.top, Math.max(MARGIN, surface.height - panel.height - MARGIN))),
  };
}

/** WebContentsView sólo admite un rectángulo: conservar el mayor sin cubrir el chat. */
export function floatingBrowserInsets(bounds: FloatingBounds | null, surface: { width: number; height: number }, pageTop: number, reservedRight: number, defaultBottom: number) {
  const base = { left: 0, right: reservedRight, top: 0, bottom: defaultBottom, occluded: false };
  if (!bounds?.moved) return base;
  const width = Math.max(0, surface.width - reservedRight), height = Math.max(0, surface.height - pageTop);
  const left = Math.max(0, bounds.left - MARGIN), right = Math.min(width, bounds.left + bounds.width + MARGIN);
  const top = Math.max(0, bounds.top - pageTop - MARGIN), bottom = Math.min(height, bounds.top + bounds.height - pageTop + MARGIN);
  const candidates = [
    { left: 0, right: reservedRight, top: 0, bottom: height - top, width, height: top },
    { left: 0, right: reservedRight, top: Math.max(0, bottom), bottom: 0, width, height: height - bottom },
    { left: 0, right: reservedRight + width - left, top: 0, bottom: 0, width: left, height },
    { left: right, right: reservedRight, top: 0, bottom: 0, width: width - right, height },
  ].filter(rect => rect.width >= 160 && rect.height >= 120);
  const best = candidates.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  return best ? { left: best.left, right: best.right, top: best.top, bottom: best.bottom, occluded: false } : { ...base, occluded: true };
}
