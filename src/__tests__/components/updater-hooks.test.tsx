import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUpdatePanel } from '../../components/update-panel/useUpdatePanel';
import { useUpdaterPanel } from '../../components/update-panel/useUpdaterPanel';
import { useUpdateNotification } from '../../components/update-notification/useUpdateNotification';

function installBridge() {
  Object.defineProperty(window, 'updater', { configurable: true, value: {
    getStatus: vi.fn(async () => ({ state: 'downloaded', currentVersion: '1.0.0' })),
    installUpdate: vi.fn(async () => ({ success: false, error: 'Salida cancelada' })),
    onUpdateAvailable: vi.fn(), onDownloadProgress: vi.fn(), onUpdateDownloaded: vi.fn(), onError: vi.fn(), removeListeners: vi.fn(),
  } });
}

afterEach(() => { Reflect.deleteProperty(window, 'updater'); });

describe('errores visibles de instalación', () => {
  it('libera la búsqueda y muestra el fallo aunque no llegue un evento de main', async () => {
    installBridge();
    window.updater.checkForUpdates = vi.fn(async () => ({ success: false, error: 'Red no disponible' }));
    const { result, unmount } = renderHook(() => useUpdatePanel());
    await act(async () => { await result.current.handleCheck(); });
    expect(result.current.checking).toBe(false);
    expect(result.current.error).toBe('Red no disponible');
    unmount();
  });

  it.each(['available', 'not-available', 'idle', 'error'] as const)('finaliza la búsqueda con estado %s sin depender de eventos', async (state) => {
    installBridge();
    window.updater.checkForUpdates = vi.fn(async () => ({ success: true }));
    window.updater.getStatus = vi.fn(async () => ({ state, currentVersion: '0.9.9', availableVersion: null, releaseNotes: null, downloadProgress: null, error: state === 'error' ? 'Servicio no disponible' : null }));
    const { result, unmount } = renderHook(() => useUpdatePanel());
    await act(async () => { await result.current.handleCheck(); });
    expect(result.current.checking).toBe(false);
    expect(result.current.state).toBe(state);
    if (state === 'error') expect(result.current.error).toBe('Servicio no disponible');
    unmount();
  });

  it.each([useUpdatePanel, useUpdaterPanel])('el panel conserva el error de main', async (usePanel) => {
    installBridge();
    const { result, unmount } = renderHook(() => usePanel());
    await act(async () => { await result.current.handleInstall(); });
    expect(result.current.error).toBe('Salida cancelada');
    unmount();
  });

  it('la notificación no ignora una instalación cancelada', async () => {
    installBridge();
    const { result, unmount } = renderHook(() => useUpdateNotification());
    await act(async () => { await result.current.handleInstall(); });
    expect(result.current.state).toMatchObject({ phase: 'error', error: 'Salida cancelada' });
    unmount();
  });
});
