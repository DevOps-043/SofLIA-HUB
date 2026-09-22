import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, WebContentsView, type WebContents } from 'electron';
import { applyBrowserTabZoom, browserDomPoint } from '../integrated-browser/tab-zoom';
import { IntegratedBrowserService } from '../integrated-browser/service';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const plain = () => {
  const contents = new WebContentsView().webContents;
  Object.defineProperty(contents, 'setZoomMode', { value: undefined, configurable: true });
  return contents;
};
describe('zoom aislado compatible con Electron 43', () => {
  it.each(['nueva', 'cargando', 'caída', 'destruida'] as const)('evita emulación nativa con una vista %s', state => {
    const contents = plain();
    if (state === 'nueva') vi.mocked(contents.getURL).mockReturnValue('');
    if (state === 'cargando') vi.mocked(contents.isLoadingMainFrame).mockReturnValue(true);
    if (state === 'caída') vi.mocked(contents.isCrashed).mockReturnValue(true);
    if (state === 'destruida') vi.mocked(contents.isDestroyed).mockReturnValue(true);
    for (const factor of [1, 2]) applyBrowserTabZoom(contents, factor, { width: 800, height: 600 });
    expect(contents.enableDeviceEmulation).not.toHaveBeenCalled();
    expect(contents.disableDeviceEmulation).not.toHaveBeenCalled();
    expect(contents.setZoomFactor).not.toHaveBeenCalled();
  });
  it('restablecer al 100% solo desactiva una emulación previamente aplicada', () => {
    const contents = plain();
    applyBrowserTabZoom(contents, 1, { width: 800, height: 600 });
    expect(contents.disableDeviceEmulation).not.toHaveBeenCalled();
    applyBrowserTabZoom(contents, 2, { width: 800, height: 600 });
    applyBrowserTabZoom(contents, 1, { width: 800, height: 600 });
    applyBrowserTabZoom(contents, 1, { width: 800, height: 600 });
    expect(contents.disableDeviceEmulation).toHaveBeenCalledTimes(1);
  });
  it('aplica el último zoom pendiente al terminar la navegación', async () => {
    vi.stubEnv('BROWSER_PAGE_TOOLS_ENABLED', 'true');
    const browser = new IntegratedBrowserService(); browser.attachWindow(new BrowserWindow());
    try {
      await browser.open('https://example.com/a');
      const contents = browser.getWebContentsForAgent();
      Object.defineProperty(contents, 'setZoomMode', { value: undefined, configurable: true });
      browser.setViewport({ x: 0, y: 0, width: 800, height: 600 });
      vi.mocked(contents.isLoadingMainFrame).mockReturnValue(true);
      browser.setZoom('in'); browser.setZoom('in');
      browser.setViewport({ x: 0, y: 0, width: 960, height: 600 });
      expect(contents.enableDeviceEmulation).not.toHaveBeenCalled();
      (contents as WebContents & { emit: (name: string) => void }).emit('did-finish-load');
      expect(contents.enableDeviceEmulation).not.toHaveBeenCalled();
      vi.mocked(contents.isLoadingMainFrame).mockReturnValue(false);
      (contents as WebContents & { emit: (name: string) => void }).emit('did-stop-loading');
      expect(contents.enableDeviceEmulation).toHaveBeenLastCalledWith(expect.objectContaining({
        scale: 1.2, viewSize: { width: 800, height: 500 },
      }));
    } finally { browser.detachWindow(); }
  });
  it('nunca instala un zoom Chromium distinto de uno en el fallback', () => {
    const contents = plain(); contents.setZoomFactor(1.4);
    applyBrowserTabZoom(contents, 2, { width: 800, height: 600 });
    expect(contents.setZoomFactor).toHaveBeenLastCalledWith(1);
    expect(contents.enableDeviceEmulation).toHaveBeenCalledWith(expect.objectContaining({ scale: 2, viewSize: { width: 400, height: 300 }, screenPosition: 'desktop', deviceScaleFactor: 0 }));
    applyBrowserTabZoom(contents, 1, null); expect(contents.disableDeviceEmulation).toHaveBeenCalled();
  });
  it('acota factor, espera geometría y convierte coordenadas DOM sin cambiar UA', () => {
    const contents = plain(); applyBrowserTabZoom(contents, 3, null);
    expect(contents.enableDeviceEmulation).not.toHaveBeenCalled();
    applyBrowserTabZoom(contents, 99, { width: 900, height: 600 });
    expect(contents.enableDeviceEmulation).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 3, viewSize: { width: 300, height: 200 } }));
    expect(browserDomPoint(contents, { x: 30, y: 45 }, 2)).toEqual({ x: 60, y: 90 });
    expect(() => applyBrowserTabZoom(contents, NaN, null)).toThrow();
    expect(contents.setUserAgent).not.toHaveBeenCalled();
  });
  it('conserva el camino nativo cuando el runtime declara aislamiento', () => {
    const contents = new WebContentsView().webContents;
    applyBrowserTabZoom(contents, 1.5, { width: 800, height: 600 });
    expect(contents.setZoomFactor).toHaveBeenLastCalledWith(1.5);
    expect(contents.enableDeviceEmulation).not.toHaveBeenCalled();
    expect(browserDomPoint(contents, { x: 40, y: 20 }, 1)).toEqual({ x: 60, y: 30 });
  });
  it('el servicio conserva metadata al alternar, redimensionar y duplicar pestañas', async () => {
    vi.stubEnv('BROWSER_PAGE_TOOLS_ENABLED', 'true');
    const browser = new IntegratedBrowserService(); browser.attachWindow(new BrowserWindow());
    try {
      await browser.open('https://example.com/a');
      const firstId = browser.getState().activeTabId!;
      const first = browser.getWebContentsForAgent();
      Object.defineProperty(first, 'setZoomMode', { value: undefined, configurable: true });
      browser.setViewport({ x: 0, y: 0, width: 800, height: 600 }); browser.setZoom('in');
      expect(browser.getState().tabs[0].zoomFactor).toBe(1.1);
      expect(first.getZoomFactor()).toBe(1);
      await browser.createTab('https://example.com/b', true);
      const second = browser.getWebContentsForAgent();
      Object.defineProperty(second, 'setZoomMode', { value: undefined, configurable: true });
      browser.setZoom('out');
      expect(browser.getState().tabs.map(tab => tab.zoomFactor)).toEqual([1.1, 0.9]);
      browser.activateTab(firstId); browser.setViewport({ x: 0, y: 0, width: 1000, height: 600 });
      expect(first.enableDeviceEmulation).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 1.1, viewSize: { width: Math.round(1000 / 1.1), height: Math.round(600 / 1.1) } }));
      await browser.duplicateTab(firstId);
      const all = browser.getState().tabs;
      expect(all[all.length - 1].zoomFactor).toBe(1.1);
      browser.activateTab(firstId);
      const event = { preventDefault: vi.fn() };
      (first as WebContents & { emit: (name: string, ...args: unknown[]) => void }).emit('before-input-event', event, { type: 'keyDown', control: true, meta: true, key: '0' });
      expect(event.preventDefault).toHaveBeenCalled(); expect(browser.getState().tabs[0].zoomFactor).toBe(1);
    } finally { browser.detachWindow(); }
  });
});
