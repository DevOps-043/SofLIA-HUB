import type { Rectangle, WebContents } from 'electron';
import { clampBrowserZoomFactor } from './page-tools';

const emulatedContents = new WeakSet<WebContents>();
const appliedEmulation = new WeakMap<WebContents, { zoom: number; width: number; height: number }>();

/** Una recarga puede conservar URL y tamaño, pero reemplaza la superficie. */
export function invalidateBrowserTabZoom(contents: WebContents): void {
  appliedEmulation.delete(contents);
}

export function supportsIsolatedBrowserZoom(contents: WebContents): boolean {
  return typeof (contents as WebContents & { setZoomMode?: unknown }).setZoomMode === 'function';
}

/** Fallback por superficie: no modifica CSS del sitio ni separa sus cookies. */
export function applyBrowserTabZoom(contents: WebContents, factor: number, bounds: Pick<Rectangle, 'width' | 'height'> | null): void {
  const zoom = clampBrowserZoomFactor(factor);
  // Electron 43 desreferencia la vista nativa sin comprobar que exista en
  // enable/disableDeviceEmulation. Antes de la primera carga o tras un crash
  // esa vista puede faltar: no es una excepción JS que pueda capturar try/catch.
  // El servicio vuelve a aplicar el último factor en did-stop-loading.
  if (contents.isDestroyed() || contents.isCrashed() || !contents.getURL() || contents.isLoadingMainFrame()) {
    invalidateBrowserTabZoom(contents);
    return;
  }
  const native = contents as WebContents & { setZoomMode?: (mode: 'isolated') => void };
  if (typeof native.setZoomMode === 'function') {
    native.setZoomMode('isolated');
    if (contents.getZoomFactor() !== zoom) contents.setZoomFactor(zoom);
    return;
  }
  // Todos los WebContents de este fallback comparten base uno; el factor local
  // vive en la emulación y nunca se vuelve a leer del mapa Chromium por origen.
  if (contents.getZoomFactor() !== 1) contents.setZoomFactor(1);
  if (zoom === 1) {
    if (emulatedContents.has(contents)) {
      contents.disableDeviceEmulation();
      emulatedContents.delete(contents);
      appliedEmulation.delete(contents);
    }
    return;
  }
  if (!bounds || bounds.width < 1 || bounds.height < 1) return;
  const width = Math.max(1, Math.round(bounds.width / zoom));
  const height = Math.max(1, Math.round(bounds.height / zoom));
  const previous = appliedEmulation.get(contents);
  if (previous?.zoom === zoom && previous.width === width && previous.height === height) return;
  contents.enableDeviceEmulation({
    screenPosition: 'desktop', screenSize: { width: 0, height: 0 }, viewPosition: { x: 0, y: 0 },
    deviceScaleFactor: 0, viewSize: { width, height }, scale: zoom,
  });
  emulatedContents.add(contents);
  appliedEmulation.set(contents, { zoom, width, height });
}

export function browserDomPoint(contents: WebContents, point: { x: number; y: number }, preferred: number): { x: number; y: number } {
  const zoom = supportsIsolatedBrowserZoom(contents) ? contents.getZoomFactor() : preferred;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('El punto del documento no es válido.');
  return { x: Math.max(0, Math.round(point.x * zoom)), y: Math.max(0, Math.round(point.y * zoom)) };
}
