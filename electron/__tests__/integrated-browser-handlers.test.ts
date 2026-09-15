import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain } from 'electron';
import { registerIntegratedBrowserHandlers } from '../integrated-browser-handlers';
import { BrowserCredentialError, type IntegratedBrowserService } from '../integrated-browser';
import { setAuthState } from '../main/auth-state';

type TestHandler = (event: { sender: { id: number }; senderFrame?: unknown }, ...input: unknown[]) => Promise<{
  success: boolean;
  error?: string;
  state?: unknown;
  bookmarkTransfer?: unknown;
}>;

const ipcMainHarness = ipcMain as unknown as {
  _clearHandlers: () => void;
  _getHandler: (channel: string) => TestHandler;
  _getHandlers: () => Map<string, TestHandler>;
};

describe('handlers del navegador integrado', () => {
  const service = {
    getState: vi.fn(() => ({ url: 'about:blank' })),
    lockCredentials: vi.fn(),
    credentialSessionCommand: vi.fn<(input: unknown, guard: () => void) => Promise<{ success: boolean }>>(async () => ({ success: true })),
    semanticMemoryCommand: vi.fn<(input: unknown, guard: () => void) => Promise<{ success: boolean }>>(async () => ({ success: true })),
    agentShortcuts: vi.fn(async () => ({ success: true, library: { revision: 0, entries: [] } })),
    controlAgentTask: vi.fn(() => ({ success: true })),
    getTabSummaries: vi.fn(() => []),
    getTabContent: vi.fn(async () => ({ tabId: 'tab', url: 'https://example.com/', title: 'Página', text: 'Contenido' })),
    getRuntimeDiagnostic: vi.fn(() => ({ appVersion: '1.0.0', electronVersion: '43.4.0' })),
    getSyncDevices: vi.fn(async () => ({ enabled: false, state: 'disabled', devices: [], message: 'Desactivado' })),
    registerSyncDevice: vi.fn(async () => ({ enabled: true, state: 'registered', devices: [], message: 'Registrado' })),
    revokeSyncDevice: vi.fn(async () => ({ enabled: true, state: 'inactive', devices: [], message: 'Revocado' })),
    cancelSyncOperation: vi.fn(),
    controlSync: vi.fn(async () => ({ enabled: false })),
    exportRuntimeDiagnostic: vi.fn(async () => ({ cancelled: false, exported: true })),
    restorePreviousSession: vi.fn(async () => ({ url: 'https://restored.example.com' })),
    discardPreviousSession: vi.fn(async () => ({ url: 'about:blank' })),
    captureVisiblePage: vi.fn(async () => 'data:image/png;base64,captura'),
    captureVisibleBackdrop: vi.fn(async () => ({
      screenshot: 'data:image/png;base64,captura',
      bounds: { x: 12, y: 34, width: 800, height: 600 },
    })),
    getObservation: vi.fn(async () => ({ observation: null, observationStatus: { enabled: true } })),
    setObservationEnabled: vi.fn(async (enabled: boolean) => ({ observation: null, observationStatus: { enabled } })),
    open: vi.fn(async () => ({ url: 'https://example.com' })),
    navigate: vi.fn(async () => ({ url: 'https://example.com' })),
    findInPage: vi.fn(() => ({ url: 'https://example.com' })),
    stopFindInPage: vi.fn(() => ({ url: 'https://example.com' })),
    setZoom: vi.fn(() => ({ url: 'https://example.com' })),
    setMuted: vi.fn(() => ({ url: 'https://example.com' })),
    toggleFullscreen: vi.fn(() => ({ url: 'https://example.com' })),
    printPage: vi.fn(async () => ({ url: 'https://example.com' })),
    savePageAsPdf: vi.fn(async () => ({ state: { url: 'https://example.com' }, canceled: false, filename: 'Página.pdf' })),
    listDownloads: vi.fn(() => []),
    cancelDownload: vi.fn(() => ({ id: '12345678-1234-1234-1234-123456789abc' })),
    resumeDownload: vi.fn(() => ({ id: '12345678-1234-1234-1234-123456789abc' })),
    retryDownload: vi.fn(() => ({ id: '12345678-1234-1234-1234-123456789abc' })),
    openDownload: vi.fn(async () => true),
    revealDownload: vi.fn(() => true),
    createTab: vi.fn(async () => ({ url: 'https://www.google.com/' })),
    closeTab: vi.fn(() => ({ url: 'https://example.com' })),
    duplicateTab: vi.fn(async () => ({ url: 'https://example.com' })),
    reopenClosedTab: vi.fn(async () => ({ url: 'https://example.com' })),
    closeOtherTabs: vi.fn(() => ({ url: 'https://example.com' })),
    closeTabsToRight: vi.fn(() => ({ url: 'https://example.com' })),
    setTabPinned: vi.fn(() => ({ url: 'https://example.com' })),
    setTabLayout: vi.fn(() => ({ url: 'https://example.com' })),
    createTabGroup: vi.fn(() => ({ id: 'group-1', name: 'Trabajo', color: 'blue', collapsed: false })),
    assignTabGroup: vi.fn(() => ({ url: 'https://example.com' })),
    activateTab: vi.fn(() => ({ url: 'https://example.com' })),
    detachTab: vi.fn(() => ({ url: 'https://example.com', detached: true })),
    reattachTab: vi.fn(() => ({ url: 'https://example.com', detached: false })),
    setViewMode: vi.fn(async () => ({ viewMode: 'split' })),
    goBack: vi.fn(), goForward: vi.fn(), reload: vi.fn(), stop: vi.fn(), focus: vi.fn(),
    setViewport: vi.fn(() => ({ isVisible: true })), hide: vi.fn(),
    readActiveDocument: vi.fn(async () => ({ tabId: 'tab-1', url: 'https://docs.google.com/document/d/1/edit', title: 'Documento', language: 'es', text: 'Contenido documental', truncated: false })),
    listHistory: vi.fn(async () => []), clearHistory: vi.fn(async () => true),
    importHistory: vi.fn(async () => ({ cancelled: false, imported: 2, skipped: 1, duplicates: 1, invalid: 0 })),
    getProfile: vi.fn(() => ({ id: 'guest', kind: 'guest', label: 'Invitado', persistent: false, managed: false })),
    setProfileKind: vi.fn(async (kind: 'authenticated' | 'guest' | 'private') => ({ id: kind, kind, label: kind, persistent: kind === 'authenticated', managed: false })),
    listRecentlyClosedTabs: vi.fn(() => [{ id: 'tab-cerrada', title: 'Cerrada', url: 'https://example.com', closedAt: '2026-09-04' }]),
    getHistoryRetention: vi.fn(async () => ({ days: null, managed: false })),
    setHistoryRetention: vi.fn(async (days) => ({ days, managed: false, removed: 1 })),
    listBookmarks: vi.fn(async () => []), saveBookmark: vi.fn(async () => ({ id: 'bookmark-id' })),
    removeBookmark: vi.fn(async () => true), migrateLegacyBookmarks: vi.fn(async () => ({ imported: 0, skipped: 0 })),
    importBookmarksHtml: vi.fn(async () => ({ cancelled: false, imported: 1, updated: 2, skipped: 3, duplicates: 2, invalid: 1 })),
    recoverBookmarks: vi.fn(async () => ({ cancelled: false, restored: 2 })),
    recoverPolicyStore: vi.fn(async (_input: unknown, guard: () => void) => { guard(); return { cancelled: false, restored: 1 }; }),
    recoverCredentials: vi.fn(async () => ({ cancelled: false, restored: 1 })),
    listAgentAudit: vi.fn(() => ({ entries: [], total: 0, offset: 0, retentionDays: 30 })),
    changeAgentAudit: vi.fn(async () => ({ cancelled: false })),
    clearBrowsingData: vi.fn(async (input: unknown) => {
      const { categories, range } = (input ?? {}) as { categories?: string[]; range?: string };
      if (!Array.isArray(categories) || categories.length === 0) throw new Error('Elige al menos un tipo de dato para borrar.');
      return { range, results: categories.map((category) => ({ category, cleared: true, ignoredRange: false })) };
    }),
    listCredentials: vi.fn(async () => ({ credentials: [], credentialOrigin: 'https://example.com' })), saveCredential: vi.fn(async () => ({ canceled: false, credential: { id: 'credencial-id' } })),
    analyzeCredentialHealth: vi.fn(async () => []), importCredentials: vi.fn(async () => ({ cancelled: false, imported: 0, updated: 0, skipped: 0 })), exportCredentials: vi.fn(async () => ({ cancelled: false, exported: 0 })),
    fillCredential: vi.fn(async () => ({ id: 'credencial-id' })), removeCredential: vi.fn(async () => true),
    setCredentialAutosave: vi.fn(async (enabled: boolean) => ({ canceled: false, credentialAutosaveEnabled: enabled })),
    listExtensions: vi.fn(async () => []), prepareExtensionInstall: vi.fn(async () => ({ canceled: true })),
    extensionCatalog: vi.fn(async (_input: unknown, guard: () => void) => { guard(); return { catalog: [] }; }),
    restrictExtensionSites: vi.fn<(id: string, sites: string[], guard: () => void) => Promise<{ installId: string }>>(async id => ({ installId: id })),
    confirmExtensionInstall: vi.fn(async () => ({ installId: 'extension-id' })),
    setExtensionEnabled: vi.fn(async () => ({ installId: 'extension-id' })), removeExtension: vi.fn(async () => true),
    prepareReadingMode: vi.fn(async () => ({ readingId: 'reading-id', text: 'Contenido legible' })),
    synthesizeReadingSegment: vi.fn(async () => ({ readingId: 'reading-id', timings: [] })),
    highlightReadingRange: vi.fn(async () => ({ highlighted: true })),
    waitForReadingToolbarAction: vi.fn(async () => ({ readingId: 'reading-id', action: 'toggle' as const })),
    syncReadingToolbar: vi.fn(async () => ({ toolbarVisible: true })),
    cancelReadingSpeech: vi.fn(() => ({ canceled: 1 })),
    closeReadingMode: vi.fn(async () => ({ closed: true })),
    resolvePermissionPrompt: vi.fn(() => true),
  };
  let window: BrowserWindow;
  it('control sync sólo acepta su DTO, titular y marco principal, sin filtrar errores nativos', async () => {
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const handler = ipcMainHarness._getHandler('integrated-browser:sync-control');
    expect(await handler(event, { action: 'run' })).toMatchObject({ success: true, sync: { enabled: false } });
    expect(service.controlSync).toHaveBeenCalledWith({ action: 'run' }); service.controlSync.mockClear();
    for (const action of ['recover-state', 'rollback-state']) {
      expect(await handler(event, { action })).toMatchObject({ success: true });
      expect(service.controlSync).toHaveBeenCalledWith({ action });
      expect(await handler(event, { action, approved: true })).toMatchObject({ success: false });
    }
    service.controlSync.mockClear();
    for (const input of [{ action: 'run', approved: true }, { action: 'import-key', path: 'no' }, { action: 'configure', categories: ['passwords'] }, { action: ['recover-settings'] }, { action: 'recover-settings', approved: true }]) expect(await handler(event, input)).toMatchObject({ success: false });
    expect(await handler(event, { action: 'run' }, 'extra')).toMatchObject({ success: false });
    expect(await handler({ ...event, senderFrame: {} }, { action: 'run' })).toMatchObject({ success: false });
    expect(service.controlSync).not.toHaveBeenCalled();
    service.controlSync.mockRejectedValueOnce(new Error('ruta privada y secreto ficticio'));
    expect(await handler(event, { action: 'run' })).toEqual({ success: false, error: 'No se pudo completar la sincronización.' });
    setAuthState({ authenticated: false, userId: null });
    expect(await handler(event, { action: 'status' })).toMatchObject({ success: false });
    setAuthState({ authenticated: true, userId: 'prueba' });
  });
  it('sync exige marco principal y payload cerrado; errores internos no cruzan IPC', async () => {
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const get = ipcMainHarness._getHandler('integrated-browser:sync-devices-get');
    expect(await get(event)).toMatchObject({ success: true, syncDevices: { state: 'disabled' } });
    expect(await get({ sender: window.webContents, senderFrame: {} })).toMatchObject({ success: false });
    expect(await get(event, { accessToken: 'prohibido' })).toMatchObject({ success: false });
    const revoke = ipcMainHarness._getHandler('integrated-browser:sync-devices-revoke');
    expect(await revoke(event, { id: '33333333-3333-4333-8333-333333333333', ownerId: 'ajeno' })).toMatchObject({ success: false });
    expect(service.revokeSyncDevice).not.toHaveBeenCalled();
    service.getSyncDevices.mockRejectedValueOnce(new Error('ruta local y token ficticio'));
    expect(await get(event)).toEqual({ success: false, error: 'No se pudo completar la operación de sincronización.' });
    expect(await ipcMainHarness._getHandler('integrated-browser:sync-devices-cancel')(event)).toEqual({ success: true, canceled: true });
    expect(service.cancelSyncOperation).toHaveBeenCalledTimes(1);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    ipcMainHarness._clearHandlers();
    window = new BrowserWindow();
    Object.defineProperty(window.webContents, 'mainFrame', { value: {}, configurable: true });
    registerIntegratedBrowserHandlers(service as unknown as IntegratedBrowserService, () => window);
  });

  it('restricción de sitios exige marco principal, entrada acotada y sesión estable', async () => {
    setAuthState({ authenticated: true, userId: 'prueba' });
    const handler = ipcMainHarness._getHandler('integrated-browser:extensions-restrict-sites');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const input = { installId: 'extension-id', sites: ['https://example.com'] };
    for (const invalid of [{ ...input, extra: true }, { ...input, sites: [false] }, { ...input, sites: Array(51).fill('https://example.com') }]) {
      expect(await handler(event, invalid)).toMatchObject({ success: false });
    }
    expect(await handler({ ...event, senderFrame: {} }, input)).toMatchObject({ success: false });
    expect(await handler(event, input, 'extra')).toMatchObject({ success: false });
    expect(service.restrictExtensionSites).not.toHaveBeenCalled();
    expect(await handler(event, input)).toMatchObject({ success: true, extension: { installId: input.installId } });
    service.restrictExtensionSites.mockImplementationOnce(async (_id, _sites, guard) => {
      setAuthState({ authenticated: false, userId: null });
      setAuthState({ authenticated: true, userId: 'prueba' });
      guard(); return { installId: input.installId };
    });
    expect(await handler(event, input)).toMatchObject({ success: false });
    service.restrictExtensionSites.mockRejectedValueOnce(new Error('ruta-privada-fixture'));
    const failed = await handler(event, input);
    expect(failed.success).toBe(false);
    expect(failed.error).not.toContain('ruta-privada-fixture');
  });

  it('catálogo rechaza campos extra, subframes y sesión obsoleta sin filtrar rutas', async () => {
    setAuthState({ authenticated: true, userId: 'prueba' });
    const handler = ipcMainHarness._getHandler('integrated-browser:extensions-catalog');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    for (const args of [[{ ...event, senderFrame: {} }, { action: 'list' }], [event, { action: 'list', path: 'privada' }], [event, { action: 'list' }, 'extra']]) {
      expect(await handler(args[0] as typeof event, ...args.slice(1))).toMatchObject({ success: false });
    }
    expect(service.extensionCatalog).not.toHaveBeenCalled();
    expect(await handler(event, { action: 'list' })).toMatchObject({ success: true, catalog: [] });
    service.extensionCatalog.mockImplementationOnce(async (_input, guard) => {
      setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'prueba' });
      guard(); return { catalog: [] };
    });
    expect(await handler(event, { action: 'list' })).toMatchObject({ success: false });
    service.extensionCatalog.mockRejectedValueOnce(new Error('ruta-privada-fixture'));
    expect((await handler(event, { action: 'list' })).error).not.toContain('ruta-privada-fixture');
  });
  it('recuperación de ajustes exige contrato cerrado, marco principal y errores saneados', async () => {
    setAuthState({ authenticated: true, userId: 'prueba' });
    const handler = ipcMainHarness._getHandler('integrated-browser:policy-recover');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const input = { store: 'privacy', profileRevision: 2 };
    expect(await handler(event, { ...input, store: 'shortcuts' })).toMatchObject({ success: true });
    expect(service.recoverPolicyStore).toHaveBeenCalledWith({ store: 'shortcuts', profileRevision: 2 }, expect.any(Function));
    expect(await handler(event, { ...input, store: 'semantic' })).toMatchObject({ success: true });
    expect(service.recoverPolicyStore).toHaveBeenCalledWith({ store: 'semantic', profileRevision: 2 }, expect.any(Function));
    for (const store of ['history', 'audit']) {
      expect(await handler(event, { ...input, store })).toMatchObject({ success: true });
      expect(service.recoverPolicyStore).toHaveBeenCalledWith({ store, profileRevision: 2 }, expect.any(Function));
    }
    service.recoverPolicyStore.mockClear();
    for (const bad of [{ ...input, path: 'privada' }, { ...input, approved: true }, { ...input, store: 'sync' }]) expect(await handler(event, bad)).toMatchObject({ success: false });
    expect(await handler({ ...event, senderFrame: {} }, input)).toMatchObject({ success: false });
    expect(await handler(event, input, 'extra')).toMatchObject({ success: false });
    expect(service.recoverPolicyStore).not.toHaveBeenCalled();
    expect(await handler(event, input)).toMatchObject({ success: true, restored: 1 });
    service.recoverPolicyStore.mockRejectedValueOnce(new Error('archivo-privado'));
    expect((await handler(event, input)).error).not.toContain('archivo-privado');
  });

  it('atajos valida marco, recibo y campos cerrados, y sanea errores nativos', async () => {
    const handler = ipcMainHarness._getHandler('integrated-browser:agent-shortcuts');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const input = { action: 'list', profileRevision: 0 };
    expect(await handler(event, input)).toMatchObject({ success: true });
    expect(service.agentShortcuts).toHaveBeenCalledWith(input);
    service.agentShortcuts.mockClear();
    for (const args of [[{ ...event, senderFrame: {} }, input], [event, { ...input, path: 'secreto' }], [event, { action: 'execute', profileRevision: 0 }], [event, input, 'extra']] as const) {
      expect(await handler(args[0], ...args.slice(1))).toMatchObject({ success: false });
    }
    expect(service.agentShortcuts).not.toHaveBeenCalled();
    service.agentShortcuts.mockRejectedValueOnce(new Error('token privado ruta local'));
    expect(JSON.stringify(await handler(event, input))).not.toContain('token privado');
  });

  it('memoria valida marco, perfil, payload cerrado y redacción de errores', async () => {
    const handler = ipcMainHarness._getHandler('integrated-browser:semantic-memory');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const input = { action: 'status', profileRevision: 0 };
    expect(await handler(event, input)).toMatchObject({ success: true });
    expect(service.semanticMemoryCommand).toHaveBeenCalledWith(input, expect.any(Function)); service.semanticMemoryCommand.mockClear();
    for (const args of [[{ ...event, senderFrame: {} }, input], [event, { ...input, approved: true }], [event, { action: 'search', profileRevision: 0 }], [event, input, 'extra']] as const) {
      expect(await handler(args[0], ...args.slice(1))).toMatchObject({ success: false });
    }
    expect(service.semanticMemoryCommand).not.toHaveBeenCalled();
    service.semanticMemoryCommand.mockRejectedValueOnce(new Error('token privado ruta local'));
    expect(JSON.stringify(await handler(event, input))).not.toContain('token privado');
  });

  it('la sesión de bóveda no acepta aprobación renderer ni emisores secundarios', async () => {
    const handler = ipcMainHarness._getHandler('integrated-browser:credential-session');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const input = { action: 'unlock', profileRevision: 0 };
    expect(await handler(event, input)).toMatchObject({ success: true });
    expect(service.credentialSessionCommand).toHaveBeenCalledWith(input, expect.any(Function));
    service.credentialSessionCommand.mockClear();
    for (const args of [[{ ...event, senderFrame: {} }, input], [event, { ...input, approved: true }], [event, input, 'extra']] as const) {
      expect(await handler(args[0], ...args.slice(1))).toMatchObject({ success: false });
    }
    expect(service.credentialSessionCommand).not.toHaveBeenCalled();
  });

  it.each(['sesión', 'marco'])('rechaza verificación de Windows con recibo invalidado: %s', async mode => {
    setAuthState({ authenticated: true, userId: 'cuenta-ficticia' });
    const handler = ipcMainHarness._getHandler('integrated-browser:credential-session');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    service.credentialSessionCommand.mockImplementationOnce(async (_input, guard) => {
      if (mode === 'sesión') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'cuenta-ficticia' }); }
      else Object.defineProperty(window.webContents, 'mainFrame', { value: {}, configurable: true });
      guard(); return { success: true };
    });
    expect(await handler(event, { action: 'unlock', profileRevision: 0 })).toMatchObject({ success: false, unlocked: false });
    expect(service.lockCredentials).toHaveBeenCalled();
  });

  it.each(['sesión', 'marco'])('invalida una operación de memoria aunque vuelva el mismo titular: %s', async mode => {
    setAuthState({ authenticated: true, userId: 'cuenta-ficticia' });
    const handler = ipcMainHarness._getHandler('integrated-browser:semantic-memory');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const committed = vi.fn();
    service.semanticMemoryCommand.mockImplementationOnce(async (_input, guard) => {
      guard();
      if (mode === 'sesión') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'cuenta-ficticia' }); }
      else Object.defineProperty(window.webContents, 'mainFrame', { value: {}, configurable: true });
      guard(); committed(); return { success: true };
    });
    expect(await handler(event, { action: 'enable', profileRevision: 0 })).toMatchObject({ success: false });
    expect(committed).not.toHaveBeenCalled();
  });

  it('supervisión valida emisor, marco, tarea, revisión y comando cerrado sin exponer errores', async () => {
    const handler = ipcMainHarness._getHandler('integrated-browser:agent-control');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const input = { action: 'pause', taskId: 'browser-cu-00000000-0000-4000-8000-000000000000', taskRevision: 1, profileRevision: 0 };
    expect(await handler(event, input)).toMatchObject({ success: true });
    expect(service.controlAgentTask).toHaveBeenCalledWith(input);
    service.controlAgentTask.mockClear();
    for (const args of [
      [{ ...event, sender: { id: -123 } }, input], [{ ...event, senderFrame: {} }, input],
      [event, { ...input, action: 'execute' }], [event, { ...input, taskId: 'otro' }],
      [event, { ...input, profileRevision: -1 }], [event, { ...input, script: 'privado' }], [event, input, 'extra'],
    ] as const) expect(await handler(args[0], ...args.slice(1))).toMatchObject({ success: false });
    expect(service.controlAgentTask).not.toHaveBeenCalled();
    service.controlAgentTask.mockImplementationOnce(() => { throw new Error('token secreto ruta privada'); });
    expect(JSON.stringify(await handler(event, input))).not.toContain('secreto');
    setAuthState({ authenticated: false, userId: null });
    expect(await handler(event, input)).toMatchObject({ success: false });
    setAuthState({ authenticated: true, userId: 'prueba' });
  });

  it('registra el contrato completo y enruta payloads validos', async () => {
    const handlers = ipcMainHarness._getHandlers();
    expect(Array.from(handlers.keys()).filter((key: unknown) => String(key).startsWith('integrated-browser:'))).toHaveLength(114);
    expect(handlers.has('integrated-browser:clear-browsing-data')).toBe(true);
    expect(handlers.has('integrated-browser:writing-resolve')).toBe(true);
    expect(handlers.has('integrated-browser:reading-download')).toBe(false);
    expect(handlers.has('integrated-browser:permission-decide')).toBe(true);
    expect(handlers.has('integrated-browser:tab-summaries')).toBe(true);
    expect(handlers.has('integrated-browser:get-tab-content')).toBe(true);
    expect(handlers.has('integrated-browser:document-read')).toBe(true);
    expect(await handlers.get('integrated-browser:document-read')!({ sender: window.webContents }))
      .toMatchObject({ success: true, document: { tabId: 'tab-1', text: 'Contenido documental' } });
    const captureHandler = handlers.get('integrated-browser:capture-visible');
    expect(await captureHandler!({ sender: window.webContents })).toMatchObject({
      success: true,
      screenshot: 'data:image/png;base64,captura',
      // El renderer necesita el rectangulo real para no estirar el respaldo.
      captureBounds: { x: 12, y: 34, width: 800, height: 600 },
      state: { url: 'about:blank' },
    });
    const navigateHandler = handlers.get('integrated-browser:navigate');
    expect(navigateHandler).toBeDefined();
    const result = await navigateHandler!(
      { sender: window.webContents },
      { target: 'example.com' },
    );
    expect(result.success).toBe(true);
    expect(service.navigate).toHaveBeenCalledWith('example.com');

    expect(await handlers.get('integrated-browser:page-find')!({ sender: window.webContents }, { query: 'texto', forward: false }))
      .toMatchObject({ success: true });
    expect(service.findInPage).toHaveBeenCalledWith('texto', false);
    expect(await handlers.get('integrated-browser:page-zoom')!({ sender: window.webContents }, { action: 'reset' }))
      .toMatchObject({ success: true });
    expect(service.setZoom).toHaveBeenCalledWith('reset');
    expect(await handlers.get('integrated-browser:page-mute')!({ sender: window.webContents }, { muted: true }))
      .toMatchObject({ success: true });
    expect(service.setMuted).toHaveBeenCalledWith(true);
    expect(await handlers.get('integrated-browser:page-save-pdf')!({ sender: window.webContents }))
      .toMatchObject({ success: true, filename: 'Página.pdf' });
    const downloadId = '12345678-1234-1234-1234-123456789abc';
    expect(await handlers.get('integrated-browser:downloads-cancel')!({ sender: window.webContents }, { id: downloadId }))
      .toMatchObject({ success: true, download: { id: downloadId } });
    expect(service.cancelDownload).toHaveBeenCalledWith(downloadId);

    const observationHandler = handlers.get('integrated-browser:get-observation');
    expect(await observationHandler!({ sender: window.webContents }, { forceFresh: true }))
      .toMatchObject({ success: true, observationStatus: { enabled: true } });
    expect(service.getObservation).toHaveBeenCalledWith(true);

    const perceptionHandler = handlers.get('integrated-browser:set-observation-enabled');
    expect(await perceptionHandler!({ sender: window.webContents }, { enabled: false }))
      .toMatchObject({ success: true, observationStatus: { enabled: false } });
    expect(service.setObservationEnabled).toHaveBeenCalledWith(false);

    const viewModeHandler = handlers.get('integrated-browser:view-mode');
    expect(await viewModeHandler!({ sender: window.webContents }, { mode: 'split', secondaryTabId: 'tab-2' }))
      .toMatchObject({ success: true, state: { viewMode: 'split' } });
    expect(service.setViewMode).toHaveBeenCalledWith('split', 'tab-2');

    const detachHandler = handlers.get('integrated-browser:tab-detach');
    expect(await detachHandler!({ sender: window.webContents }, { tabId: 'tab-1' }))
      .toMatchObject({ success: true, state: { detached: true } });
    expect(service.detachTab).toHaveBeenCalledWith('tab-1');

    const clearDataHandler = handlers.get('integrated-browser:clear-browsing-data');
    expect(await clearDataHandler!({ sender: window.webContents }, { categories: ['cookies'], range: 'todo' }))
      .toMatchObject({ success: true, summary: { range: 'todo', results: [{ category: 'cookies', cleared: true }] } });
    // Un payload sin categorias no borra nada y vuelve como error saneado.
    expect(await clearDataHandler!({ sender: window.webContents }, { categories: [], range: 'todo' }))
      .toMatchObject({ success: false });

    const saveHandler = handlers.get('integrated-browser:credentials-save');
    const saved = await saveHandler!(
      { sender: window.webContents, senderFrame: window.webContents.mainFrame },
      { username: 'persona@example.com', password: 'secreto', expectedOrigin: 'https://example.com' },
    );
    expect(saved).toMatchObject({ success: true, credential: { id: 'credencial-id' } });
    expect(service.saveCredential).toHaveBeenCalledWith({ id: undefined, username: 'persona@example.com', password: 'secreto', expectedOrigin: 'https://example.com' });

    const confirmInstallHandler = handlers.get('integrated-browser:extensions-confirm-install');
    expect(await confirmInstallHandler!({ sender: window.webContents }, { token: '12345678-1234-1234-1234-123456789abc' }))
      .toMatchObject({ success: true, extension: { installId: 'extension-id' } });

    const readingHandler = handlers.get('integrated-browser:reading-prepare');
    expect(await readingHandler!({ sender: window.webContents }, { sourceUrl: 'https://example.com', selection: 'Texto' }))
      .toMatchObject({ success: true, reading: { readingId: 'reading-id' } });
    expect(service.prepareReadingMode).toHaveBeenCalledWith({ sourceUrl: 'https://example.com', selection: 'Texto' });

    const synthesisHandler = handlers.get('integrated-browser:reading-synthesize');
    expect(await synthesisHandler!({ sender: window.webContents }, {
      readingId: 'reading-id', requestId: 'request-id', start: 0, end: 16,
    })).toMatchObject({ success: true, speech: { readingId: 'reading-id' } });

    const highlightHandler = handlers.get('integrated-browser:reading-highlight');
    expect(await highlightHandler!({ sender: window.webContents }, {
      readingId: 'reading-id', start: 0, end: 9,
    })).toMatchObject({ success: true, highlighted: true });
    expect(service.highlightReadingRange).toHaveBeenCalledWith({ readingId: 'reading-id', start: 0, end: 9 });

    const toolbarWaitHandler = handlers.get('integrated-browser:reading-toolbar-wait');
    expect(await toolbarWaitHandler!({ sender: window.webContents }, { readingId: 'reading-id' }))
      .toMatchObject({ success: true, toolbarAction: { action: 'toggle' } });
    const toolbarSyncHandler = handlers.get('integrated-browser:reading-toolbar-sync');
    expect(await toolbarSyncHandler!({ sender: window.webContents }, {
      readingId: 'reading-id', status: 'playing', speed: 1.25,
    })).toMatchObject({ success: true, toolbarVisible: true });
    expect(service.syncReadingToolbar).toHaveBeenCalledWith({
      readingId: 'reading-id', status: 'playing', speed: 1.25, message: undefined,
    });

    const closeHandler = handlers.get('integrated-browser:reading-close');
    expect(await closeHandler!({ sender: window.webContents }, { readingId: 'reading-id' }))
      .toMatchObject({ success: true, closed: true });
  });

  it('entrega la decision del aviso de permiso y rechaza payloads invalidos', async () => {
    const decide = ipcMainHarness._getHandlers().get('integrated-browser:permission-decide');
    expect(await decide!({ sender: window.webContents }, { id: 'aviso-1', granted: true }))
      .toMatchObject({ success: true, resolved: true });
    expect(service.resolvePermissionPrompt).toHaveBeenCalledWith('aviso-1', true);

    // Un aviso sin identificador o con una decision que no es booleana nunca
    // llega al servicio: concederia o denegaria un permiso a ciegas.
    expect(await decide!({ sender: window.webContents }, { granted: true })).toMatchObject({ success: false });
    expect(await decide!({ sender: window.webContents }, { id: 'aviso-1', granted: 'si' })).toMatchObject({ success: false });
    expect(await decide!({ sender: window.webContents }, null)).toMatchObject({ success: false });
    expect(service.resolvePermissionPrompt).toHaveBeenCalledTimes(1);
  });

  it('las fuentes exigen marco principal y contrato cerrado, incluido el recibo', async () => {
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const handler = ipcMainHarness._getHandler('integrated-browser:get-tab-content');
    const expected = { profileRevision: 3, documentToken: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' };
    expect(await handler(event, { tabId: 'tab', expected })).toMatchObject({ success: true });
    expect(service.getTabContent).toHaveBeenCalledWith('tab', expected);
    service.getTabContent.mockClear();
    for (const input of [null, [], { tabId: 'tab', extra: true }, { tabId: 'tab', expected: {} },
      { tabId: 'tab', expected: { ...expected, profileRevision: -1 } }, { tabId: 'tab', expected: { ...expected, permission: 'allow' } }]) {
      expect(await handler(event, input)).toMatchObject({ success: false });
    }
    expect(await handler({ ...event, senderFrame: {} }, { tabId: 'tab', expected })).toMatchObject({ success: false });
    expect(await handler(event, { tabId: 'tab', expected }, 'extra')).toMatchObject({ success: false });
    expect(service.getTabContent).not.toHaveBeenCalled();
    const list = ipcMainHarness._getHandler('integrated-browser:tab-summaries');
    expect(await list(event)).toMatchObject({ success: true });
    expect(await list(event, { allProfiles: true })).toMatchObject({ success: false });
    expect(await list({ ...event, senderFrame: {} })).toMatchObject({ success: false });
  });

  it('protege todos los canales de contraseñas con sesión y frame principal', async () => {
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    for (const name of ['list', 'health', 'save', 'fill', 'remove']) {
      const handler = ipcMainHarness._getHandler(`integrated-browser:credentials-${name}`);
      for (const senderFrame of [undefined, null, {}]) {
        expect(await handler({ ...event, senderFrame })).toMatchObject({ success: false });
      }
      expect(await handler({ ...event, sender: { id: -1 } })).toMatchObject({ success: false, error: 'sender_denied' });
      setAuthState({ authenticated: false, userId: null });
      expect(await handler(event)).toEqual({ success: false, error: 'auth_required' });
      setAuthState({ authenticated: true, userId: 'prueba' });
    }
    for (const operation of [service.listCredentials, service.analyzeCredentialHealth, service.saveCredential, service.fillCredential, service.removeCredential]) {
      expect(operation).not.toHaveBeenCalled();
    }
  });

  it('rechaza payloads abiertos, valores grandes y argumentos extra antes de tocar la bóveda', async () => {
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const valid = { username: 'cuenta', password: 'ficticia', expectedOrigin: 'https://example.com' };
    const save = ipcMainHarness._getHandler('integrated-browser:credentials-save');
    for (const input of [null, [], {}, { username: 'cuenta', password: 'ficticia' },
      { ...valid, approved: true }, { ...valid, username: 'x'.repeat(321) }, { ...valid, password: 'x'.repeat(4097) },
      { ...valid, id: '../archivo' }, { ...valid, expectedOrigin: 'x'.repeat(2049) }]) {
      expect(await save(event, input)).toMatchObject({ success: false });
    }
    expect(await save(event, valid, true)).toMatchObject({ success: false });
    for (const name of ['list', 'health']) {
      expect(await ipcMainHarness._getHandler(`integrated-browser:credentials-${name}`)(event, undefined)).toMatchObject({ success: false });
    }
    for (const name of ['fill', 'remove']) {
      const handler = ipcMainHarness._getHandler(`integrated-browser:credentials-${name}`);
      for (const input of [null, [], {}, { id: '../archivo' }, { id: 'a'.repeat(65) }, { id: 'a'.repeat(16), approved: true }]) {
        expect(await handler(event, input)).toMatchObject({ success: false });
      }
      expect(await handler(event, { id: 'a'.repeat(16) }, true)).toMatchObject({ success: false });
    }
    expect(service.saveCredential).not.toHaveBeenCalled();
    expect(service.fillCredential).not.toHaveBeenCalled();
    expect(service.removeCredential).not.toHaveBeenCalled();
  });

  it('sanea errores inesperados de contraseñas y conserva errores de dominio sin fingir éxito', async () => {
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const handler = ipcMainHarness._getHandler('integrated-browser:credentials-save');
    const input = { username: 'cuenta', password: 'secreto-ficticio', expectedOrigin: 'https://example.com' };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      service.saveCredential.mockRejectedValueOnce(new Error('C:/Privado/secreto-ficticio'));
      const response = await handler(event, input);
      expect(response).toEqual({ success: false, error: 'No se pudo completar la operación de contraseñas. Revisa el sitio y vuelve a intentarlo.' });
      expect(JSON.stringify(log.mock.calls)).not.toContain('secreto-ficticio');
      service.saveCredential.mockRejectedValueOnce(new BrowserCredentialError('La bóveda cambió durante la revisión.'));
      expect(await handler(event, input)).toEqual({ success: false, error: 'La bóveda cambió durante la revisión.' });
    } finally { log.mockRestore(); }
  });

  it('la preferencia de guardado no acepta secretos, aprobación ni otro frame', async () => {
    const handler = ipcMainHarness._getHandler('integrated-browser:credentials-autosave-set');
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    for (const payload of [undefined, true, [], {}, { enabled: 'true' }, { enabled: true, approved: true }, { enabled: true, password: 'ficticia' }]) {
      expect(await handler(event, payload)).toMatchObject({ success: false });
    }
    expect(await handler({ sender: window.webContents, senderFrame: {} }, { enabled: true })).toMatchObject({ success: false });
    expect(service.setCredentialAutosave).not.toHaveBeenCalled();
    expect(await handler(event, { enabled: true })).toEqual({ success: true, canceled: false, credentialAutosaveEnabled: true });
    service.setCredentialAutosave.mockRejectedValueOnce(new Error('Ruta secreta'));
    expect(await handler(event, { enabled: false })).toEqual({ success: false, error: 'No se pudo completar la operación de contraseñas. Revisa el sitio y vuelve a intentarlo.' });
  });

  it('importa sólo desde el frame principal, sin rutas ni decisiones por IPC', async () => {
    const frame = {};
    Object.defineProperty(window.webContents, 'mainFrame', { value: frame });
    const handler = ipcMainHarness._getHandler('integrated-browser:bookmarks-import-html');
    expect(await handler({ sender: window.webContents, senderFrame: frame })).toEqual({
      success: true, bookmarkTransfer: { cancelled: false, imported: 1, updated: 2, skipped: 3, duplicates: 2, invalid: 1 },
    });
    expect(service.importBookmarksHtml).toHaveBeenCalledWith();
    for (const senderFrame of [undefined, null, {}]) {
      expect((await handler({ sender: window.webContents, senderFrame })).success).toBe(false);
    }
    expect((await handler({ sender: window.webContents, senderFrame: frame }, { path: 'C:/archivo.html', overwrite: true })).success).toBe(false);
    expect((await handler({ sender: { id: -1 }, senderFrame: frame })).success).toBe(false);
    expect(service.importBookmarksHtml).toHaveBeenCalledTimes(1);
  });

  it('la bitácora exige frame principal y contrato cerrado sin escrituras de eventos desde renderer', async () => {
    const frame = {}; Object.defineProperty(window.webContents, 'mainFrame', { value: frame });
    const handler = ipcMainHarness._getHandler('integrated-browser:agent-audit');
    const event = { sender: window.webContents, senderFrame: frame };
    for (const input of [null, {}, { action: 'record', secret: 'dato' }, { action: 'clear', approved: true }, { action: 'list', offset: 0, path: 'C:/privado' }]) expect(await handler(event, input)).toMatchObject({ success: false });
    expect(await handler({ ...event, senderFrame: {} }, { action: 'clear' })).toMatchObject({ success: false });
    expect(service.changeAgentAudit).not.toHaveBeenCalled();
    expect(await handler(event, { action: 'list', offset: 0 })).toMatchObject({ success: true, audit: { total: 0 } });
    expect(await handler(event, { action: 'clear' })).toMatchObject({ success: true, auditChange: { cancelled: false } });
    expect(service.changeAgentAudit).toHaveBeenCalledWith('clear');
    expect(await handler(event, { action: 'retention', days: 7 })).toMatchObject({ success: true });
    expect(service.changeAgentAudit).toHaveBeenLastCalledWith('retention', 7);
    service.changeAgentAudit.mockRejectedValueOnce(new Error('C:/privado/token'));
    expect(JSON.stringify(await handler(event, { action: 'clear' }))).not.toContain('privado');
  });

  it('recupera marcadores sólo desde main frame y no acepta rutas ni aprobación por IPC', async () => {
    const frame = {}; Object.defineProperty(window.webContents, 'mainFrame', { value: frame });
    const handler = ipcMainHarness._getHandler('integrated-browser:bookmarks-recover');
    for (const input of [undefined, {}, { path: 'C:/privado', approved: true }]) expect(await handler({ sender: window.webContents, senderFrame: frame }, input)).toMatchObject({ success: false });
    expect(await handler({ sender: window.webContents, senderFrame: {} })).toMatchObject({ success: false });
    expect(service.recoverBookmarks).not.toHaveBeenCalled();
    expect(await handler({ sender: window.webContents, senderFrame: frame })).toEqual({ success: true, bookmarkRecovery: { cancelled: false, restored: 2 } });
    expect(service.recoverBookmarks).toHaveBeenCalledWith();
  });

  it('recupera contraseñas sólo desde el frame principal y sin rutas ni aprobación por IPC', async () => {
    const frame = {}; Object.defineProperty(window.webContents, 'mainFrame', { value: frame });
    const handler = ipcMainHarness._getHandler('integrated-browser:credentials-recover');
    for (const input of [undefined, {}, { path: 'C:/privado', approved: true }]) expect(await handler({ sender: window.webContents, senderFrame: frame }, input)).toMatchObject({ success: false });
    for (const senderFrame of [undefined, null, {}]) expect(await handler({ sender: window.webContents, senderFrame })).toMatchObject({ success: false });
    expect(await handler({ sender: { id: -1 }, senderFrame: frame })).toMatchObject({ success: false });
    expect(service.recoverCredentials).not.toHaveBeenCalled();
    expect(await handler({ sender: window.webContents, senderFrame: frame })).toEqual({ success: true, credentialRecovery: { cancelled: false, restored: 1 } });
    expect(service.recoverCredentials).toHaveBeenCalledWith();
    service.recoverCredentials.mockRejectedValueOnce(new Error('C:/privado/clave'));
    const failure = await handler({ sender: window.webContents, senderFrame: frame });
    expect(failure.success).toBe(false); expect(JSON.stringify(failure)).not.toContain('privado');
  });

  it('importa historial sólo desde el frame principal y sin rutas por IPC', async () => {
    const frame = {};
    Object.defineProperty(window.webContents, 'mainFrame', { value: frame });
    const handler = ipcMainHarness._getHandler('integrated-browser:history-import');
    expect(await handler({ sender: window.webContents, senderFrame: frame })).toEqual({
      success: true, historyTransfer: { cancelled: false, imported: 2, skipped: 1, duplicates: 1, invalid: 0 },
    });
    expect(service.importHistory).toHaveBeenCalledWith();
    for (const senderFrame of [undefined, null, {}]) expect((await handler({ sender: window.webContents, senderFrame })).success).toBe(false);
    expect((await handler({ sender: window.webContents, senderFrame: frame }, { path: 'C:/historial.json' })).success).toBe(false);
    expect(service.importHistory).toHaveBeenCalledTimes(1);
  });

  it('gestiona perfiles sólo con payload cerrado y sin aceptar identificadores', async () => {
    const get = ipcMainHarness._getHandler('integrated-browser:profile-get');
    const set = ipcMainHarness._getHandler('integrated-browser:profile-set');
    const frame = {};
    Object.defineProperty(window.webContents, 'mainFrame', { value: frame, configurable: true });
    expect(await get({ sender: window.webContents, senderFrame: frame })).toEqual({ success: true, profile: { id: 'guest', kind: 'guest', label: 'Invitado', persistent: false, managed: false } });
    expect(await set({ sender: window.webContents, senderFrame: frame }, { kind: 'private' })).toMatchObject({ success: true, profile: { kind: 'private' } });
    expect(service.setProfileKind).toHaveBeenCalledWith('private');
    for (const input of [null, {}, { kind: 'nope' }, { kind: 'guest', userId: 'secreto' }]) expect((await set({ sender: window.webContents, senderFrame: frame }, input)).success).toBe(false);
    expect((await get({ sender: window.webContents, senderFrame: frame }, { extra: true })).success).toBe(false);
    for (const senderFrame of [undefined, null, {}]) {
      expect((await get({ sender: window.webContents, senderFrame })).success).toBe(false);
      expect((await set({ sender: window.webContents, senderFrame }, { kind: 'guest' })).success).toBe(false);
    }
  });

  it('exporta diagnóstico sólo con sesión y frame principal, sin aceptar contenido ni rutas', async () => {
    const frame = {};
    Object.defineProperty(window.webContents, 'mainFrame', { value: frame });
    const handler = ipcMainHarness._getHandler('integrated-browser:runtime-diagnostic-export');
    expect(await handler({ sender: window.webContents, senderFrame: frame })).toEqual({ success: true, diagnosticExport: { cancelled: false, exported: true } });
    expect(service.exportRuntimeDiagnostic).toHaveBeenCalledWith();
    for (const senderFrame of [undefined, null, {}]) expect((await handler({ sender: window.webContents, senderFrame })).success).toBe(false);
    for (const payload of [undefined, null, {}, { path: 'C:/elegido.json' }, { report: { secret: 'ficticio' }, approved: true }]) {
      expect((await handler({ sender: window.webContents, senderFrame: frame }, payload)).success).toBe(false);
    }
    expect((await handler({ sender: { id: -1 }, senderFrame: frame })).success).toBe(false);
    setAuthState({ authenticated: false, userId: null });
    expect(await handler({ sender: window.webContents, senderFrame: frame })).toEqual({ success: false, error: 'auth_required' });
    expect(service.exportRuntimeDiagnostic).toHaveBeenCalledTimes(1);
  });

  it('cancelación o fallo de exportación no se convierten en archivo guardado', async () => {
    const frame = {}; Object.defineProperty(window.webContents, 'mainFrame', { value: frame });
    const handler = ipcMainHarness._getHandler('integrated-browser:runtime-diagnostic-export');
    service.exportRuntimeDiagnostic.mockResolvedValueOnce({ cancelled: true, exported: false });
    expect(await handler({ sender: window.webContents, senderFrame: frame })).toEqual({ success: true, diagnosticExport: { cancelled: true, exported: false } });
    service.exportRuntimeDiagnostic.mockRejectedValueOnce(new Error('No se pudo exportar el diagnóstico.'));
    expect(await handler({ sender: window.webContents, senderFrame: frame })).toEqual({ success: false, error: 'No se pudo exportar el diagnóstico.' });
  });

  it('el IPC no informa éxito si falla la revisión o la escritura de marcadores', async () => {
    const frame = {};
    Object.defineProperty(window.webContents, 'mainFrame', { value: frame });
    service.importBookmarksHtml.mockRejectedValueOnce(new Error('Los marcadores cambiaron. Revisa la importación de nuevo.'));
    const result = await ipcMainHarness._getHandler('integrated-browser:bookmarks-import-html')({ sender: window.webContents, senderFrame: frame });
    expect(result).toEqual({ success: false, error: 'Los marcadores cambiaron. Revisa la importación de nuevo.' });
    expect(result).not.toHaveProperty('bookmarkTransfer');
  });

  it('valida retención y reapertura selectiva sin aceptar emisores remotos', async () => {
    const retention = ipcMainHarness._getHandler('integrated-browser:history-retention-set');
    for (const input of [null, {}, { days: -1 }, { days: 7 }, { days: '30' }, { days: 0 }, { days: 10000 }]) {
      expect(await retention({ sender: window.webContents }, input)).toMatchObject({ success: false });
    }
    expect(service.setHistoryRetention).not.toHaveBeenCalled();
    expect(await retention({ sender: window.webContents }, { days: 30 })).toMatchObject({ success: true, historyRetention: { days: 30, removed: 1 } });
    expect(await retention({ sender: { id: 999 } }, { days: null })).toMatchObject({ success: false, error: 'sender_denied' });
    const recent = ipcMainHarness._getHandler('integrated-browser:tabs-recently-closed');
    expect(await recent({ sender: window.webContents })).toMatchObject({ success: true, recentlyClosedTabs: [expect.objectContaining({ id: 'tab-cerrada' })] });
    const reopen = ipcMainHarness._getHandler('integrated-browser:tab-reopen-closed');
    expect(await reopen({ sender: window.webContents }, { tabId: 'tab-cerrada' })).toMatchObject({ success: true });
    expect(service.reopenClosedTab).toHaveBeenCalledWith('tab-cerrada');
    expect(await reopen({ sender: window.webContents }, { tabId: 4 })).toMatchObject({ success: false });
  });

  it('rechaza emisores distintos y payloads malformados', async () => {
    const handler = ipcMainHarness._getHandler('integrated-browser:navigate');
    expect(await handler({ sender: { id: 999 } }, { target: 'example.com' })).toEqual({ success: false, error: 'sender_denied' });
    const invalid = await handler({ sender: window.webContents }, { target: 42 });
    expect(invalid.success).toBe(false);
    expect(service.navigate).not.toHaveBeenCalled();

    const extensionHandler = ipcMainHarness._getHandler('integrated-browser:extensions-set-enabled');
    const malformed = await extensionHandler({ sender: window.webContents }, { installId: 'extension-id', enabled: 'si' });
    expect(malformed.success).toBe(false);
    expect(service.setExtensionEnabled).not.toHaveBeenCalled();

    const confirmInstall = ipcMainHarness._getHandler('integrated-browser:extensions-confirm-install');
    expect((await confirmInstall({ sender: window.webContents }, { token: 42 })).success).toBe(false);
    expect(service.confirmExtensionInstall).not.toHaveBeenCalled();

    const viewModeHandler = ipcMainHarness._getHandler('integrated-browser:view-mode');
    expect((await viewModeHandler({ sender: window.webContents }, { mode: 'tiles' })).success).toBe(false);
    expect(service.setViewMode).not.toHaveBeenCalled();

    const findHandler = ipcMainHarness._getHandler('integrated-browser:page-find');
    expect((await findHandler({ sender: window.webContents }, { query: 4 })).success).toBe(false);
    const zoomHandler = ipcMainHarness._getHandler('integrated-browser:page-zoom');
    expect((await zoomHandler({ sender: window.webContents }, { action: 'giant' })).success).toBe(false);
    const muteHandler = ipcMainHarness._getHandler('integrated-browser:page-mute');
    expect((await muteHandler({ sender: window.webContents }, { muted: 'sí' })).success).toBe(false);
    const downloadHandler = ipcMainHarness._getHandler('integrated-browser:downloads-open');
    expect((await downloadHandler({ sender: window.webContents }, { id: '../archivo' })).success).toBe(false);
    expect(service.openDownload).not.toHaveBeenCalled();

    const perceptionHandler = ipcMainHarness._getHandler('integrated-browser:set-observation-enabled');
    expect((await perceptionHandler({ sender: window.webContents }, { enabled: 'si' })).success).toBe(false);
    expect(service.setObservationEnabled).not.toHaveBeenCalled();

    const detachHandler = ipcMainHarness._getHandler('integrated-browser:tab-detach');
    expect((await detachHandler({ sender: window.webContents }, { tabId: '' })).success).toBe(false);
    expect(service.detachTab).not.toHaveBeenCalled();

    const synthesisHandler = ipcMainHarness._getHandler('integrated-browser:reading-synthesize');
    expect((await synthesisHandler({ sender: window.webContents }, {
      readingId: 'reading-id', requestId: 'request-id', start: -1, end: 99_999,
    })).success).toBe(false);
    expect(service.synthesizeReadingSegment).not.toHaveBeenCalled();

    const highlightHandler = ipcMainHarness._getHandler('integrated-browser:reading-highlight');
    expect((await highlightHandler({ sender: window.webContents }, {
      readingId: 'reading-id', start: 20, end: 10,
    })).success).toBe(false);
    expect(service.highlightReadingRange).not.toHaveBeenCalled();

    const toolbarSyncHandler = ipcMainHarness._getHandler('integrated-browser:reading-toolbar-sync');
    expect((await toolbarSyncHandler({ sender: window.webContents }, {
      readingId: 'reading-id', status: 'volando', speed: 99,
    })).success).toBe(false);
    expect(service.syncReadingToolbar).not.toHaveBeenCalled();

    const closeHandler = ipcMainHarness._getHandler('integrated-browser:reading-close');
    expect((await closeHandler({ sender: window.webContents }, { readingId: 42 })).success).toBe(false);
    expect(service.closeReadingMode).not.toHaveBeenCalled();
  });
});
