import { beforeEach, describe, expect, it, vi } from 'vitest';
import { integratedBrowserService, type IntegratedBrowserApi } from '../../services/integrated-browser-service';

describe('wrapper renderer del navegador integrado', () => {
  let api: IntegratedBrowserApi;
  it('delega recuperación sin archivos ni concesiones', async () => {
    const input = { store: 'privacy' as const, profileRevision: 2 };
    await integratedBrowserService.recoverPolicyStore(input); expect(api.recoverPolicyStore).toHaveBeenCalledWith(input);
  });
  it('catálogo transporta sólo ids a revisión, sin rutas ni aprobación', async () => {
    const request = { action: 'prepare' as const, catalogId: 'chrome-reading-time', updateInstallId: 'a'.repeat(32) };
    await integratedBrowserService.extensionCatalog(request);
    expect(api.extensionCatalog).toHaveBeenCalledWith(request);
  });
  it('desbloqueo sólo transporta acción y recibo de perfil, no aprobación', async () => {
    const request = { action: 'unlock' as const, profileRevision: 7 };
    await integratedBrowserService.credentialSessionCommand(request);
    expect(api.credentialSessionCommand).toHaveBeenCalledWith(request);
  });
  it('delega memoria sin conceder consentimiento ni aceptar rutas', async () => {
    const request = { action: 'search' as const, query: 'consulta', profileRevision: 7 };
    await integratedBrowserService.semanticMemoryCommand(request);
    expect(api.semanticMemoryCommand).toHaveBeenCalledWith(request);
  });
  it('delega supervisión sin ampliar el comando ni cambiar identidad', async () => {
    const request = { action: 'pause' as const, taskId: 'browser-cu-id', taskRevision: 1, profileRevision: 5 };
    await integratedBrowserService.controlAgentTask(request);
    expect(api.controlAgentTask).toHaveBeenCalledWith(request);
  });
  it('delega atajos con el recibo del perfil y revisión', async () => {
    const request = { action: 'list' as const, profileRevision: 7 };
    await integratedBrowserService.agentShortcuts(request);
    expect(api.agentShortcuts).toHaveBeenCalledWith(request);
  });
  it('delega la lectura ligada al documento sin modificar el recibo', async () => {
    const expected = { profileRevision: 4, documentToken: 'a'.repeat(36) };
    await integratedBrowserService.getTabContent('tab', expected);
    expect(api.getTabContent).toHaveBeenCalledWith('tab', expected);
    await integratedBrowserService.getTabContent('tab');
    expect(api.getTabContent).toHaveBeenLastCalledWith('tab');
  });
  it('delega el control sync como DTO único sin claves ni autorización adicional', async () => {
    const request = { action: 'configure' as const, categories: ['bookmarks' as const] };
    await integratedBrowserService.controlSync(request);
    expect(api.controlSync).toHaveBeenCalledWith(request);
  });
  it('delega dispositivos sin inventar autorización ni enviar credenciales', async () => {
    await integratedBrowserService.getSyncDevices(); await integratedBrowserService.registerSyncDevice();
    await integratedBrowserService.revokeSyncDevice('id-opaco'); await integratedBrowserService.cancelSyncOperation();
    expect(api.getSyncDevices).toHaveBeenCalledWith(); expect(api.registerSyncDevice).toHaveBeenCalledWith();
    expect(api.revokeSyncDevice).toHaveBeenCalledWith('id-opaco'); expect(api.cancelSyncOperation).toHaveBeenCalledWith();
  });

  beforeEach(() => {
    api = {
      getState: vi.fn(async () => ({ success: true })),
      getRuntimeDiagnostic: vi.fn(async () => ({ success: true })),
      agentShortcuts: vi.fn(async () => ({ success: true })),
      semanticMemoryCommand: vi.fn(async () => ({ success: true })),
      credentialSessionCommand: vi.fn(async () => ({ success: true })),
      controlAgentTask: vi.fn(async () => ({ success: true })),
      getSyncDevices: vi.fn(async () => ({ success: true })),
      controlSync: vi.fn(async () => ({ success: true })),
      registerSyncDevice: vi.fn(async () => ({ success: true })),
      revokeSyncDevice: vi.fn(async () => ({ success: true })),
      cancelSyncOperation: vi.fn(async () => ({ success: true })),
      exportRuntimeDiagnostic: vi.fn(async () => ({ success: true, diagnosticExport: { cancelled: false, exported: true } })),
      restorePreviousSession: vi.fn(async () => ({ success: true })),
      discardPreviousSession: vi.fn(async () => ({ success: true })),
      captureVisible: vi.fn(async () => ({ success: true, screenshot: 'data:image/png;base64,captura' })),
      getObservation: vi.fn(async () => ({ success: true, observation: null, observationStatus: { enabled: true, capturing: false, intervalMs: 10_000, lastCapturedAt: null, lastError: null } })),
      setObservationEnabled: vi.fn(async (enabled) => ({ success: true, observation: null, observationStatus: { enabled, capturing: false, intervalMs: 10_000, lastCapturedAt: null, lastError: null } })),
      open: vi.fn(async () => ({ success: true })),
      navigate: vi.fn(async () => ({ success: true })),
      findInPage: vi.fn(async () => ({ success: true })),
      stopFindInPage: vi.fn(async () => ({ success: true })),
      setZoom: vi.fn(async () => ({ success: true })),
      setMuted: vi.fn(async () => ({ success: true })),
      toggleFullscreen: vi.fn(async () => ({ success: true })),
      printPage: vi.fn(async () => ({ success: true })),
      savePageAsPdf: vi.fn(async () => ({ success: true, filename: 'Página.pdf' })),
      listDownloads: vi.fn(async () => ({ success: true, downloads: [] })),
      cancelDownload: vi.fn(async () => ({ success: true })),
      resumeDownload: vi.fn(async () => ({ success: true })),
      retryDownload: vi.fn(async () => ({ success: true })),
      openDownload: vi.fn(async () => ({ success: true, opened: true })),
      revealDownload: vi.fn(async () => ({ success: true, revealed: true })),
      clickElement: vi.fn(async () => ({ success: true })),
      typeInElement: vi.fn(async () => ({ success: true })),
      scrollView: vi.fn(async () => ({ success: true })),
      createTab: vi.fn(async () => ({ success: true })),
      closeTab: vi.fn(async () => ({ success: true })),
      duplicateTab: vi.fn(async () => ({ success: true })),
      reopenClosedTab: vi.fn(async () => ({ success: true })),
      closeOtherTabs: vi.fn(async () => ({ success: true })),
      closeTabsToRight: vi.fn(async () => ({ success: true })),
      setTabPinned: vi.fn(async () => ({ success: true })),
      setTabLayout: vi.fn(async () => ({ success: true })),
      createTabGroup: vi.fn(async () => ({ success: true, group: { id: 'group-1', name: 'Trabajo', color: 'blue' as const, collapsed: false } })),
      assignTabGroup: vi.fn(async () => ({ success: true })),
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
      readActiveDocument: vi.fn(async () => ({ success: true, document: { tabId: 'tab-1', url: 'https://docs.google.com/document/d/1/edit', title: 'Documento', language: 'es', text: 'Contenido', truncated: false } })),
      listHistory: vi.fn(async () => ({ success: true, history: [] })),
      importHistory: vi.fn(async () => ({ success: true, historyTransfer: { cancelled: false, imported: 0, skipped: 0, duplicates: 0, invalid: 0 } })),
      getProfile: vi.fn(async () => ({ success: true, profile: { id: 'guest', kind: 'guest' as const, label: 'Invitado', persistent: false, managed: false } })),
      setProfile: vi.fn(async (kind: 'authenticated' | 'guest' | 'private') => ({ success: true, profile: { id: kind, kind, label: kind, persistent: kind === 'authenticated', managed: false } })),
      listRecentlyClosedTabs: vi.fn(async () => ({ success: true, recentlyClosedTabs: [] })),
      getHistoryRetention: vi.fn(async () => ({ success: true, historyRetention: { days: null, managed: false } })),
      setHistoryRetention: vi.fn(async (days) => ({ success: true, historyRetention: { days, managed: false, removed: 0 } })),
      listBookmarks: vi.fn(async () => ({ success: true, bookmarks: [] })),
      saveBookmark: vi.fn(async () => ({ success: true })),
      removeBookmark: vi.fn(async () => ({ success: true, removed: true })),
      migrateLegacyBookmarks: vi.fn(async () => ({ success: true, migration: { imported: 0, skipped: 0 } })),
      importBookmarksHtml: vi.fn(async () => ({ success: true, bookmarkTransfer: { cancelled: false, imported: 0, skipped: 0 } })),
      recoverBookmarks: vi.fn(async () => ({ success: true, bookmarkRecovery: { cancelled: false, restored: 2 } })),
      recoverPolicyStore: vi.fn(async () => ({ success: true, cancelled: false, restored: 1 })),
      exportBookmarksHtml: vi.fn(async () => ({ success: true, bookmarkTransfer: { cancelled: false, exported: 0 } })),
      getAgentPolicy: vi.fn(async () => ({ success: true, agentPolicy: { origin: 'https://example.com', mode: 'balanced' as const, decision: 'ask' as const, managed: false, updatedAt: new Date(0).toISOString() } })),
      setAgentPolicy: vi.fn(async () => ({ success: true })),
      decideAgentPolicy: vi.fn(async () => ({ success: true, resolved: true })),
      getPrivacySite: vi.fn(async () => ({ success: true, privacySite: { origin: 'https://example.com', level: 'balanced' as const, blocked: {}, exceptionCategories: [], degraded: false } })),
      setPrivacySite: vi.fn(async () => ({ success: true })),
      clearHistory: vi.fn(async () => ({ success: true, cleared: true })),
      clearBrowsingData: vi.fn(async () => ({ success: true, summary: { range: 'todo' as const, results: [] } })),
      listCredentials: vi.fn(async () => ({ success: true, credentials: [] })),
      setCredentialAutosave: vi.fn(async (enabled) => ({ success: true, canceled: false, credentialAutosaveEnabled: enabled })),
      analyzeCredentialHealth: vi.fn(async () => ({ success: true, credentialHealth: [] })),
      importCredentials: vi.fn(async () => ({ success: true, cancelled: false, imported: 0, updated: 0, skipped: 0 })),
      exportCredentials: vi.fn(async () => ({ success: true, cancelled: false, exported: 0 })),
      recoverCredentials: vi.fn(async () => ({ success: true, credentialRecovery: { cancelled: false, restored: 1 } })),
      agentAudit: vi.fn(async () => ({ success: true })),
      saveCredential: vi.fn(async () => ({ success: true })),
      fillCredential: vi.fn(async () => ({ success: true })),
      removeCredential: vi.fn(async () => ({ success: true, removed: true })),
      listExtensions: vi.fn(async () => ({ success: true, extensions: [] })),
      extensionCatalog: vi.fn(async () => ({ success: true, catalog: [] })),
      restrictExtensionSites: vi.fn(async () => ({ success: true })),
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
      onDownloadsChanged: vi.fn(() => vi.fn()),
      onFindRequested: vi.fn(() => vi.fn()),
      onOpenRequested: vi.fn(() => vi.fn()),
      onSelectionAction: vi.fn(() => vi.fn()),
      onReadingModeRequested: vi.fn(() => vi.fn()),
      onWritingRequest: vi.fn(() => vi.fn()),
      resolveWriting: vi.fn(async () => ({ success: true })),
      onSitePermissionsChanged: vi.fn(() => vi.fn()),
      decidePermissionPrompt: vi.fn(async () => ({ success: true, resolved: true })),
      onPermissionPrompt: vi.fn(() => vi.fn()),
      onAgentPolicyPrompt: vi.fn(() => vi.fn()),
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

  it('conserva resumen, cancelación y error de importación sin fabricar éxito', async () => {
    const summary = { cancelled: false, imported: 1, updated: 2, skipped: 3, invalid: 1, duplicates: 2 };
    vi.mocked(api.importBookmarksHtml).mockResolvedValueOnce({ success: true, bookmarkTransfer: summary })
      .mockResolvedValueOnce({ success: true, bookmarkTransfer: { cancelled: true } })
      .mockResolvedValueOnce({ success: false, error: 'La revisión venció.' });
    expect(await integratedBrowserService.importBookmarksHtml()).toEqual({ success: true, bookmarkTransfer: summary });
    expect(await integratedBrowserService.importBookmarksHtml()).toEqual({ success: true, bookmarkTransfer: { cancelled: true } });
    expect(await integratedBrowserService.importBookmarksHtml()).toEqual({ success: false, error: 'La revisión venció.' });
    expect(api.importBookmarksHtml).toHaveBeenCalledWith();
  });

  it('delega acciones cerradas de bitácora y conserva cancelación', async () => {
    vi.mocked(api.agentAudit).mockResolvedValueOnce({ success: true, auditChange: { cancelled: true } });
    expect(await integratedBrowserService.agentAudit({ action: 'clear' })).toEqual({ success: true, auditChange: { cancelled: true } });
    expect(api.agentAudit).toHaveBeenCalledWith({ action: 'clear' });
  });

  it('delega recuperación sin argumentos y conserva cancelación y fallo', async () => {
    vi.mocked(api.recoverBookmarks).mockResolvedValueOnce({ success: true, bookmarkRecovery: { cancelled: true, restored: 0 } })
      .mockResolvedValueOnce({ success: false, error: 'Respaldo inválido.' });
    expect(await integratedBrowserService.recoverBookmarks()).toEqual({ success: true, bookmarkRecovery: { cancelled: true, restored: 0 } });
    expect(await integratedBrowserService.recoverBookmarks()).toEqual({ success: false, error: 'Respaldo inválido.' });
    expect(api.recoverBookmarks).toHaveBeenCalledWith();
  });

  it('delega recuperación de contraseñas sin argumentos y conserva cancelación y fallo', async () => {
    vi.mocked(api.recoverCredentials).mockResolvedValueOnce({ success: true, credentialRecovery: { cancelled: true, restored: 0 } })
      .mockResolvedValueOnce({ success: false, error: 'Respaldo inválido.' });
    expect(await integratedBrowserService.recoverCredentials()).toEqual({ success: true, credentialRecovery: { cancelled: true, restored: 0 } });
    expect(await integratedBrowserService.recoverCredentials()).toEqual({ success: false, error: 'Respaldo inválido.' });
    expect(api.recoverCredentials).toHaveBeenCalledWith();
  });

  it('delega la importación de historial sin aceptar datos desde renderer', async () => {
    const summary = { cancelled: false, imported: 3, skipped: 1, duplicates: 2, invalid: 1 };
    vi.mocked(api.importHistory).mockResolvedValueOnce({ success: true, historyTransfer: summary });
    expect(await integratedBrowserService.importHistory()).toEqual({ success: true, historyTransfer: summary });
    expect(api.importHistory).toHaveBeenCalledWith();
  });

  it('delega navegacion y viewport con tipos cerrados', async () => {
    await integratedBrowserService.captureVisible();
    await integratedBrowserService.getObservation(true);
    await integratedBrowserService.setObservationEnabled(false);
    await integratedBrowserService.navigate('example.com');
    await integratedBrowserService.findInPage('texto', false);
    await integratedBrowserService.stopFindInPage();
    await integratedBrowserService.setZoom('in');
    await integratedBrowserService.setMuted(true);
    await integratedBrowserService.toggleFullscreen();
    await integratedBrowserService.printPage();
    await integratedBrowserService.savePageAsPdf();
    await integratedBrowserService.createTab('https://example.com/otra');
    await integratedBrowserService.activateTab('tab-1');
    await integratedBrowserService.detachTab('tab-1');
    await integratedBrowserService.reattachTab('tab-1');
    await integratedBrowserService.setViewMode('split', 'tab-2');
    await integratedBrowserService.closeTab('tab-2');
    await integratedBrowserService.readActiveDocument();
    await integratedBrowserService.prepareReadingMode({ sourceUrl: 'https://example.com', selection: 'Texto' });
    await integratedBrowserService.synthesizeReadingSegment({ readingId: 'reading-id', requestId: 'request-id', start: 0, end: 5 });
    await integratedBrowserService.highlightReadingRange({ readingId: 'reading-id', start: 0, end: 5 });
    await integratedBrowserService.waitForReadingToolbarAction({ readingId: 'reading-id' });
    await integratedBrowserService.syncReadingToolbar({ readingId: 'reading-id', status: 'playing', speed: 1 });
    await integratedBrowserService.cancelReadingSpeech({ readingId: 'reading-id', requestId: 'request-id' });
    await integratedBrowserService.closeReadingMode({ readingId: 'reading-id' });
    await integratedBrowserService.setViewport({ x: 200, y: 80, width: 800, height: 600 });
    expect(api.navigate).toHaveBeenCalledWith('example.com');
    expect(api.findInPage).toHaveBeenCalledWith('texto', false);
    expect(api.stopFindInPage).toHaveBeenCalled();
    expect(api.setZoom).toHaveBeenCalledWith('in');
    expect(api.setMuted).toHaveBeenCalledWith(true);
    expect(api.toggleFullscreen).toHaveBeenCalled();
    expect(api.printPage).toHaveBeenCalled();
    expect(api.savePageAsPdf).toHaveBeenCalled();
    expect(api.createTab).toHaveBeenCalledWith('https://example.com/otra');
    expect(api.activateTab).toHaveBeenCalledWith('tab-1');
    expect(api.detachTab).toHaveBeenCalledWith('tab-1');
    expect(api.reattachTab).toHaveBeenCalledWith('tab-1');
    expect(api.setViewMode).toHaveBeenCalledWith('split', 'tab-2');
    expect(api.closeTab).toHaveBeenCalledWith('tab-2');
    expect(api.readActiveDocument).toHaveBeenCalled();
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
    await integratedBrowserService.getHistoryRetention();
    await integratedBrowserService.setHistoryRetention(90);
    await integratedBrowserService.listRecentlyClosedTabs();
    await integratedBrowserService.reopenClosedTab('cerrada-1');
    expect(api.getHistoryRetention).toHaveBeenCalled();
    expect(api.setHistoryRetention).toHaveBeenCalledWith(90);
    expect(api.listRecentlyClosedTabs).toHaveBeenCalled();
    expect(api.reopenClosedTab).toHaveBeenCalledWith('cerrada-1');
    await integratedBrowserService.listHistory('reporte', 20);
    await integratedBrowserService.saveCredential({ username: 'persona@example.com', password: 'secreto', expectedOrigin: 'https://example.com' });
    await integratedBrowserService.setExtensionEnabled('extension-id', false);
    await integratedBrowserService.restrictExtensionSites('extension-id', ['https://example.com']);
    expect(api.restrictExtensionSites).toHaveBeenCalledWith('extension-id', ['https://example.com']);
    await integratedBrowserService.confirmExtensionInstall('install-token');
    expect(api.listHistory).toHaveBeenCalledWith('reporte', 20);
    expect(api.saveCredential).toHaveBeenCalledWith({ username: 'persona@example.com', password: 'secreto', expectedOrigin: 'https://example.com' });
    expect(api.setExtensionEnabled).toHaveBeenCalledWith('extension-id', false);
    expect(api.confirmExtensionInstall).toHaveBeenCalledWith('install-token');
  });

  it('delega exportación de diagnóstico sin argumentos y conserva cancelación y error', async () => {
    expect(await integratedBrowserService.exportRuntimeDiagnostic()).toEqual({ success: true, diagnosticExport: { cancelled: false, exported: true } });
    expect(api.exportRuntimeDiagnostic).toHaveBeenCalledWith();
    vi.mocked(api.exportRuntimeDiagnostic).mockResolvedValueOnce({ success: true, diagnosticExport: { cancelled: true, exported: false } });
    expect((await integratedBrowserService.exportRuntimeDiagnostic()).diagnosticExport?.cancelled).toBe(true);
    vi.mocked(api.exportRuntimeDiagnostic).mockResolvedValueOnce({ success: false, error: 'Destino no disponible' });
    expect(await integratedBrowserService.exportRuntimeDiagnostic()).toEqual({ success: false, error: 'Destino no disponible' });
  });

  it('transporta la preferencia de guardado y propaga errores sin aprobar candidatos', async () => {
    expect(await integratedBrowserService.setCredentialAutosave(true)).toMatchObject({ credentialAutosaveEnabled: true });
    expect(api.setCredentialAutosave).toHaveBeenCalledWith(true);
    vi.mocked(api.setCredentialAutosave).mockRejectedValueOnce(new Error('No disponible'));
    await expect(integratedBrowserService.setCredentialAutosave(false)).rejects.toThrow('No disponible');
  });
});
