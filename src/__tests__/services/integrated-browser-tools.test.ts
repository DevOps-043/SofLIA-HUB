import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeIntegratedBrowserTool } from '../../services/gemini-chat/integrated-browser-tools';
import { buildModelTools } from '../../services/gemini-chat/model-config';

function observation() {
  return {
    success: true,
    state: { isVisible: true },
    observation: {
      id: 'obs-1',
      sequence: 1,
      capturedAt: '2026-08-05T12:00:00.000Z',
      tabId: 'tab-1',
      screenshot: 'data:image/png;base64,c2VjcmV0by12aXN1YWw=',
      dom: {
        title: 'Repositorio',
        url: 'https://github.com/example/repo',
        language: 'es',
        text: 'README público',
        headings: [{ level: 1, text: 'README', scope: 'document' }],
        landmarks: [],
        controls: [{ ref: 'dom-1', tag: 'a', role: 'link', name: 'Código', text: 'Código', type: '', href: 'https://github.com/example/repo', disabled: false, checked: null, rect: { x: 1, y: 1, width: 10, height: 10 }, scope: 'document' }],
        frames: [],
        viewport: { width: 1200, height: 800, scrollX: 0, scrollY: 0, documentWidth: 1200, documentHeight: 1200 },
        truncated: false,
      },
    },
  };
}

function installBrowserApi() {
  const api = {
    getState: vi.fn(async () => ({ success: true, state: { isVisible: true } })),
    getObservation: vi.fn(async (): Promise<Record<string, unknown>> => observation()),
    navigate: vi.fn(async () => ({ success: true, state: { isVisible: true } })),
  };
  Object.defineProperty(window, 'integratedBrowser', { configurable: true, value: api });
  return api;
}

describe('herramientas deterministas del navegador integrado', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'integratedBrowser');
  });

  it('IBT-001: read_browser_dom devuelve DOM saneado sin captura base64', async () => {
    const api = installBrowserApi();

    const result = JSON.parse(await executeIntegratedBrowserTool('read_browser_dom', { refresh: true }));

    expect(api.getObservation).toHaveBeenCalledWith(true);
    expect(result).toMatchObject({
      success: true,
      source: 'integrated-browser-dom',
      tabId: 'tab-1',
      dom: { title: 'Repositorio', text: 'README público' },
      untrustedContent: true,
    });
    expect(JSON.stringify(result)).not.toContain('c2VjcmV0by12aXN1YWw');
  });

  it('IBT-002: navegación directa conserva la sesión y relee el DOM sin desktopAgent', async () => {
    const api = installBrowserApi();
    const desktopSpy = vi.fn();
    Object.defineProperty(window, 'desktopAgent', { configurable: true, value: { executeTask: desktopSpy } });

    const result = JSON.parse(await executeIntegratedBrowserTool('navigate_integrated_browser', {
      target: 'https://github.com/example/repo',
    }));

    expect(api.navigate).toHaveBeenCalledWith('https://github.com/example/repo');
    expect(api.getObservation).toHaveBeenCalledWith(true);
    expect(desktopSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    Reflect.deleteProperty(window, 'desktopAgent');
  });

  it('IBT-003: una pestaña no visible falla sin inventar DOM', async () => {
    const api = installBrowserApi();
    api.getState.mockResolvedValueOnce({ success: true, state: { isVisible: false } });

    const result = JSON.parse(await executeIntegratedBrowserTool('read_browser_dom', {}));

    expect(result.success).toBe(false);
    expect(api.getObservation).not.toHaveBeenCalled();
  });

  it('IBT-004: el catálogo expone lectura/navegación aunque Computer Use esté deshabilitado', () => {
    installBrowserApi();

    const tools = buildModelTools(false, 'gemini-3.6-flash');
    const declarations = tools.flatMap((group) => group.functionDeclarations || []);

    expect(declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'read_browser_dom' }),
      expect.objectContaining({ name: 'navigate_integrated_browser' }),
    ]));
    expect(declarations.some((tool) => tool.name === 'use_computer')).toBe(false);
  });

  it('IBT-005: una observación pausada no se reactiva ni escala a Computer Use', async () => {
    const api = installBrowserApi();
    api.getObservation.mockResolvedValueOnce({
      success: true,
      state: { isVisible: true },
      observation: null,
      observationStatus: { enabled: false },
    });
    const desktopSpy = vi.fn();
    Object.defineProperty(window, 'desktopAgent', { configurable: true, value: { executeTask: desktopSpy } });

    const result = JSON.parse(await executeIntegratedBrowserTool('read_browser_dom', { refresh: true }));

    expect(result.success).toBe(false);
    expect(desktopSpy).not.toHaveBeenCalled();
    Reflect.deleteProperty(window, 'desktopAgent');
  });

  it('IBT-006: una navegación oculta falla cerrada sin cambiar la página', async () => {
    const api = installBrowserApi();
    api.getState.mockResolvedValueOnce({ success: true, state: { isVisible: false } });

    const result = JSON.parse(await executeIntegratedBrowserTool('navigate_integrated_browser', {
      target: 'https://example.com',
    }));

    expect(result.success).toBe(false);
    expect(api.navigate).not.toHaveBeenCalled();
    expect(api.getObservation).not.toHaveBeenCalled();
  });
});
