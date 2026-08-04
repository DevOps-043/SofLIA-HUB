import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
};

describe('IntegratedBrowserPanel', () => {
  let api: IntegratedBrowserApi;
  let listenerCleanup: () => void;

  beforeEach(() => {
    listenerCleanup = vi.fn();
    api = {
      getState: vi.fn(async () => ({ success: true, state })),
      open: vi.fn(async () => ({ success: true, state })),
      navigate: vi.fn(async () => ({ success: true, state })),
      goBack: vi.fn(async () => ({ success: true, state })),
      goForward: vi.fn(async () => ({ success: true, state })),
      reload: vi.fn(async () => ({ success: true, state })),
      stop: vi.fn(async () => ({ success: true, state })),
      focus: vi.fn(async () => ({ success: true, state })),
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

    const address = screen.getByLabelText('Direccion o busqueda');
    fireEvent.change(address, { target: { value: 'soflia.ai' } });
    fireEvent.submit(address.closest('form')!);
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('soflia.ai'));
  });

  it('muestra control del agente y oculta/libera al desmontar', async () => {
    const agentState = { ...state, agentControlling: true };
    vi.mocked(api.open).mockResolvedValue({ success: true, state: agentState });
    vi.mocked(api.setViewport).mockResolvedValue({ success: true, state: agentState });
    const view = render(<IntegratedBrowserPanel />);
    expect(await screen.findByText('SofLIA esta usando el navegador')).toBeInTheDocument();
    view.unmount();
    expect(listenerCleanup).toHaveBeenCalled();
    expect(api.hide).toHaveBeenCalled();
  });

  it('abre historial, contrasenas y extensiones desde la barra lateral', async () => {
    render(<IntegratedBrowserPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument();
    expect(api.listHistory).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Contrasenas' }));
    expect(await screen.findByRole('heading', { name: 'Contrasenas' })).toBeInTheDocument();
    expect(api.listCredentials).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Extensiones' }));
    expect(await screen.findByRole('heading', { name: 'Extensiones' })).toBeInTheDocument();
    expect(api.listExtensions).toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole('button', { name: 'Contrasenas' }));
    await screen.findByText('persona@example.com');
    fireEvent.change(screen.getByPlaceholderText('Usuario o correo'), { target: { value: 'persona@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Contrasena'), { target: { value: 'secreto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.saveCredential).toHaveBeenCalledWith({ username: 'persona@example.com', password: 'secreto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rellenar' }));
    expect(api.fillCredential).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc');
  });

  it('muestra error de extensiones y respeta cancelacion de instalacion', async () => {
    vi.mocked(api.listExtensions).mockResolvedValueOnce({ success: false, error: 'Registro no disponible' });
    render(<IntegratedBrowserPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Extensiones' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Registro no disponible');

    fireEvent.click(screen.getByRole('button', { name: 'Instalar carpeta' }));
    await waitFor(() => expect(api.installExtension).toHaveBeenCalled());
    expect(api.listExtensions).toHaveBeenCalledTimes(1);
  });
});
