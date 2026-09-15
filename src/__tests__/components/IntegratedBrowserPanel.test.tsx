import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IntegratedBrowserPanel } from '../../components/browser/IntegratedBrowserPanel';
import { BrowserManagementPanel } from '../../components/browser/BrowserManagementPanel';
import { BrowserHistorySettings } from '../../components/browser/BrowserHistorySettings';
import type {
  BrowserSitePermissionSummary,
  IntegratedBrowserApi,
  IntegratedBrowserState,
  IntegratedBrowserDataResponse,
} from '../../services/integrated-browser-service';
import { scopedPreferenceKey } from '../../services/user-scope';

const state: IntegratedBrowserState = {
  profileRevision: 0, credentialUnlocked: true,
  url: 'https://example.com/',
  title: 'Ejemplo',
  canGoBack: true,
  canGoForward: false,
  isLoading: false,
  isVisible: true,
  agentControlling: false,
  error: null,
  tabs: [{ id: 'tab-1', url: 'https://example.com/', title: 'Ejemplo', isLoading: false, error: null, isSuspended: false, isDetached: false }],
  activeTabId: 'tab-1',
  primaryTabId: 'tab-1',
  secondaryTabId: null,
  viewMode: 'single',
  isFullscreen: false,
};

const emptySite: BrowserSitePermissionSummary = {
  origin: 'https://example.com',
  url: 'https://example.com/',
  secure: true,
  permissions: [],
};

const savedCredential = { id: '12345678-1234-1234-1234-123456789abc', origin: 'https://example.com', username: 'persona@example.com', createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' };

/** Los gestores viven en el menu de herramientas: hay que abrirlo primero. */
function openTool(name: 'Historial' | 'Contraseñas' | 'Extensiones' | 'Inspeccionar') {
  fireEvent.click(screen.getByRole('button', { name: 'Herramientas del navegador' }));
  fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name }));
}

describe('IntegratedBrowserPanel', () => {
  let api: IntegratedBrowserApi;
  let listenerCleanup: () => void;

  beforeEach(() => {
    localStorage.clear();
    listenerCleanup = vi.fn();
    api = {
      getState: vi.fn(async () => ({ success: true, state })),
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
      restorePreviousSession: vi.fn(async () => ({ success: true, state })),
      discardPreviousSession: vi.fn(async () => ({ success: true, state })),
      captureVisible: vi.fn(async () => ({ success: true, state, screenshot: 'data:image/png;base64,captura' })),
      getObservation: vi.fn(async () => ({ success: true, state, observation: null, observationStatus: { enabled: true, capturing: false, intervalMs: 10_000, lastCapturedAt: null, lastError: null } })),
      setObservationEnabled: vi.fn(async (enabled) => ({ success: true, state, observation: null, observationStatus: { enabled, capturing: false, intervalMs: 10_000, lastCapturedAt: null, lastError: null } })),
      open: vi.fn(async () => ({ success: true, state })),
      navigate: vi.fn(async () => ({ success: true, state })),
      findInPage: vi.fn(async () => ({ success: true, state })),
      stopFindInPage: vi.fn(async () => ({ success: true, state })),
      setZoom: vi.fn(async () => ({ success: true, state })),
      setMuted: vi.fn(async () => ({ success: true, state })),
      toggleFullscreen: vi.fn(async () => ({ success: true, state })),
      printPage: vi.fn(async () => ({ success: true, state })),
      savePageAsPdf: vi.fn(async () => ({ success: true, state, canceled: false, filename: 'Página.pdf' })),
      listDownloads: vi.fn(async () => ({ success: true, downloads: [] })),
      cancelDownload: vi.fn(async () => ({ success: true })),
      resumeDownload: vi.fn(async () => ({ success: true })),
      retryDownload: vi.fn(async () => ({ success: true })),
      openDownload: vi.fn(async () => ({ success: true, opened: true })),
      revealDownload: vi.fn(async () => ({ success: true, revealed: true })),
      clickElement: vi.fn(async () => ({ success: true, state })),
      typeInElement: vi.fn(async () => ({ success: true, state })),
      scrollView: vi.fn(async () => ({ success: true, state })),
      createTab: vi.fn(async () => ({ success: true, state })),
      closeTab: vi.fn(async () => ({ success: true, state })),
      duplicateTab: vi.fn(async () => ({ success: true, state })),
      reopenClosedTab: vi.fn(async () => ({ success: true, state })),
      closeOtherTabs: vi.fn(async () => ({ success: true, state })),
      closeTabsToRight: vi.fn(async () => ({ success: true, state })),
      setTabPinned: vi.fn(async () => ({ success: true, state })),
      setTabLayout: vi.fn(async () => ({ success: true, state })),
      createTabGroup: vi.fn(async () => ({ success: true, group: { id: 'group-1', name: 'Trabajo', color: 'blue' as const, collapsed: false } })),
      assignTabGroup: vi.fn(async () => ({ success: true, state })),
      activateTab: vi.fn(async () => ({ success: true, state })),
      detachTab: vi.fn(async () => ({ success: true, state: { ...state, tabs: state.tabs.map((tab) => ({ ...tab, isDetached: true })) } })),
      reattachTab: vi.fn(async () => ({ success: true, state })),
      setViewMode: vi.fn(async () => ({ success: true, state })),
      goBack: vi.fn(async () => ({ success: true, state })),
      goForward: vi.fn(async () => ({ success: true, state })),
      reload: vi.fn(async () => ({ success: true, state })),
      stop: vi.fn(async () => ({ success: true, state })),
      focus: vi.fn(async () => ({ success: true, state })),
      toggleDevTools: vi.fn(async () => ({ success: true, state })),
      setViewport: vi.fn(async () => ({ success: true, state })),
      hide: vi.fn(async () => ({ success: true, state: { ...state, isVisible: false } })),
      readActiveDocument: vi.fn(async () => ({ success: true, document: { tabId: 'tab-1', url: state.url, title: state.title, language: 'es', text: 'Contenido', truncated: false } })),
      listHistory: vi.fn(async () => ({ success: true, history: [] })),
      importHistory: vi.fn(async () => ({ success: true, historyTransfer: { cancelled: false, imported: 0, skipped: 0, duplicates: 0, invalid: 0 } })),
      getProfile: vi.fn(async () => ({ success: true, profile: { id: 'guest', kind: 'guest' as const, label: 'Invitado', persistent: false, managed: false } })),
      setProfile: vi.fn(async (kind: 'authenticated' | 'guest' | 'private') => ({ success: true, profile: { id: kind, kind, label: kind, persistent: kind === 'authenticated', managed: false } })),
      listRecentlyClosedTabs: vi.fn(async () => ({ success: true, recentlyClosedTabs: [] })),
      getHistoryRetention: vi.fn(async () => ({ success: true, historyRetention: { days: null, managed: false } })),
      setHistoryRetention: vi.fn(async (days) => ({ success: true, historyRetention: { days, managed: false, removed: 0 } })),
      listBookmarks: vi.fn(async () => ({ success: true, bookmarks: [] })),
      saveBookmark: vi.fn(async (input) => ({ success: true, bookmark: {
        id: 'bookmark-1', ...input, folderId: input.folderId ?? null, tags: input.tags ?? [], position: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      } })),
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
      listCredentials: vi.fn(async () => ({ success: true, credentials: [], credentialOrigin: 'https://example.com' })),
      setCredentialAutosave: vi.fn(async (enabled) => ({ success: true, canceled: false, credentialAutosaveEnabled: enabled })),
      analyzeCredentialHealth: vi.fn(async () => ({ success: true, credentialHealth: [] })),
      importCredentials: vi.fn(async () => ({ success: true, cancelled: false, imported: 0, updated: 0, skipped: 0 })),
      exportCredentials: vi.fn(async () => ({ success: true, cancelled: false, exported: 0 })),
      recoverCredentials: vi.fn(async () => ({ success: true, credentialRecovery: { cancelled: false, restored: 1 } })),
      agentAudit: vi.fn(async () => ({ success: true })),
      saveCredential: vi.fn(async () => ({ success: true, canceled: false, credential: savedCredential })),
      fillCredential: vi.fn(async () => ({ success: true })),
      removeCredential: vi.fn(async () => ({ success: true, removed: true })),
      listExtensions: vi.fn(async () => ({ success: true, extensions: [] })),
      extensionCatalog: vi.fn(async () => ({ success: true, catalog: [] })),
      restrictExtensionSites: vi.fn(async () => ({ success: true })),
      installExtension: vi.fn(async () => ({ success: true, canceled: true })),
      confirmExtensionInstall: vi.fn(async () => ({ success: true })),
      setExtensionEnabled: vi.fn(async () => ({ success: true })),
      removeExtension: vi.fn(async () => ({ success: true, removed: true })),
      getSitePermissions: vi.fn(async () => ({ success: true, site: emptySite })),
      setSitePermission: vi.fn(async () => ({ success: true, site: emptySite })),
      resetSitePermissions: vi.fn(async () => ({ success: true, site: emptySite })),
      getTabSummaries: vi.fn(async () => ({ success: true, summaries: [] })),
      getTabContent: vi.fn(async () => ({ success: true })),
      onStateChanged: vi.fn(() => listenerCleanup),
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
      waitForReadingToolbarAction: vi.fn(async () => ({ success: true, toolbarAction: { readingId: 'reading-123', action: 'closed' as const } })),
      syncReadingToolbar: vi.fn(async () => ({ success: true, toolbarVisible: true })),
      closeReadingMode: vi.fn(async () => ({ success: true })),
    };
    Object.defineProperty(window, 'integratedBrowser', { value: api, configurable: true, writable: true });
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 200, y: 80, left: 200, top: 80, right: 1000, bottom: 680,
      width: 800, height: 600, toJSON: () => ({}),
    });
  });

  it('abre la superficie, publica el viewport y permite navegar', async () => {
    render(<IntegratedBrowserPanel />);
    await waitFor(() => expect(api.open).toHaveBeenCalled());
    await waitFor(() => expect(api.setViewport).toHaveBeenCalledWith({ x: 200, y: 80, width: 800, height: 600 }));

    const address = screen.getByLabelText('Dirección o búsqueda');
    fireEvent.change(address, { target: { value: 'soflia.ai' } });
    fireEvent.submit(address.closest('form')!);
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('soflia.ai'));
  });

  it('muestra sólo el aviso de la pestaña activa y lo retira al cambiar', async () => {
    render(<IntegratedBrowserPanel />);
    await waitFor(() => expect(api.open).toHaveBeenCalled());
    await screen.findByRole('button', { name: 'Pausar percepción de SofLIA' });
    const onState = (next: IntegratedBrowserState) => vi.mocked(api.onStateChanged).mock.calls.forEach(([callback]) => callback(next));
    const withWarning: IntegratedBrowserState = { ...state, tabs: [
      { ...state.tabs[0], navigationSafety: { action: 'warn', source: 'degraded', reason: 'La conexión no está cifrada.', checkedAt: new Date(0).toISOString() } },
      { ...state.tabs[0], id: 'tab-2', title: 'Segunda' },
    ] };
    act(() => onState(withWarning));
    expect(await screen.findByText('La conexión no está cifrada.')).toBeInTheDocument();
    expect(screen.getByText(/La protección local sigue activa/)).toBeInTheDocument();
    act(() => onState({ ...withWarning, activeTabId: 'tab-2' }));
    expect(screen.queryByText('La conexión no está cifrada.')).not.toBeInTheDocument();
    act(() => onState(withWarning));
    expect(screen.getByText('La conexión no está cifrada.')).toBeInTheDocument();
    act(() => onState(state));
    expect(screen.queryByText('La conexión no está cifrada.')).not.toBeInTheDocument();
  });

  it('permite pausar y reactivar la percepción continua de forma visible', async () => {
    render(<IntegratedBrowserPanel />);
    const toggle = await screen.findByRole('button', { name: 'Pausar percepción de SofLIA' });
    fireEvent.click(toggle);
    await waitFor(() => expect(api.setObservationEnabled).toHaveBeenCalledWith(false));
    expect(await screen.findByRole('button', { name: 'Activar percepción de SofLIA' })).toBeInTheDocument();
  });

  it('separa y reintegra la pestaña activa desde un control accesible', async () => {
    render(<IntegratedBrowserPanel />);
    const detach = await screen.findByRole('button', { name: 'Separar pestaña en otra ventana' });
    fireEvent.click(detach);
    await waitFor(() => expect(api.detachTab).toHaveBeenCalledWith('tab-1'));

    const reattach = await screen.findByRole('button', { name: 'Integrar pestaña en SofLIA' });
    fireEvent.click(reattach);
    await waitFor(() => expect(api.reattachTab).toHaveBeenCalledWith('tab-1'));
  });

  it('sugiere destinos del historial sin duplicar URLs y permite abrirlos', async () => {
    vi.mocked(api.listHistory).mockResolvedValue({
      success: true,
      history: [
        { id: 'visita-1', url: 'https://soflia.ai/aprender', title: 'Aprender', visitedAt: '2026-08-04T12:00:00.000Z' },
        { id: 'visita-2', url: 'https://soflia.ai/aprender', title: 'Aprender otra vez', visitedAt: '2026-08-04T11:00:00.000Z' },
      ],
    });
    render(<IntegratedBrowserPanel />);
    await waitFor(() => expect(api.setViewport).toHaveBeenCalled());
    vi.mocked(api.setViewport).mockClear();
    const address = screen.getByLabelText('Dirección o búsqueda');

    fireEvent.focus(address);
    fireEvent.change(address, { target: { value: 'aprender' } });

    await waitFor(() => expect(api.listHistory).toHaveBeenCalledWith('aprender', 8));
    expect((await screen.findAllByRole('option')).length).toBe(1);
    expect(screen.getByRole('listbox')).toHaveClass('max-w-[42rem]', 'max-h-64');
    expect(screen.getByRole('listbox')).toHaveClass('absolute');
    expect(screen.getByTestId('integrated-browser-toolbar')).toHaveClass('z-50');
    await waitFor(() => expect(api.captureVisible).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.hide).toHaveBeenCalledTimes(1));
    expect(screen.getByAltText('Vista actual del navegador')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /Aprender/ }));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('https://soflia.ai/aprender'));
    await waitFor(() => expect(api.setViewport).toHaveBeenCalled());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByAltText('Vista actual del navegador')).not.toBeInTheDocument());
  });

  it('conserva la geometria de la vista nativa en la captura de sugerencias', async () => {
    vi.mocked(api.listHistory).mockResolvedValue({
      success: true,
      history: [{ id: 'visita-1', url: 'https://soflia.ai/', title: 'SofLIA', visitedAt: '2026-08-04T12:00:00.000Z' }],
    });
    render(<IntegratedBrowserPanel viewportInsets={{ left: 360, right: 24 }} />);
    const address = screen.getByLabelText('Dirección o búsqueda');

    fireEvent.focus(address);
    fireEvent.change(address, { target: { value: 'soflia' } });

    await screen.findByRole('listbox');
    await waitFor(() => expect(screen.getByTestId('integrated-browser-snapshot')).toBeInTheDocument());
    expect(screen.getByTestId('integrated-browser-snapshot')).toHaveStyle({ left: '360px', right: '24px' });
    expect(screen.getByAltText('Vista actual del navegador')).toHaveClass('object-fill');
    expect(screen.getByAltText('Vista actual del navegador')).not.toHaveClass('object-cover');
    expect(api.setViewport).toHaveBeenCalledWith({ x: 560, y: 80, width: 416, height: 600 });
  });

  it('coloca el respaldo en el rectangulo real de la captura en vez de estirarlo', async () => {
    // El proceso principal devuelve la geometria que ocupaba la vista nativa.
    // El contenedor mide 800 x 600 desde (200, 80): sin usar este rectangulo el
    // respaldo se estiraba y la pagina aparecia ampliada bajo el panel.
    vi.mocked(api.captureVisible).mockResolvedValue({
      success: true,
      state,
      screenshot: 'data:image/png;base64,captura',
      captureBounds: { x: 560, y: 80, width: 416, height: 600 },
    });
    vi.mocked(api.listHistory).mockResolvedValue({
      success: true,
      history: [{ id: 'visita-1', url: 'https://soflia.ai/', title: 'SofLIA', visitedAt: '2026-08-04T12:00:00.000Z' }],
    });
    render(<IntegratedBrowserPanel viewportInsets={{ left: 360, right: 24 }} />);

    fireEvent.focus(screen.getByLabelText('Dirección o búsqueda'));
    fireEvent.change(screen.getByLabelText('Dirección o búsqueda'), { target: { value: 'soflia' } });

    await screen.findByRole('listbox');
    await waitFor(() => expect(screen.getByTestId('integrated-browser-snapshot')).toBeInTheDocument());
    expect(screen.getByTestId('integrated-browser-snapshot')).toHaveStyle({
      left: '360px',
      top: '0px',
      width: '416px',
      height: '600px',
    });
  });

  it('restaura la misma vista al cerrar las sugerencias con Escape', async () => {
    vi.mocked(api.listHistory).mockResolvedValue({
      success: true,
      history: [{ id: 'visita-1', url: 'https://soflia.ai/', title: 'SofLIA', visitedAt: '2026-08-04T12:00:00.000Z' }],
    });
    render(<IntegratedBrowserPanel />);
    await waitFor(() => expect(api.setViewport).toHaveBeenCalled());
    vi.mocked(api.setViewport).mockClear();
    const address = screen.getByLabelText('Dirección o búsqueda');

    fireEvent.focus(address);
    fireEvent.change(address, { target: { value: 'soflia' } });
    expect(await screen.findByRole('listbox')).toHaveClass('absolute');
    await waitFor(() => expect(api.hide).toHaveBeenCalledTimes(1));
    vi.mocked(api.setViewport).mockClear();

    fireEvent.keyDown(address, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await waitFor(() => expect(api.setViewport).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByAltText('Vista actual del navegador')).not.toBeInTheDocument());
  });

  it('ignora una captura tardía si las sugerencias ya se cerraron', async () => {
    let resolveCapture!: (value: { success: true; state: IntegratedBrowserState; screenshot: string }) => void;
    vi.mocked(api.captureVisible).mockReturnValueOnce(new Promise((resolve) => { resolveCapture = resolve; }));
    vi.mocked(api.listHistory).mockResolvedValue({
      success: true,
      history: [{ id: 'visita-1', url: 'https://soflia.ai/', title: 'SofLIA', visitedAt: '2026-08-04T12:00:00.000Z' }],
    });
    render(<IntegratedBrowserPanel />);
    const address = screen.getByLabelText('Dirección o búsqueda');

    fireEvent.focus(address);
    fireEvent.change(address, { target: { value: 'soflia' } });
    await screen.findByRole('listbox');
    await waitFor(() => expect(api.captureVisible).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(address, { key: 'Escape' });
    resolveCapture({ success: true, state, screenshot: 'data:image/png;base64,tardia' });

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await waitFor(() => expect(api.setViewport).toHaveBeenCalled());
    expect(api.hide).not.toHaveBeenCalled();
    expect(screen.queryByAltText('Vista actual del navegador')).not.toBeInTheDocument();
  });

  it('espera una ocultación pendiente antes de abrir un gestor', async () => {
    let resolveHide!: (value: { success: true; state: IntegratedBrowserState }) => void;
    vi.mocked(api.hide)
      .mockReturnValueOnce(new Promise((resolve) => { resolveHide = resolve; }))
      .mockResolvedValue({ success: true, state: { ...state, isVisible: false } });
    vi.mocked(api.listHistory).mockResolvedValue({
      success: true,
      history: [{ id: 'visita-1', url: 'https://soflia.ai/', title: 'SofLIA', visitedAt: '2026-08-04T12:00:00.000Z' }],
    });
    render(<IntegratedBrowserPanel />);
    const address = screen.getByLabelText('Dirección o búsqueda');

    fireEvent.focus(address);
    fireEvent.change(address, { target: { value: 'soflia' } });
    await screen.findByRole('listbox');
    await waitFor(() => expect(api.hide).toHaveBeenCalledTimes(1));

    fireEvent.blur(address);
    openTool('Historial');
    expect(api.captureVisible).toHaveBeenCalledTimes(1);
    resolveHide({ success: true, state: { ...state, isVisible: false } });

    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument();
    expect(api.captureVisible).toHaveBeenCalledTimes(2);
    expect(api.hide).toHaveBeenCalledTimes(2);
  });

  it('agrupa el encabezado en dos filas al estilo de un navegador', async () => {
    render(<IntegratedBrowserPanel />);

    // Fila de pestañas: tambien aloja composicion y controles de la superficie,
    // de modo que no ocupa un nivel propio.
    const tabsRow = screen.getByLabelText('Pestañas del navegador').parentElement!;
    expect(within(tabsRow).getByLabelText('Composición de pestañas')).toBeInTheDocument();
    expect(within(tabsRow).getByRole('button', { name: 'Nueva pestaña' })).toBeInTheDocument();
    // Separar, expandir y cerrar son controles de la superficie: viven junto a
    // los modos de composicion, no en la fila de direccion.
    // El control aparece cuando llega el estado con la pestaña activa.
    await screen.findByRole('button', { name: 'Separar pestaña en otra ventana' });
    expect(within(tabsRow).getByRole('button', { name: 'Separar pestaña en otra ventana' })).toBeInTheDocument();

    // Fila de direccion: navegacion, URL y utilidades comparten nivel.
    const addressRow = screen.getByLabelText('Dirección o búsqueda').closest('form')!.parentElement!.parentElement!;
    expect(within(addressRow).getByRole('button', { name: 'Atras' })).toBeInTheDocument();
    // Los cuatro gestores viven en un menu para que la direccion ocupe el ancho.
    expect(within(addressRow).getByRole('button', { name: 'Herramientas del navegador' })).toBeInTheDocument();
    expect(within(addressRow).queryByRole('button', { name: 'Historial' })).not.toBeInTheDocument();
    expect(within(addressRow).getByRole('button', { name: 'Pausar percepción de SofLIA' })).toBeInTheDocument();
  });

  it('abre y cierra el modo lectura sin cubrir la barra del navegador', async () => {
    vi.mocked(api.prepareReadingMode).mockResolvedValue({
      success: true,
      reading: {
        readingId: 'reading-123',
        tabId: 'tab-1',
        url: state.url,
        title: 'Documento ejecutivo',
        language: 'es',
        text: 'Titulo\n\nContenido principal.',
        blocks: [
          { id: 'block-1', kind: 'heading', text: 'Titulo', level: 1, start: 0, end: 6 },
          { id: 'block-2', kind: 'paragraph', text: 'Contenido principal.', level: null, start: 8, end: 28 },
        ],
        selectionOnly: false,
        truncated: false,
      },
    });
    render(<IntegratedBrowserPanel />);

    await waitFor(() => expect(api.setViewport).toHaveBeenCalled());
    vi.mocked(api.setViewport).mockClear();

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir modo lectura' }));

    expect(await screen.findByTestId('browser-reading-mode')).toBeInTheDocument();
    expect(screen.getByTestId('integrated-browser-toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Controlador del modo lectura')).toBeInTheDocument();
    await waitFor(() => expect(api.prepareReadingMode).toHaveBeenCalledWith({ sourceUrl: state.url, selection: undefined }));
    expect(api.hide).not.toHaveBeenCalled();
    expect(api.setViewport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar modo lectura' }));
    await waitFor(() => expect(screen.queryByTestId('browser-reading-mode')).not.toBeInTheDocument());
    await waitFor(() => expect(api.closeReadingMode).toHaveBeenCalledWith({ readingId: 'reading-123' }));
    expect(api.setViewport).not.toHaveBeenCalled();
  });

  it('abre la seleccion enviada por el menu contextual de la pagina', async () => {
    vi.mocked(api.prepareReadingMode).mockResolvedValue({
      success: true,
      reading: {
        readingId: 'reading-selection', tabId: 'tab-1', url: state.url, title: 'Ejemplo', language: 'es',
        text: 'Texto seleccionado',
        blocks: [{ id: 'block-1', kind: 'paragraph', text: 'Texto seleccionado', level: null, start: 0, end: 18 }],
        selectionOnly: true, truncated: false,
      },
    });
    render(<IntegratedBrowserPanel />);
    await waitFor(() => expect(api.onReadingModeRequested).toHaveBeenCalled());
    const listener = vi.mocked(api.onReadingModeRequested).mock.calls[0][0];

    listener({ url: state.url, title: state.title, selection: 'Texto seleccionado' });

    expect(await screen.findByLabelText('Controlador del modo lectura')).toBeInTheDocument();
    expect(api.prepareReadingMode).toHaveBeenCalledWith({ sourceUrl: state.url, selection: 'Texto seleccionado' });
  });

  it('marca la pagina desde la barra de direcciones y la lista en su propia fila', async () => {
    vi.mocked(api.listExtensions).mockResolvedValue({
      success: true,
      extensions: [{
        installId: '12345678-1234-1234-1234-123456789abc',
        extensionId: 'extension-segura',
        name: 'Notas rápidas',
        version: '1.0.0',
        permissions: ['storage'],
        hostPermissions: [],
        enabled: true,
        status: 'loaded',
        error: null,
      }],
    });
    const view = render(<IntegratedBrowserPanel />);

    // Sin marcadores no se dibuja la fila: no debe quedar un nivel vacio.
    expect(screen.queryByLabelText('Marcadores')).not.toBeInTheDocument();

    const addBookmark = screen.getByRole('button', { name: 'Agregar página actual a marcadores' });
    await waitFor(() => expect(addBookmark).toBeEnabled());
    fireEvent.click(addBookmark);
    expect(api.saveBookmark).toHaveBeenCalledWith({ url: 'https://example.com/', title: 'Ejemplo' });
    expect(localStorage.getItem(scopedPreferenceKey('sofLia_integratedBrowserFavorites'))).toBeNull();

    const bookmarks = await screen.findByLabelText('Marcadores');
    fireEvent.click(within(bookmarks).getByRole('button', { name: 'Ejemplo' }));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('https://example.com/'));

    // Las extensiones acompanan a la direccion, no a los marcadores.
    const extensions = await screen.findByLabelText('Extensiones del navegador');
    fireEvent.click(within(extensions).getByRole('button', { name: 'Abrir extensión Notas rápidas' }));
    expect(await screen.findByRole('heading', { name: 'Extensiones' })).toBeInTheDocument();

    vi.mocked(api.listBookmarks).mockResolvedValue({
      success: true,
      bookmarks: [{ id: 'bookmark-1', url: 'https://example.com/', title: 'Ejemplo', folderId: null, tags: [], position: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    });
    view.unmount();
    render(<IntegratedBrowserPanel />);
    expect(within(await screen.findByLabelText('Marcadores')).getByRole('button', { name: 'Ejemplo' })).toBeInTheDocument();
  });

  it('crea pestañas y permite división o superposición con un objetivo explícito', async () => {
    const twoTabs: IntegratedBrowserState = {
      ...state,
      tabs: [
        state.tabs[0],
        { id: 'tab-2', url: 'https://soflia.ai/', title: 'SofLIA', isLoading: false, error: null, isSuspended: false, isDetached: false },
      ],
    };
    vi.mocked(api.open).mockResolvedValue({ success: true, state: twoTabs });
    vi.mocked(api.setViewport).mockResolvedValue({ success: true, state: twoTabs });
    vi.mocked(api.createTab).mockResolvedValue({ success: true, state: twoTabs });
    vi.mocked(api.activateTab).mockResolvedValue({ success: true, state: { ...twoTabs, activeTabId: 'tab-2', url: 'https://soflia.ai/', title: 'SofLIA' } });
    vi.mocked(api.setViewMode).mockResolvedValue({ success: true, state: twoTabs });
    render(<IntegratedBrowserPanel />);

    expect(await screen.findByRole('tab', { name: 'Ejemplo' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva pestaña' }));
    await waitFor(() => expect(api.createTab).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('tab', { name: 'SofLIA' }));
    await waitFor(() => expect(api.activateTab).toHaveBeenCalledWith('tab-2'));
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla dividida' }));
    await waitFor(() => expect(api.setViewMode).toHaveBeenCalledWith('split', undefined));
  });

  it('republica un viewport vivo con inset izquierdo o derecho', async () => {
    const view = render(<IntegratedBrowserPanel viewportInsets={{ left: 320, right: 0 }} />);
    await waitFor(() => expect(api.setViewport).toHaveBeenCalledWith({ x: 520, y: 80, width: 480, height: 600 }));

    view.rerender(<IntegratedBrowserPanel viewportInsets={{ left: 0, right: 300 }} />);

    await waitFor(() => expect(api.setViewport).toHaveBeenCalledWith({ x: 200, y: 80, width: 500, height: 600 }));
    expect(api.open).toHaveBeenCalledTimes(1);
  });

  it('reporta el inicio real del contenido web respecto del navegador', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this.dataset.testid === 'integrated-browser-viewport' ? 120 : 20;
      return {
        x: 200, y: top, left: 200, top, right: 1000, bottom: 720,
        width: 800, height: 600, toJSON: () => ({}),
      };
    });
    const onContentTopChange = vi.fn();

    render(<IntegratedBrowserPanel onContentTopChange={onContentTopChange} />);

    await waitFor(() => expect(onContentTopChange).toHaveBeenCalledWith(100));
  });

  it('muestra control del agente y oculta/libera al desmontar', async () => {
    const agentState = { ...state, agentControlling: true };
    vi.mocked(api.open).mockResolvedValue({ success: true, state: agentState });
    vi.mocked(api.setViewport).mockResolvedValue({ success: true, state: agentState });
    const view = render(<IntegratedBrowserPanel />);
    expect(await screen.findByText('SofLIA controla esta vista')).toBeInTheDocument();
    view.unmount();
    expect(listenerCleanup).toHaveBeenCalled();
    expect(api.hide).toHaveBeenCalled();
  });

  it('abre historial, contrasenas y extensiones en un panel flotante sobre una captura', async () => {
    render(<IntegratedBrowserPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Herramientas del navegador' }));
    const menu = screen.getByRole('menu');
    for (const name of ['Historial', 'Contraseñas', 'Extensiones', 'Inspeccionar']) {
      expect(within(menu).getByRole('menuitem', { name }).querySelector('svg')).not.toBeNull();
    }
    fireEvent.keyDown(document, { key: 'Escape' });
    openTool('Historial');
    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Historial' })).toHaveClass('soflia-browser-dialog--panel');
    // El respaldo visual y la ocultacion de la capa nativa son asincronos:
    // afirmarlos de forma sincrona hacia la prueba inestable bajo carga.
    expect(await screen.findByAltText('Vista actual del navegador')).toBeInTheDocument();
    await waitFor(() => expect(api.captureVisible).toHaveBeenCalled());
    await waitFor(() => expect(api.hide).toHaveBeenCalled());
    await waitFor(() => expect(api.listHistory).toHaveBeenCalled());

    openTool('Contraseñas');
    expect(await screen.findByRole('heading', { name: 'Contraseñas' })).toBeInTheDocument();
    await waitFor(() => expect(api.listCredentials).toHaveBeenCalled());

    openTool('Extensiones');
    expect(await screen.findByRole('heading', { name: 'Extensiones' })).toBeInTheDocument();
    await waitFor(() => expect(api.listExtensions).toHaveBeenCalled());
  });

  it('reabre una visita y permite guardar y rellenar una credencial', async () => {
    vi.mocked(api.listHistory).mockResolvedValue({
      success: true,
      history: [{ id: 'visita-1', url: 'https://example.com/informe', title: 'Informe', visitedAt: new Date().toISOString() }],
    });
    vi.mocked(api.listCredentials).mockResolvedValue({
      success: true,
      credentialOrigin: 'https://example.com',
      credentials: [{ id: '12345678-1234-1234-1234-123456789abc', origin: 'https://example.com', username: 'persona@example.com', createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' }],
    });
    render(<IntegratedBrowserPanel />);

    openTool('Historial');
    fireEvent.click(await screen.findByText('Informe'));
    expect(api.navigate).toHaveBeenCalledWith('https://example.com/informe');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    openTool('Contraseñas');
    await screen.findByRole('heading', { name: 'Contraseñas' });
    await screen.findByText('persona@example.com');
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'persona@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar credencial' }));
    await waitFor(() => expect(api.saveCredential).toHaveBeenCalledWith({ username: 'persona@example.com', password: 'secreto', expectedOrigin: 'https://example.com' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rellenar' }));
    await waitFor(() => expect(api.fillCredential).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc'));
  });

  it('actualiza la cuenta elegida sin revelar el secreto anterior y distingue cancelación', async () => {
    vi.mocked(api.listCredentials).mockResolvedValue({ success: true, credentialOrigin: savedCredential.origin, credentials: [savedCredential] });
    vi.mocked(api.saveCredential).mockResolvedValueOnce({ success: true, canceled: true });
    render(<BrowserManagementPanel tab="credentials" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    fireEvent.click(await screen.findByRole('button', { name: `Actualizar contraseña de ${savedCredential.username}` }));
    expect(screen.getByText(`Sitio de la credencial: ${savedCredential.origin}`)).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario o correo')).toHaveValue(savedCredential.username);
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Nueva-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    expect(await screen.findByText('Actualización cancelada. La contraseña guardada se conserva.')).toBeInTheDocument();
    expect(api.saveCredential).toHaveBeenCalledWith({ id: savedCredential.id, username: savedCredential.username, password: 'Nueva-ficticia', expectedOrigin: savedCredential.origin });
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    expect(api.listCredentials).toHaveBeenCalledTimes(1);
    expect(api.fillCredential).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edición' }));
    expect(screen.getByLabelText('Usuario o correo')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Guardar credencial' })).toBeEnabled();
  });

  it('el guardado sugerido empieza apagado y respeta cancelación y error de main', async () => {
    render(<BrowserManagementPanel tab="credentials" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    const toggle = await screen.findByRole('checkbox', { name: /Sugerir guardar al enviar/ });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).not.toBeChecked();
    vi.mocked(api.setCredentialAutosave).mockResolvedValueOnce({ success: true, canceled: true, credentialAutosaveEnabled: false });
    fireEvent.click(toggle);
    await waitFor(() => expect(api.setCredentialAutosave).toHaveBeenCalledWith(true));
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    vi.mocked(api.setCredentialAutosave).mockRejectedValueOnce(new Error('Fallo nativo'));
    fireEvent.click(toggle);
    expect(await screen.findByText('No se pudo cambiar el guardado sugerido. Vuelve a intentarlo.')).toBeInTheDocument();
    expect(toggle).toBeChecked();
    expect(api.saveCredential).not.toHaveBeenCalled();
  });

  it('bloquea envíos duplicados, limpia el secreto ante fallo y permite reintentar', async () => {
    let finish!: (result: IntegratedBrowserDataResponse) => void;
    vi.mocked(api.saveCredential).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<BrowserManagementPanel tab="credentials" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar credencial' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'cuenta' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Ficticia' } });
    const form = screen.getByLabelText('Contraseña').closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(api.saveCredential).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Contraseña')).toBeDisabled();
    await act(async () => finish({ success: false, error: 'El sitio cambió.' }));
    expect(screen.getByText('El sitio cambió.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    vi.mocked(api.saveCredential).mockRejectedValueOnce(new Error('Detalle privado ficticio'));
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Otro-secreto' } });
    fireEvent.submit(form);
    expect(await screen.findByText('No se pudo guardar la credencial. Vuelve a intentarlo.')).toBeInTheDocument();
    expect(screen.queryByText('Detalle privado ficticio')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Guardar credencial' })).toBeEnabled();
  });

  it('no permite guardar sin origen verificado y recupera una carga fallida', async () => {
    vi.mocked(api.listCredentials).mockResolvedValueOnce({ success: true, credentials: [] });
    render(<BrowserManagementPanel tab="credentials" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    const retry = await screen.findByRole('button', { name: 'Reintentar carga' });
    expect(screen.getByRole('button', { name: 'Guardar credencial' })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText('Contraseña').closest('form')!);
    expect(api.saveCredential).not.toHaveBeenCalled();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar credencial' })).toBeEnabled());
    expect(api.listCredentials).toHaveBeenCalledTimes(2);
  });

  it('restaura la bóveda ausente aun sin origen disponible y recarga sin pedir secretos', async () => {
    vi.mocked(api.listCredentials).mockResolvedValueOnce({ success: false, error: 'Falta la bóveda.' });
    render(<BrowserManagementPanel tab="credentials" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    await screen.findByText('Falta la bóveda.');
    const restore = await screen.findByRole('button', { name: 'Restaurar bóveda desde respaldo' });
    expect(restore).toBeEnabled(); fireEvent.click(restore);
    await waitFor(() => expect(api.listCredentials).toHaveBeenCalledTimes(2));
    expect(api.recoverCredentials).toHaveBeenCalledWith();
    expect(api.fillCredential).not.toHaveBeenCalled(); expect(api.exportCredentials).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('cancelar recuperación de bóveda no recarga y un rechazo permite reintentar', async () => {
    vi.mocked(api.recoverCredentials).mockResolvedValueOnce({ success: true, credentialRecovery: { cancelled: true, restored: 0 } })
      .mockRejectedValueOnce(new Error('C:/privado/clave'));
    render(<BrowserManagementPanel tab="credentials" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    const restore = await screen.findByRole('button', { name: 'Restaurar bóveda desde respaldo' });
    await waitFor(() => expect(restore).toBeEnabled());
    fireEvent.click(restore); await waitFor(() => expect(restore).toBeEnabled());
    expect(api.listCredentials).toHaveBeenCalledTimes(1);
    fireEvent.click(restore); await waitFor(() => expect(api.recoverCredentials).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(restore).toBeEnabled());
    expect(screen.queryByText('C:/privado/clave')).not.toBeInTheDocument();
    expect(api.listCredentials).toHaveBeenCalledTimes(1);
  });

  it('no anuncia guardado si el puente devuelve éxito sin credencial confirmada', async () => {
    vi.mocked(api.saveCredential).mockResolvedValueOnce({ success: true });
    render(<BrowserManagementPanel tab="credentials" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar credencial' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'cuenta' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Ficticia' } });
    fireEvent.submit(screen.getByLabelText('Contraseña').closest('form')!);
    expect(await screen.findByText('No se confirmó el guardado. Revisa la biblioteca antes de reintentar.')).toBeInTheDocument();
    expect(screen.queryByText('Credencial guardada.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('confirma el borrado de historial dentro del renderer antes de mutar', async () => {
    vi.mocked(api.listHistory).mockResolvedValue({
      success: true,
      history: [{ id: 'visita-1', url: 'https://example.com/', title: 'Ejemplo', visitedAt: '2026-08-04T12:00:00.000Z' }],
    });
    render(<IntegratedBrowserPanel />);

    openTool('Historial');
    expect((await screen.findAllByText('Ejemplo')).length).toBeGreaterThan(0);
    // El boton solo se habilita cuando el historial termino de cargar: hacer
    // clic antes no abre nada porque la accion no tendria sobre que actuar.
    const clearButton = await screen.findByRole('button', { name: 'Borrar historial' });
    await waitFor(() => expect(clearButton).toBeEnabled());
    fireEvent.click(clearButton);

    const confirmation = await screen.findByRole('dialog', { name: 'Borrar todo el historial' });
    expect(confirmation).toBeInTheDocument();
    expect(api.clearHistory).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Borrar historial' }));
    await waitFor(() => expect(api.clearHistory).toHaveBeenCalledTimes(1));
  });

  it('muestra permisos y confirma una extension con token efimero', async () => {
    vi.mocked(api.installExtension).mockResolvedValueOnce({
      success: true,
      canceled: false,
      preview: {
        token: '12345678-1234-1234-1234-123456789abc',
        name: 'Extension segura',
        version: '1.0.0',
        permissions: ['storage'],
        hostPermissions: ['https://example.com/*'],
      },
    });
    render(<IntegratedBrowserPanel />);
    openTool('Extensiones');
    await screen.findByRole('heading', { name: 'Extensiones' });
    fireEvent.click(screen.getByRole('button', { name: 'Instalar carpeta' }));

    expect(await screen.findByRole('dialog', { name: 'Instalar Extension segura' })).toHaveTextContent('https://example.com/*');
    fireEvent.click(screen.getByRole('button', { name: 'Instalar extensión' }));
    await waitFor(() => expect(api.confirmExtensionInstall).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc'));
  });

  it('muestra error de extensiones y respeta cancelacion de instalacion', async () => {
    vi.mocked(api.listExtensions).mockResolvedValue({ success: false, error: 'Registro no disponible' });
    render(<IntegratedBrowserPanel />);
    openTool('Extensiones');
    expect(await screen.findByRole('alert')).toHaveTextContent('Registro no disponible');

    fireEvent.click(screen.getByRole('button', { name: 'Instalar carpeta' }));
    await waitFor(() => expect(api.installExtension).toHaveBeenCalled());
    expect(api.listExtensions).toHaveBeenCalledTimes(2);
  });

  it('muestra permisos instalados y permite reintentar una extensión con error', async () => {
    vi.mocked(api.listExtensions).mockResolvedValue({
      success: true,
      extensions: [{
        installId: '12345678-1234-1234-1234-123456789abc',
        extensionId: null,
        name: 'Extensión recuperable',
        version: '1.0.0',
        permissions: ['storage'],
        hostPermissions: ['https://example.com/*'],
        enabled: true,
        status: 'error',
        error: 'No se pudo cargar la extensión.',
      }],
    });
    render(<IntegratedBrowserPanel />);
    openTool('Extensiones');

    expect(await screen.findByText('storage')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/*')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(api.setExtensionEnabled).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc', true));
  });

  it('mantiene cerrado el gestor si la capa nativa no puede ocultarse', async () => {
    vi.mocked(api.hide).mockResolvedValueOnce({ success: false, error: 'No se pudo ocultar la vista' });
    render(<IntegratedBrowserPanel />);

    openTool('Historial');

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo ocultar la vista');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('recorre las secciones del gestor con flechas', async () => {
    render(<IntegratedBrowserPanel />);
    openTool('Historial');
    const historyTab = await screen.findByRole('tab', { name: 'Historial' });

    fireEvent.keyDown(historyTab, { key: 'ArrowRight' });

    expect(await screen.findByRole('heading', { name: 'Contraseñas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contraseñas' })).toHaveAttribute('tabindex', '0');
  });

  it('no captura ni oculta periódicamente la vista mientras el agente controla', async () => {
    const controlling = { ...state, agentControlling: true };
    vi.mocked(api.open).mockResolvedValue({ success: true, state: controlling });
    vi.mocked(api.setViewport).mockResolvedValue({ success: true, state: controlling });
    render(<IntegratedBrowserPanel viewportInsets={{ left: 360, right: 0 }} />);

    await screen.findByText('SofLIA controla esta vista');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.captureVisible).not.toHaveBeenCalled();
    expect(api.hide).not.toHaveBeenCalled();
  });

  it('confirma antes de aplicar retención y permite seleccionar una pestaña cerrada', async () => {
    vi.mocked(api.listRecentlyClosedTabs).mockResolvedValue({ success: true, recentlyClosedTabs: [{ id: 'cerrada', title: 'Lectura', url: 'https://example.com', closedAt: new Date().toISOString() }] });
    const onClose = vi.fn();
    render(<BrowserHistorySettings onChanged={vi.fn()} onClose={onClose} />);
    const retention = screen.getByLabelText('Retención del historial');
    await waitFor(() => expect(retention).toBeEnabled());
    fireEvent.change(retention, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar retención' }));
    expect(api.setHistoryRetention).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Cambiar retención del historial' });
    expect(dialog).toHaveTextContent('respaldo del historial antiguo y las copias locales de recuperación se eliminan completos');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar retención' }));
    await waitFor(() => expect(api.setHistoryRetention).toHaveBeenCalledWith(30));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cambiar retención del historial' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Cerradas recientemente (1)'));
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir Lectura' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.reopenClosedTab).toHaveBeenCalledWith('cerrada');
  });

  it('no permite editar la retención administrada', async () => {
    vi.mocked(api.getHistoryRetention).mockResolvedValue({ success: true, historyRetention: { days: 7, managed: true } });
    render(<BrowserHistorySettings onChanged={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText(/Administrado por tu organización/);
    expect(screen.getByLabelText('Retención del historial')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aplicar retención' })).toBeDisabled();
  });

  it('importa historial desde el selector nativo y refresca el panel con el resumen', async () => {
    const onChanged = vi.fn();
    vi.mocked(api.importHistory).mockResolvedValueOnce({ success: true, historyTransfer: { cancelled: false, imported: 4, skipped: 2, duplicates: 1, invalid: 1 } });
    render(<BrowserHistorySettings onChanged={onChanged} onClose={vi.fn()} />);
    await screen.findByRole('button', { name: 'Importar historial' });
    fireEvent.click(screen.getByRole('button', { name: 'Importar historial' }));
    await waitFor(() => expect(api.importHistory).toHaveBeenCalledWith());
    expect(await screen.findByRole('status')).toHaveTextContent('4 visitas nuevas, 2 omitidas, 1 duplicadas y 1 inválidas');
    expect(onChanged).toHaveBeenCalled();
  });

  it('permite editar un marcador y recupera el formulario tras un rechazo del puente', async () => {
    vi.mocked(api.listBookmarks).mockResolvedValue({ success: true, bookmarks: [{
      id: 'uno', title: 'Manual', url: 'https://example.com', folderId: 'Trabajo', tags: ['lectura'], position: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }] });
    vi.mocked(api.saveBookmark).mockRejectedValueOnce(new Error('Puente desconectado'));
    render(<BrowserManagementPanel tab="bookmarks" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Manual' }));
    expect(screen.getByLabelText('Carpeta')).toHaveValue('Trabajo');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Manual actualizado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar marcador' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Puente desconectado');
    expect(screen.getByRole('button', { name: 'Guardar marcador' })).toBeEnabled();
    expect(api.saveBookmark).toHaveBeenCalledWith(expect.objectContaining({ id: 'uno', title: 'Manual actualizado', folderId: 'Trabajo', tags: ['lectura'] }));
    expect(screen.getByLabelText('Título')).toHaveValue('Manual actualizado');
  });

  it('ofrece recuperación aun si la biblioteca está dañada y recarga tras confirmación nativa', async () => {
    vi.mocked(api.listBookmarks).mockResolvedValueOnce({ success: false, error: 'Archivo dañado.' });
    render(<BrowserManagementPanel tab="bookmarks" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Archivo dañado');
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar respaldo' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Se recuperaron 2 marcadores');
    expect(api.recoverBookmarks).toHaveBeenCalledWith(); expect(api.listBookmarks).toHaveBeenCalledTimes(2);
  });

  it('cancelar la recuperación no anuncia éxito y un error permite reintentar', async () => {
    vi.mocked(api.recoverBookmarks).mockResolvedValueOnce({ success: true, bookmarkRecovery: { cancelled: true, restored: 0 } })
      .mockResolvedValueOnce({ success: false, error: 'El respaldo cambió.' });
    render(<BrowserManagementPanel tab="bookmarks" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    await screen.findByText('Sin marcadores'); const button = screen.getByRole('button', { name: 'Recuperar respaldo' });
    fireEvent.click(button); await waitFor(() => expect(button).toBeEnabled()); expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(button); expect(await screen.findByRole('alert')).toHaveTextContent('El respaldo cambió'); expect(button).toBeEnabled();
  });

  it('muestra nuevos, actualizados y descartados después de la confirmación nativa', async () => {
    vi.mocked(api.importBookmarksHtml).mockResolvedValue({ success: true, bookmarkTransfer: {
      cancelled: false, imported: 2, updated: 1, skipped: 3, invalid: 1, duplicates: 2,
    } });
    render(<BrowserManagementPanel tab="bookmarks" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    await screen.findByText('Sin marcadores');
    fireEvent.click(screen.getByRole('button', { name: 'Importar HTML' }));
    expect(await screen.findByRole('status')).toHaveTextContent('2 nuevos, 1 actualizados y 3 omitidos');
    expect(screen.getByRole('status')).toHaveTextContent('1 inválidos y 2 duplicados');
    expect(api.importBookmarksHtml).toHaveBeenCalledWith();
    expect(api.listBookmarks).toHaveBeenCalledTimes(2);
  });

  it('cancelar no muestra éxito y un fallo permite reintentar la importación', async () => {
    vi.mocked(api.importBookmarksHtml).mockResolvedValueOnce({ success: true, bookmarkTransfer: { cancelled: true } })
      .mockResolvedValueOnce({ success: false, error: 'Los marcadores cambiaron. Revisa de nuevo.' });
    render(<BrowserManagementPanel tab="bookmarks" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    await screen.findByText('Sin marcadores');
    const button = screen.getByRole('button', { name: 'Importar HTML' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(api.listBookmarks).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Los marcadores cambiaron');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('aplica juntos texto, dominio y fecha del historial sin mezclar respuestas antiguas', async () => {
    let resolveOld!: (value: Awaited<ReturnType<typeof api.listHistory>>) => void;
    vi.mocked(api.listHistory).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    render(<BrowserManagementPanel tab="history" onTabChange={vi.fn()} onClose={vi.fn()} onFillCredential={api.fillCredential} />);
    await waitFor(() => expect(api.listHistory).toHaveBeenCalledWith('', 100, { offset: 0, domain: undefined, from: undefined }));
    fireEvent.change(screen.getByLabelText('Buscar en historial'), { target: { value: 'manual' } });
    fireEvent.change(screen.getByLabelText('Filtrar dominio'), { target: { value: 'example.com' } });
    fireEvent.change(screen.getByLabelText('Filtrar fecha'), { target: { value: 'week' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(api.listHistory).toHaveBeenLastCalledWith('manual', 100, { offset: 0, domain: 'example.com', from: expect.any(String) }));
    await act(async () => resolveOld({ success: true, history: [{ id: 'viejo', title: 'Respuesta obsoleta', url: 'https://old.example', visitedAt: new Date().toISOString() }] }));
    expect(screen.queryByText('Respuesta obsoleta')).not.toBeInTheDocument();
  });

  it('no muestra un marcador guardado cuando falla la escritura', async () => {
    vi.mocked(api.saveBookmark).mockResolvedValue({ success: false, error: 'Disco no disponible' });
    render(<IntegratedBrowserPanel />);
    const add = screen.getByRole('button', { name: 'Agregar página actual a marcadores' });
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    expect(await screen.findByText('Disco no disponible')).toBeInTheDocument();
    expect(screen.queryByLabelText('Marcadores')).not.toBeInTheDocument();
    expect(add).toHaveAttribute('aria-pressed', 'false');
  });

  it('pide consentimiento por sitio antes de que SofLIA actúe', async () => {
    render(<IntegratedBrowserPanel />);
    const callback = vi.mocked(api.onAgentPolicyPrompt).mock.calls[0]?.[0];
    expect(callback).toBeTypeOf('function');
    act(() => callback?.({ id: 'agent-1', origin: 'https://example.com', capability: 'act', label: 'interactuar con la página' }));
    expect(await screen.findByRole('dialog', { name: 'Permiso de SofLIA' })).toHaveTextContent('interactuar con la página');
    fireEvent.click(screen.getByRole('button', { name: 'Permitir esta vez' }));
    expect(api.decideAgentPolicy).toHaveBeenCalledWith({ id: 'agent-1', decision: 'allow-once' });
  });
});
