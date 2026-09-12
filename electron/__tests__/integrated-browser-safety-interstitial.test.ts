import { describe, expect, it, vi } from 'vitest';
import { BrowserWindow, WebContentsView } from 'electron';
import { BrowserSafetyInterstitials, interstitialDocument, type BrowserSafetyPresentation } from '../integrated-browser/safety-interstitial';

const harness = WebContentsView as unknown as { instances: WebContentsView[] };
const blocked = { action: 'block' as const, source: 'remote' as const, reason: 'Bloqueo revisado.', checkedAt: '2026-09-08T00:00:00.000Z' };
function fixture() {
  const parent = new BrowserWindow(); const manager = new BrowserSafetyInterstitials();
  const input: BrowserSafetyPresentation = { parent, bounds: { x: 20, y: 70, width: 600, height: 400 }, verdict: blocked, isCurrent: () => true, openBlank: vi.fn(async () => undefined), close: vi.fn() };
  manager.show('tab', input); const view = harness.instances[harness.instances.length - 1];
  return { parent, manager, input, view };
}
describe('Pantalla nativa de bloqueo', () => {
  it('escapa texto y ofrece sólo salidas seguras sin scripts, formularios ni bypass', () => {
    const html = decodeURIComponent(interstitialDocument({ ...blocked, reason: '<script>alert(1)</script><img src="https://evil.example">' }).split(',')[1]);
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain("default-src 'none'"); expect(html).toContain('https://browser-safety.invalid/blank'); expect(html).toContain('https://browser-safety.invalid/close');
    expect(html).not.toContain('<form');
  });
  it('aísla la sesión y restringe navegación, popups y red', () => {
    const f = fixture();
    expect((f.view as unknown as { options: unknown }).options).toMatchObject({ webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, javascript: false, devTools: false, partition: expect.stringMatching(/^browser-safety-/) } });
    const callback = vi.fn();
    const requestMock = f.view.webContents.session.webRequest.onBeforeRequest as unknown as ReturnType<typeof vi.fn>;
    const listener = requestMock.mock.calls[0][1] as (details: unknown, callback: (result: { cancel: boolean }) => void) => void;
    listener({} as never, callback); expect(callback).toHaveBeenCalledWith({ cancel: true });
    const preventDefault = vi.fn(); f.view.webContents.emit('will-navigate', { url: 'https://evil.example/', preventDefault });
    expect(preventDefault).toHaveBeenCalled(); expect(f.input.close).not.toHaveBeenCalled(); expect(f.input.openBlank).not.toHaveBeenCalled();
    f.manager.clear();
  });
  it('rechaza acciones obsoletas y ejecuta una única acción incluso con clic repetido', async () => {
    const f = fixture(); let complete!: () => void;
    vi.mocked(f.input.openBlank).mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    const event = { url: 'https://browser-safety.invalid/blank', preventDefault: vi.fn() };
    f.view.webContents.emit('will-navigate', event); f.view.webContents.emit('will-navigate', event);
    await Promise.resolve(); expect(f.input.openBlank).toHaveBeenCalledTimes(1); complete();
    f.manager.remove('tab'); f.view.webContents.emit('will-navigate', { ...event, url: 'https://browser-safety.invalid/close' });
    await Promise.resolve(); expect(f.input.close).not.toHaveBeenCalled();
    expect(f.parent.contentView.removeChildView).toHaveBeenCalledWith(f.view);
  });
  it('no ejecuta una salida pendiente cuando se reemplaza el contexto del aviso', async () => {
    const f = fixture();
    f.view.webContents.emit('will-navigate', { url: 'https://browser-safety.invalid/blank', preventDefault: vi.fn() });
    f.manager.show('tab', { ...f.input, verdict: { ...blocked, reason: 'Nuevo bloqueo.' } });
    await Promise.resolve(); expect(f.input.openBlank).not.toHaveBeenCalled(); f.manager.clear();
  });
  it('reutiliza la superficie, actualiza límites y retira listeners al cerrar', () => {
    const f = fixture(); const count = harness.instances.length;
    f.manager.show('tab', { ...f.input, bounds: { x: 0, y: 0, width: 200, height: 100 }, fillWindow: true });
    expect(harness.instances).toHaveLength(count); expect(f.view.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 200, height: 100 });
    f.parent.emit('resize'); expect(f.view.setBounds).toHaveBeenLastCalledWith(expect.objectContaining({ x: 0, y: 0 }));
    f.manager.clear(); expect(f.parent.listenerCount('resize')).toBe(0); expect(f.view.webContents.close).toHaveBeenCalledTimes(1);
    f.manager.clear(); expect(f.view.webContents.close).toHaveBeenCalledTimes(1);
  });
});
