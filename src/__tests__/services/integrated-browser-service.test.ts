import { beforeEach, describe, expect, it, vi } from 'vitest';
import { integratedBrowserService, type IntegratedBrowserApi } from '../../services/integrated-browser-service';

describe('wrapper renderer del navegador integrado', () => {
  let api: IntegratedBrowserApi;

  beforeEach(() => {
    api = {
      getState: vi.fn(async () => ({ success: true })),
      captureVisible: vi.fn(async () => ({ success: true, screenshot: 'data:image/png;base64,captura' })),
      getObservation: vi.fn(async () => ({ success: true, observation: null, observationStatus: { enabled: true, capturing: false, intervalMs: 10_000, lastCapturedAt: null, lastError: null } })),
      setObservationEnabled: vi.fn(async (enabled) => ({ success: true, observation: null, observationStatus: { enabled, capturing: false, intervalMs: 10_000, lastCapturedAt: null, lastError: null } })),
      open: vi.fn(async () => ({ success: true })),
      navigate: vi.fn(async () => ({ success: true })),
      clickElement: vi.fn(async () => ({ success: true })),
      typeInElement: vi.fn(async () => ({ success: true })),
      scrollView: vi.fn(async () => ({ success: true })),
      createTab: vi.fn(async () => ({ success: true })),
      closeTab: vi.fn(async () => ({ success: true })),
      activateTab: vi.fn(async () => ({ success: true })),
      detachTab: vi.fn(async () => ({ success: true })),
      reattachTab: vi.fn(async () => ({ success: true })),
      setViewMode: vi.fn(async () => ({ success: true })),
      goBack: vi.fn(async () => ({ success: true })),
      goForward: vi.fn(async () => ({ success: true })),
      reload: vi.fn(async () => ({ success: true })),
      stop: vi.fn(async () => ({ success: true })),
      focus: vi.fn(async () => ({ success: true })),
      setViewport: vi.fn(async () => ({ success: true })),
      hide: vi.fn(async () => ({ success: true })),
      listHistory: vi.fn(async () => ({ success: true, history: [] })),
      clearHistory: vi.fn(async () => ({ success: true, cleared: true })),
      listCredentials: vi.fn(async () => ({ success: true, credentials: [] })),
      saveCredential: vi.fn(async () => ({ success: true })),
      fillCredential: vi.fn(async () => ({ success: true })),
      removeCredential: vi.fn(async () => ({ success: true, removed: true })),
      listExtensions: vi.fn(async () => ({ success: true, extensions: [] })),
      installExtension: vi.fn(async () => ({ success: true, canceled: true })),
      confirmExtensionInstall: vi.fn(async () => ({ success: true })),
      setExtensionEnabled: vi.fn(async () => ({ success: true })),
      removeExtension: vi.fn(async () => ({ success: true, removed: true })),
      onStateChanged: vi.fn(() => vi.fn()),
      onOpenRequested: vi.fn(() => vi.fn()),
    };
    Object.defineProperty(window, 'integratedBrowser', { value: api, configurable: true, writable: true });
  });

  it('delega navegacion y viewport con tipos cerrados', async () => {
    await integratedBrowserService.captureVisible();
    await integratedBrowserService.getObservation(true);
    await integratedBrowserService.setObservationEnabled(false);
    await integratedBrowserService.navigate('example.com');
    await integratedBrowserService.createTab('https://example.com/otra');
    await integratedBrowserService.activateTab('tab-1');
    await integratedBrowserService.detachTab('tab-1');
    await integratedBrowserService.reattachTab('tab-1');
    await integratedBrowserService.setViewMode('split', 'tab-2');
    await integratedBrowserService.closeTab('tab-2');
    await integratedBrowserService.setViewport({ x: 200, y: 80, width: 800, height: 600 });
    expect(api.navigate).toHaveBeenCalledWith('example.com');
    expect(api.createTab).toHaveBeenCalledWith('https://example.com/otra');
    expect(api.activateTab).toHaveBeenCalledWith('tab-1');
    expect(api.detachTab).toHaveBeenCalledWith('tab-1');
    expect(api.reattachTab).toHaveBeenCalledWith('tab-1');
    expect(api.setViewMode).toHaveBeenCalledWith('split', 'tab-2');
    expect(api.closeTab).toHaveBeenCalledWith('tab-2');
    expect(api.captureVisible).toHaveBeenCalled();
    expect(api.getObservation).toHaveBeenCalledWith(true);
    expect(api.setObservationEnabled).toHaveBeenCalledWith(false);
    expect(api.setViewport).toHaveBeenCalledWith({ x: 200, y: 80, width: 800, height: 600 });
  });

  it('suscribe y libera listeners individualmente', () => {
    const stateCleanup = vi.fn();
    const openCleanup = vi.fn();
    vi.mocked(api.onStateChanged).mockReturnValue(stateCleanup);
    vi.mocked(api.onOpenRequested).mockReturnValue(openCleanup);
    const unsubscribe = integratedBrowserService.subscribe({ onStateChanged: vi.fn(), onOpenRequested: vi.fn() });
    unsubscribe();
    expect(stateCleanup).toHaveBeenCalled();
    expect(openCleanup).toHaveBeenCalled();
  });

  it('delega historial, boveda y extensiones sin reinterpretar secretos', async () => {
    await integratedBrowserService.listHistory('reporte', 20);
    await integratedBrowserService.saveCredential({ username: 'persona@example.com', password: 'secreto' });
    await integratedBrowserService.setExtensionEnabled('extension-id', false);
    await integratedBrowserService.confirmExtensionInstall('install-token');
    expect(api.listHistory).toHaveBeenCalledWith('reporte', 20);
    expect(api.saveCredential).toHaveBeenCalledWith({ username: 'persona@example.com', password: 'secreto' });
    expect(api.setExtensionEnabled).toHaveBeenCalledWith('extension-id', false);
    expect(api.confirmExtensionInstall).toHaveBeenCalledWith('install-token');
  });
});
