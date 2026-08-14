import { beforeEach, describe, expect, it, vi } from 'vitest';
import { integratedBrowserService, type IntegratedBrowserApi } from '../../services/integrated-browser-service';

describe('wrapper renderer del navegador integrado', () => {
  let api: IntegratedBrowserApi;

  beforeEach(() => {
    api = {
      getState: vi.fn(async () => ({ success: true })),
      captureVisible: vi.fn(async () => ({ success: true, screenshot: 'data:image/png;base64,captura' })),
    captureFrame: vi.fn(async () => ({ success: true, capture: { ok: true as const, screenshot: 'data:image/jpeg;base64,Y2Y=', capturedAt: '2026-08-13T00:00:00.000Z', url: 'https://example.com/' } })),
    getPlayerState: vi.fn(async () => ({ success: true, player: { hasVideo: false, currentTimeSeconds: null, durationSeconds: null, paused: true, publicVideoUrl: null } })),
    sampleFrames: vi.fn(async () => ({ success: true, frames: [], failure: null })),
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
      toggleDevTools: vi.fn(async () => ({ success: true })),
      setViewport: vi.fn(async () => ({ success: true })),
      hide: vi.fn(async () => ({ success: true })),
      listHistory: vi.fn(async () => ({ success: true, history: [] })),
      clearHistory: vi.fn(async () => ({ success: true, cleared: true })),
      clearBrowsingData: vi.fn(async () => ({ success: true, summary: { range: 'todo' as const, results: [] } })),
      listCredentials: vi.fn(async () => ({ success: true, credentials: [] })),
      saveCredential: vi.fn(async () => ({ success: true })),
      fillCredential: vi.fn(async () => ({ success: true })),
      removeCredential: vi.fn(async () => ({ success: true, removed: true })),
      listExtensions: vi.fn(async () => ({ success: true, extensions: [] })),
      installExtension: vi.fn(async () => ({ success: true, canceled: true })),
      confirmExtensionInstall: vi.fn(async () => ({ success: true })),
      setExtensionEnabled: vi.fn(async () => ({ success: true })),
      removeExtension: vi.fn(async () => ({ success: true, removed: true })),
      getSitePermissions: vi.fn(async () => ({ success: true })),
      setSitePermission: vi.fn(async () => ({ success: true })),
      resetSitePermissions: vi.fn(async () => ({ success: true })),
      getTabSummaries: vi.fn(async () => ({ success: true, summaries: [] })),
      getTabContent: vi.fn(async () => ({ success: true })),
      onStateChanged: vi.fn(() => vi.fn()),
      onOpenRequested: vi.fn(() => vi.fn()),
      onSelectionAction: vi.fn(() => vi.fn()),
      onReadingModeRequested: vi.fn(() => vi.fn()),
      onWritingRequest: vi.fn(() => vi.fn()),
      resolveWriting: vi.fn(async () => ({ success: true })),
      onSitePermissionsChanged: vi.fn(() => vi.fn()),
      decidePermissionPrompt: vi.fn(async () => ({ success: true, resolved: true })),
      onPermissionPrompt: vi.fn(() => vi.fn()),
      prepareReadingMode: vi.fn(async () => ({ success: true })),
      synthesizeReadingSegment: vi.fn(async () => ({ success: true })),
      cancelReadingSpeech: vi.fn(async () => ({ success: true })),
      highlightReadingRange: vi.fn(async () => ({ success: true })),
      waitForReadingToolbarAction: vi.fn(async () => ({ success: true, toolbarAction: { readingId: 'reading-id', action: 'toggle' as const } })),
      syncReadingToolbar: vi.fn(async () => ({ success: true, toolbarVisible: true })),
      closeReadingMode: vi.fn(async () => ({ success: true })),
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
    await integratedBrowserService.prepareReadingMode({ sourceUrl: 'https://example.com', selection: 'Texto' });
    await integratedBrowserService.synthesizeReadingSegment({ readingId: 'reading-id', requestId: 'request-id', start: 0, end: 5 });
    await integratedBrowserService.highlightReadingRange({ readingId: 'reading-id', start: 0, end: 5 });
    await integratedBrowserService.waitForReadingToolbarAction({ readingId: 'reading-id' });
    await integratedBrowserService.syncReadingToolbar({ readingId: 'reading-id', status: 'playing', speed: 1 });
    await integratedBrowserService.cancelReadingSpeech({ readingId: 'reading-id', requestId: 'request-id' });
    await integratedBrowserService.closeReadingMode({ readingId: 'reading-id' });
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
    expect(api.prepareReadingMode).toHaveBeenCalledWith({ sourceUrl: 'https://example.com', selection: 'Texto' });
    expect(api.synthesizeReadingSegment).toHaveBeenCalledWith({ readingId: 'reading-id', requestId: 'request-id', start: 0, end: 5 });
    expect(api.highlightReadingRange).toHaveBeenCalledWith({ readingId: 'reading-id', start: 0, end: 5 });
    expect(api.waitForReadingToolbarAction).toHaveBeenCalledWith({ readingId: 'reading-id' });
    expect(api.syncReadingToolbar).toHaveBeenCalledWith({ readingId: 'reading-id', status: 'playing', speed: 1 });
    expect(api.cancelReadingSpeech).toHaveBeenCalledWith({ readingId: 'reading-id', requestId: 'request-id' });
    expect(api.closeReadingMode).toHaveBeenCalledWith({ readingId: 'reading-id' });
  });

  it('suscribe y libera listeners individualmente', () => {
    const stateCleanup = vi.fn();
    const openCleanup = vi.fn();
    const readingCleanup = vi.fn();
    vi.mocked(api.onStateChanged).mockReturnValue(stateCleanup);
    vi.mocked(api.onOpenRequested).mockReturnValue(openCleanup);
    vi.mocked(api.onReadingModeRequested).mockReturnValue(readingCleanup);
    const unsubscribe = integratedBrowserService.subscribe({ onStateChanged: vi.fn(), onOpenRequested: vi.fn(), onReadingModeRequested: vi.fn() });
    unsubscribe();
    expect(stateCleanup).toHaveBeenCalled();
    expect(openCleanup).toHaveBeenCalled();
    expect(readingCleanup).toHaveBeenCalled();
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
