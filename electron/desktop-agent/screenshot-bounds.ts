import { screen as electronScreen } from 'electron';
import type { ScreenshotVirtualBounds } from './types';

type DisplayLike = { bounds: ScreenshotVirtualBounds };

export function getVirtualDesktopBounds(displays = electronScreen.getAllDisplays()): ScreenshotVirtualBounds {
  if (!displays.length) {
    return { x: 0, y: 0, width: 1920, height: 1080 };
  }

  const displayBounds = (displays as DisplayLike[]).map((display) => display.bounds);
  const minX = Math.min(...displayBounds.map((bounds) => bounds.x));
  const minY = Math.min(...displayBounds.map((bounds) => bounds.y));
  const maxX = Math.max(...displayBounds.map((bounds) => bounds.x + bounds.width));
  const maxY = Math.max(...displayBounds.map((bounds) => bounds.y + bounds.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function intersectBounds(
  a: ScreenshotVirtualBounds,
  b: ScreenshotVirtualBounds,
): ScreenshotVirtualBounds | null {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}
