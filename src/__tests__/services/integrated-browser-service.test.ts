import { beforeEach, describe, expect, it, vi } from 'vitest';
import { integratedBrowserService, type IntegratedBrowserApi } from '../../services/integrated-browser-service';

describe('wrapper renderer del navegador integrado', () => {
  let api: IntegratedBrowserApi;

  beforeEach(() => {
    api = {
      getState: vi.fn(async () => ({ success: true })),
      open: vi.fn(async () => ({ success: true })),
      navigate: vi.fn(async () => ({ success: true })),
      goBack: vi.fn(async () => ({ success: true })),
      goForward: vi.fn(async () => ({ success: true })),
      reload: vi.fn(async () => ({ success: true })),
      stop: vi.fn(async () => ({ success: true })),
      focus: vi.fn(async () => ({ success: true })),
      setViewport: vi.fn(async () => ({ success: true })),
      hide: vi.fn(async () => ({ success: true })),
      onStateChanged: vi.fn(() => vi.fn()),
      onOpenRequested: vi.fn(() => vi.fn()),
    };
    Object.defineProperty(window, 'integratedBrowser', { value: api, configurable: true, writable: true });
  });

  it('delega navegacion y viewport con tipos cerrados', async () => {
    await integratedBrowserService.navigate('example.com');
    await integratedBrowserService.setViewport({ x: 200, y: 80, width: 800, height: 600 });
    expect(api.navigate).toHaveBeenCalledWith('example.com');
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
});
