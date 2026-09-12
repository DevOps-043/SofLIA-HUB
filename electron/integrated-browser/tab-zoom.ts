import type { Rectangle, WebContents } from 'electron';
import { clampBrowserZoomFactor } from './page-tools';

export function supportsIsolatedBrowserZoom(contents: WebContents): boolean {
  return typeof (contents as WebContents & { setZoomMode?: unknown }).setZoomMode === 'function';
}

/** Fallback por superficie: no modifica CSS del sitio ni separa sus cookies. */
export function applyBrowserTabZoom(contents: WebContents, factor: number, bounds: Pick<Rectangle, 'width' | 'height'> | null): void {
  const zoom = clampBrowserZoomFactor(factor);
  const native = contents as WebContents & { setZoomMode?: (mode: 'isolated') => void };
  if (typeof native.setZoomMode === 'function') {
    native.setZoomMode('isolated'); contents.setZoomFactor(zoom); return;
  }
  // Todos los WebContents de este fallback comparten base uno; el factor local
  // vive en la emulación y nunca se vuelve a leer del mapa Chromium por origen.
  if (contents.getZoomFactor() !== 1) contents.setZoomFactor(1);
  if (zoom === 1) { contents.disableDeviceEmulation(); return; }
  if (!bounds || bounds.width < 1 || bounds.height < 1) return;
  contents.enableDeviceEmulation({
    screenPosition: 'desktop', screenSize: { width: 0, height: 0 }, viewPosition: { x: 0, y: 0 },
    deviceScaleFactor: 0, viewSize: { width: Math.max(1, Math.round(bounds.width / zoom)), height: Math.max(1, Math.round(bounds.height / zoom)) }, scale: zoom,
  });
}

export function browserDomPoint(contents: WebContents, point: { x: number; y: number }, preferred: number): { x: number; y: number } {
  const zoom = supportsIsolatedBrowserZoom(contents) ? contents.getZoomFactor() : preferred;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('El punto del documento no es válido.');
  return { x: Math.max(0, Math.round(point.x * zoom)), y: Math.max(0, Math.round(point.y * zoom)) };
}
