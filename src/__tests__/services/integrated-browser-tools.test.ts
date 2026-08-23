import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeIntegratedBrowserTool } from '../../services/gemini-chat/integrated-browser-tools';
import { buildModelTools } from '../../services/gemini-chat/model-config';
import { setConfirmationHandler } from '../../services/computer-use/confirmation';

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
    readActiveDocument: vi.fn(async () => ({ success: true, document: { tabId: 'tab-1', url: 'https://docs.google.com/document/d/1/edit', title: 'SofLIA Speakers', language: 'es', text: 'Contenido documental verificado', truncated: false } })),
    navigate: vi.fn(async () => ({ success: true, state: { isVisible: true } })),
    clickElement: vi.fn(async () => ({
      success: true,
      state: { isVisible: true },
      target: { ref: 'dom-1', tag: 'a', role: 'link', name: 'Código', type: '', href: 'https://github.com/example/repo', disabled: false, editable: false, x: 10, y: 20, occluded: false },
      warning: null,
    })),
    typeInElement: vi.fn(async () => ({
      success: true,
      state: { isVisible: true },
      target: { ref: 'dom-2', tag: 'input', role: '', name: 'Buscar', type: 'text', href: '', disabled: false, editable: true, x: 10, y: 20, occluded: false },
      warning: null,
    })),
    scrollView: vi.fn(async () => ({ success: true, state: { isVisible: true } })),
    goBack: vi.fn(async () => ({ success: true, state: { isVisible: true } })),
  };
  Object.defineProperty(window, 'integratedBrowser', { configurable: true, value: api });
  return api;
}

describe('herramientas deterministas del navegador integrado', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'integratedBrowser');
    setConfirmationHandler(null);
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

  it('IBT-012: read_active_document devuelve el documento activo con identidad y paginación', async () => {
    const api = installBrowserApi();

    const result = JSON.parse(await executeIntegratedBrowserTool('read_active_document', { offset: 0 }));

    expect(api.readActiveDocument).toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      source: 'integrated-browser-document',
      document: {
        tabId: 'tab-1',
        title: 'SofLIA Speakers',
        text: 'Contenido documental verificado',
        offset: 0,
        nextOffset: null,
        hasMore: false,
      },
      untrustedContent: true,
    });
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
      expect.objectContaining({ name: 'read_active_document' }),
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

  it('IBT-007: el clic determinista actúa por referencia y devuelve el DOM posterior', async () => {
    const api = installBrowserApi();
    const desktopSpy = vi.fn();
    Object.defineProperty(window, 'desktopAgent', { configurable: true, value: { executeTask: desktopSpy } });

    const result = JSON.parse(await executeIntegratedBrowserTool('click_browser_element', {
      ref: 'dom-1',
      reason: 'Abrir el correo de la bandeja',
    }));

    expect(api.clickElement).toHaveBeenCalledWith('dom-1');
    expect(api.getObservation).toHaveBeenLastCalledWith(true);
    expect(desktopSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      source: 'integrated-browser-controller',
      acted: { ref: 'dom-1', name: 'Código' },
      dom: { title: 'Repositorio' },
      untrustedContent: true,
    });
    Reflect.deleteProperty(window, 'desktopAgent');
  });

  it('IBT-008: un control irreversible exige confirmación y se cancela sin actuar', async () => {
    const api = installBrowserApi();
    api.getObservation.mockResolvedValueOnce({
      success: true,
      state: { isVisible: true },
      observation: {
        ...observation().observation,
        dom: {
          ...observation().observation.dom,
          controls: [{ ref: 'dom-9', tag: 'button', role: 'button', name: 'Eliminar definitivamente', text: 'Eliminar', type: '', href: '', disabled: false, checked: null, rect: { x: 1, y: 1, width: 10, height: 10 }, scope: 'document' }],
        },
      },
    });
    const confirm = vi.fn(async () => false);
    setConfirmationHandler(confirm);

    const result = JSON.parse(await executeIntegratedBrowserTool('click_browser_element', { ref: 'dom-9' }));

    expect(confirm).toHaveBeenCalledWith('click_browser_element', expect.stringContaining('Eliminar definitivamente'));
    expect(api.clickElement).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false, error: 'Acción cancelada por el usuario.' });
    setConfirmationHandler(null);
  });

  it('IBT-009: escritura, desplazamiento y retroceso quedan fuera de Computer Use', async () => {
    const api = installBrowserApi();

    const typed = JSON.parse(await executeIntegratedBrowserTool('type_in_browser_element', {
      ref: 'dom-2',
      text: 'facturas',
      submit: false,
    }));
    const scrolled = JSON.parse(await executeIntegratedBrowserTool('scroll_integrated_browser', { direction: 'down', amount: 5 }));
    const back = JSON.parse(await executeIntegratedBrowserTool('go_back_integrated_browser', {}));

    expect(api.typeInElement).toHaveBeenCalledWith('dom-2', 'facturas', false);
    expect(api.scrollView).toHaveBeenCalledWith('down', 5);
    expect(api.goBack).toHaveBeenCalled();
    expect(typed.success).toBe(true);
    expect(scrolled.success).toBe(true);
    expect(back.success).toBe(true);
  });

  it('IBT-011: enviar con Enter exige confirmacion y no escribe si se cancela', async () => {
    const api = installBrowserApi();
    const confirm = vi.fn(async () => false);
    setConfirmationHandler(confirm);

    const result = JSON.parse(await executeIntegratedBrowserTool('type_in_browser_element', {
      ref: 'dom-2',
      text: 'Resumen ejecutivo',
      submit: true,
    }));

    expect(confirm).toHaveBeenCalledWith('type_in_browser_element', expect.stringContaining('Resumen ejecutivo'));
    expect(api.typeInElement).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false, error: 'Acción cancelada por el usuario.' });
  });

  it('IBT-010: sin pestaña visible el controlador no actúa', async () => {
    const api = installBrowserApi();
    api.getState.mockResolvedValue({ success: true, state: { isVisible: false } });

    const result = JSON.parse(await executeIntegratedBrowserTool('click_browser_element', { ref: 'dom-1' }));

    expect(result.success).toBe(false);
    expect(api.clickElement).not.toHaveBeenCalled();
  });
});
