import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IntegratedBrowserPanel } from '../../components/browser/IntegratedBrowserPanel';
import type {
  BrowserSitePermissionSummary,
  IntegratedBrowserApi,
  IntegratedBrowserState,
} from '../../services/integrated-browser-service';
import { scopedPreferenceKey } from '../../services/user-scope';

const state: IntegratedBrowserState = {
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
      captureVisible: vi.fn(async () => ({ success: true, state, screenshot: 'data:image/png;base64,captura' })),
      getObservation: vi.fn(async () => ({ success: true, state, observation: null, observationStatus: { enabled: true, capturing: false, intervalMs: 10_000, lastCapturedAt: null, lastError: null } })),
      setObservationEnabled: vi.fn(async (enabled) => ({ success: true, state, observation: null, observationStatus: { enabled, capturing: false, intervalMs: 10_000, lastCapturedAt: null, lastError: null } })),
      open: vi.fn(async () => ({ success: true, state })),
      navigate: vi.fn(async () => ({ success: true, state })),
      clickElement: vi.fn(async () => ({ success: true, state })),
      typeInElement: vi.fn(async () => ({ success: true, state })),
      scrollView: vi.fn(async () => ({ success: true, state })),
      createTab: vi.fn(async () => ({ success: true, state })),
      closeTab: vi.fn(async () => ({ success: true, state })),
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
      getSitePermissions: vi.fn(async () => ({ success: true, site: emptySite })),
      setSitePermission: vi.fn(async () => ({ success: true, site: emptySite })),
      resetSitePermissions: vi.fn(async () => ({ success: true, site: emptySite })),
      getTabSummaries: vi.fn(async () => ({ success: true, summaries: [] })),
      getTabContent: vi.fn(async () => ({ success: true })),
      onStateChanged: vi.fn(() => listenerCleanup),
      onOpenRequested: vi.fn(() => vi.fn()),
      onSelectionAction: vi.fn(() => vi.fn()),
      onReadingModeRequested: vi.fn(() => vi.fn()),
      onSitePermissionsChanged: vi.fn(() => vi.fn()),
      decidePermissionPrompt: vi.fn(async () => ({ success: true, resolved: true })),
      onPermissionPrompt: vi.fn(() => vi.fn()),
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
    expect(localStorage.getItem(scopedPreferenceKey('sofLia_integratedBrowserFavorites'))).toContain('https://example.com/');

    const bookmarks = await screen.findByLabelText('Marcadores');
    fireEvent.click(within(bookmarks).getByRole('button', { name: 'Ejemplo' }));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('https://example.com/'));

    // Las extensiones acompanan a la direccion, no a los marcadores.
    const extensions = await screen.findByLabelText('Extensiones del navegador');
    fireEvent.click(within(extensions).getByRole('button', { name: 'Abrir extensión Notas rápidas' }));
    expect(await screen.findByRole('heading', { name: 'Extensiones' })).toBeInTheDocument();

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
    await waitFor(() => expect(api.saveCredential).toHaveBeenCalledWith({ username: 'persona@example.com', password: 'secreto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rellenar' }));
    await waitFor(() => expect(api.fillCredential).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc'));
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
});
