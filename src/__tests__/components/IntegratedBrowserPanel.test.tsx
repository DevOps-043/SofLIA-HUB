import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IntegratedBrowserPanel } from '../../components/browser/IntegratedBrowserPanel';
import type { IntegratedBrowserApi, IntegratedBrowserState } from '../../services/integrated-browser-service';

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
};

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
      listCredentials: vi.fn(async () => ({ success: true, credentials: [] })),
      saveCredential: vi.fn(async () => ({ success: true })),
      fillCredential: vi.fn(async () => ({ success: true })),
      removeCredential: vi.fn(async () => ({ success: true, removed: true })),
      listExtensions: vi.fn(async () => ({ success: true, extensions: [] })),
      installExtension: vi.fn(async () => ({ success: true, canceled: true })),
      confirmExtensionInstall: vi.fn(async () => ({ success: true })),
      setExtensionEnabled: vi.fn(async () => ({ success: true })),
      removeExtension: vi.fn(async () => ({ success: true, removed: true })),
      onStateChanged: vi.fn(() => listenerCleanup),
      onOpenRequested: vi.fn(() => vi.fn()),
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
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(api.captureVisible).toHaveBeenCalledTimes(1);
    resolveHide({ success: true, state: { ...state, isVisible: false } });

    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument();
    expect(api.captureVisible).toHaveBeenCalledTimes(2);
    expect(api.hide).toHaveBeenCalledTimes(2);
  });

  it('oculta y restaura la barra secundaria conservando la preferencia', () => {
    render(<IntegratedBrowserPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar barra de herramientas' }));
    expect(screen.queryByRole('button', { name: 'Historial' })).not.toBeInTheDocument();
    expect(localStorage.getItem('sofLia_integratedBrowserUtilityBarVisible')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar barra de herramientas' }));
    expect(screen.getByRole('button', { name: 'Historial' })).toBeInTheDocument();
  });

  it('guarda, abre y elimina favoritos y muestra extensiones en la misma barra', async () => {
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
    const quickAccess = screen.getByLabelText('Favoritos y extensiones');
    const addFavorite = within(quickAccess).getByRole('button', { name: 'Agregar página actual a favoritos' });

    await waitFor(() => expect(addFavorite).toBeEnabled());
    fireEvent.click(addFavorite);
    expect(localStorage.getItem('sofLia_integratedBrowserFavorites')).toContain('https://example.com/');
    fireEvent.click(within(quickAccess).getByRole('button', { name: 'Ejemplo' }));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('https://example.com/'));

    expect(await within(quickAccess).findByRole('button', { name: 'Abrir extensión Notas rápidas' })).toBeInTheDocument();
    fireEvent.click(within(quickAccess).getByRole('button', { name: 'Abrir extensión Notas rápidas' }));
    expect(await screen.findByRole('heading', { name: 'Extensiones' })).toBeInTheDocument();

    view.unmount();
    render(<IntegratedBrowserPanel />);
    const restored = screen.getByLabelText('Favoritos y extensiones');
    expect(within(restored).getByRole('button', { name: 'Ejemplo' })).toBeInTheDocument();
    fireEvent.click(within(restored).getByRole('button', { name: 'Quitar Ejemplo de favoritos' }));
    expect(within(restored).queryByRole('button', { name: 'Ejemplo' })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Pestaña superpuesta' }));
    await waitFor(() => expect(api.setViewMode).toHaveBeenCalledWith('overlay', undefined));
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
    expect(screen.getByRole('button', { name: 'Historial' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Contrasenas' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Extensiones' }).querySelector('svg')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Historial' })).toHaveClass('soflia-browser-dialog--panel');
    // El respaldo visual y la ocultacion de la capa nativa son asincronos:
    // afirmarlos de forma sincrona hacia la prueba inestable bajo carga.
    expect(await screen.findByAltText('Vista actual del navegador')).toBeInTheDocument();
    await waitFor(() => expect(api.captureVisible).toHaveBeenCalled());
    await waitFor(() => expect(api.hide).toHaveBeenCalled());
    await waitFor(() => expect(api.listHistory).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Contrasenas' }));
    expect(await screen.findByRole('heading', { name: 'Contraseñas' })).toBeInTheDocument();
    await waitFor(() => expect(api.listCredentials).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Extensiones' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    fireEvent.click(await screen.findByText('Informe'));
    expect(api.navigate).toHaveBeenCalledWith('https://example.com/informe');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Contrasenas' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Extensiones' }));
    await screen.findByRole('heading', { name: 'Extensiones' });
    fireEvent.click(screen.getByRole('button', { name: 'Instalar carpeta' }));

    expect(await screen.findByRole('dialog', { name: 'Instalar Extension segura' })).toHaveTextContent('https://example.com/*');
    fireEvent.click(screen.getByRole('button', { name: 'Instalar extensión' }));
    await waitFor(() => expect(api.confirmExtensionInstall).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc'));
  });

  it('muestra error de extensiones y respeta cancelacion de instalacion', async () => {
    vi.mocked(api.listExtensions).mockResolvedValue({ success: false, error: 'Registro no disponible' });
    render(<IntegratedBrowserPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Extensiones' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Extensiones' }));

    expect(await screen.findByText('storage')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/*')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(api.setExtensionEnabled).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc', true));
  });

  it('mantiene cerrado el gestor si la capa nativa no puede ocultarse', async () => {
    vi.mocked(api.hide).mockResolvedValueOnce({ success: false, error: 'No se pudo ocultar la vista' });
    render(<IntegratedBrowserPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo ocultar la vista');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('recorre las secciones del gestor con flechas', async () => {
    render(<IntegratedBrowserPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
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
