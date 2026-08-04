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
});
