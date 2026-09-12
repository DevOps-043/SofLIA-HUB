import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIntegratedBrowserCuDriver } from '../integrated-browser';
import type { IntegratedBrowserService } from '../integrated-browser';
import { assertCuNotAborted, CuContextChangedError } from '../desktop-agent/gemini-cu/execution-guard';
import { applySoMOverlay } from '../desktop-agent/screenshot-overlays';

vi.mock('../desktop-agent/sharp', () => ({ loadSharp: () => vi.fn() }));
vi.mock('../desktop-agent/screenshot-overlays', () => ({ applySoMOverlay: vi.fn(async () => 'marcada') }));
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

function fixture() {
  let tabRevision = 0;
  let documentRevision = 0;
  const createAgentTargetGuard = (signal?: AbortSignal, document = false) => {
    const tab = tabRevision; const page = documentRevision;
    return () => {
      assertCuNotAborted(signal);
      if (tab !== tabRevision || (document && page !== documentRevision)) throw new CuContextChangedError();
    };
  };
  const contents = {
    capturePage: vi.fn(async () => ({ toPNG: () => Buffer.from('imagen'), getSize: () => ({ width: 800, height: 600 }) })),
    insertText: vi.fn(async () => {}), sendInputEvent: vi.fn(),
  };
  const service = {
    assertAgentDocumentSafe: vi.fn(async () => {}),
    auditAgentOperation: async <T,>(_operation: string, action: () => Promise<T>) => action(),
    createAgentTargetGuard,
    authorizeAgentTarget: vi.fn(async (_capability: string, signal?: AbortSignal) => ({ contents, assertCurrent: createAgentTargetGuard(signal, true) })),
    getObservation: vi.fn(async () => ({ observation: null })),
    getViewportSize: () => ({ width: 800, height: 600 }),
    getState: () => ({ url: 'https://example.com' }),
    navigate: vi.fn(async (_url: unknown, assertCurrent?: () => void) => { assertCurrent?.(); documentRevision++; }),
    goBack: vi.fn(), goForward: vi.fn(),
  };
  return {
    service, contents, driver: createIntegratedBrowserCuDriver(service as unknown as IntegratedBrowserService),
    changeTab: () => { tabRevision++; }, changeDocument: () => { documentRevision++; },
  };
}

describe('driver Computer Use del navegador integrado', () => {
  it('captura la vista e inyecta click, texto, scroll y navegacion', async () => {
    const contents = {
      capturePage: vi.fn(async () => ({
        toPNG: () => Buffer.from('imagen'),
        getSize: () => ({ width: 1600, height: 1200 }),
      })),
      sendInputEvent: vi.fn(),
      insertText: vi.fn(async () => {}),
    };
    const service = {
      assertAgentDocumentSafe: vi.fn(async () => {}),
      auditAgentOperation: async <T,>(_operation: string, action: () => Promise<T>) => action(),
      createAgentTargetGuard: () => vi.fn(),
      authorizeAgentTarget: vi.fn(async () => ({ contents, assertCurrent: vi.fn() })),
      getViewportSize: () => ({ width: 800, height: 600 }),
      getState: () => ({ url: 'https://example.com' }),
      getObservation: vi.fn(async () => ({ observation: null, observationStatus: { enabled: true } })),
      navigate: vi.fn(async () => ({})),
      goBack: vi.fn(),
      goForward: vi.fn(),
    };
    const driver = createIntegratedBrowserCuDriver(service as unknown as IntegratedBrowserService);

    expect(await driver.capturar()).toMatchObject({ width: 1600, height: 1200, base64: Buffer.from('imagen').toString('base64') });
    await driver.ejecutar({ tipo: 'click', punto: { x: 800, y: 600 } }, 'click seguro');
    await driver.ejecutar({ tipo: 'type', texto: 'hola', enter: true }, 'escribir');
    await driver.ejecutar({ tipo: 'scroll', direccion: 'down', magnitud: 3 }, 'bajar');
    await driver.ejecutar({ tipo: 'navigate', url: 'example.com' }, 'navegar');

    expect(contents.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'mouseDown', x: 400, y: 300 }));
    expect(contents.insertText).toHaveBeenCalledWith('hola');
    expect(contents.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'mouseWheel', deltaY: -300 }));
    expect(service.navigate).toHaveBeenCalledWith('example.com', expect.any(Function));
    expect(service.authorizeAgentTarget).toHaveBeenCalledWith('capture', undefined);
    expect(service.authorizeAgentTarget).toHaveBeenCalledWith('act', undefined);
  });

  it('no captura ni inyecta acciones si la autorización falla', async () => {
    const denied = vi.fn(async () => { throw new Error('Acceso bloqueado'); });
    const driver = createIntegratedBrowserCuDriver({
      assertAgentDocumentSafe: vi.fn(async () => {}),
      auditAgentOperation: async <T,>(_operation: string, action: () => Promise<T>) => action(),
      createAgentTargetGuard: () => vi.fn(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      getObservation: async () => ({ observation: null }),
      authorizeAgentTarget: denied,
    } as unknown as IntegratedBrowserService);
    await expect(driver.capturar()).rejects.toThrow('bloqueado');
    await expect(driver.ejecutar({ tipo: 'click', punto: { x: 50, y: 50 } }, 'clic')).rejects.toThrow('Inicia otra tarea');
  });
  it('descarta la imagen si aparece un formulario sensible durante la captura nativa', async () => {
    const f = fixture();
    f.service.assertAgentDocumentSafe.mockRejectedValueOnce(new Error('Continúa manualmente.'));
    await expect(f.driver.capturar()).rejects.toThrow('manualmente');
    expect(f.contents.capturePage).toHaveBeenCalledOnce();
    await expect(f.driver.ejecutar({ tipo: 'click', punto: { x: 10, y: 10 } }, 'clic')).rejects.toThrow();
    expect(f.contents.sendInputEvent).not.toHaveBeenCalled();
  });

  it('refuerza cada captura con el DOM saneado de la misma pestaña', async () => {
    const service = {
      assertAgentDocumentSafe: vi.fn(async () => {}),
      auditAgentOperation: async <T,>(_operation: string, action: () => Promise<T>) => action(),
      createAgentTargetGuard: () => vi.fn(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      getState: () => ({ url: 'https://example.com' }),
      getObservation: vi.fn(async () => ({
        observation: {
          capturedAt: '2026-08-05T01:00:00.000Z',
          screenshot: 'data:image/png;base64,aW1hZ2Vu',
          dom: { title: 'Ejemplo', url: 'https://example.com/', text: 'Texto público', controls: [] },
        },
      })),
    };
    const driver = createIntegratedBrowserCuDriver(service as unknown as IntegratedBrowserService);
    const capture = await driver.capturar();

    expect(capture).toMatchObject({ width: 800, height: 600, base64: 'aW1hZ2Vu' });
    expect(capture.context).toMatchObject({ trust: 'untrusted_page_content', page: { text: 'Texto público' } });
  });

  it('descarta capturas y no envía Enter si el destino cambia durante una espera nativa', async () => {
    let changed = false;
    const contents = {
      capturePage: vi.fn(async () => { changed = true; return { toPNG: () => Buffer.from('otra página') }; }),
      insertText: vi.fn(async () => { changed = true; }),
      sendInputEvent: vi.fn(),
    };
    const driver = createIntegratedBrowserCuDriver({
      assertAgentDocumentSafe: vi.fn(async () => {}),
      auditAgentOperation: async <T,>(_operation: string, action: () => Promise<T>) => action(),
      createAgentTargetGuard: () => vi.fn(),
      getViewportSize: () => ({ width: 800, height: 600 }),
      getState: () => ({ url: 'https://example.com' }),
      getObservation: async () => ({ observation: null }),
      authorizeAgentTarget: async () => ({ contents, assertCurrent: () => { if (changed) throw new Error('La página cambió'); } }),
    } as unknown as IntegratedBrowserService);
    await expect(driver.capturar()).rejects.toThrow('cambió');
    changed = false;
    contents.capturePage.mockImplementationOnce(async () => ({ toPNG: () => Buffer.from('imagen') }));
    await driver.capturar();
    await expect(driver.ejecutar({ tipo: 'type', texto: 'texto', enter: true }, 'escribir')).rejects.toThrow('cambió');
    expect(contents.sendInputEvent).not.toHaveBeenCalled();
  });

  it.each(['pestaña', 'documento'] as const)('rechaza coordenadas y contexto obsoletos después de cambiar %s', async (change) => {
    const f = fixture(); await f.driver.capturar();
    if (change === 'pestaña') f.changeTab(); else f.changeDocument();
    await expect(f.driver.ejecutar({ tipo: 'click', punto: { x: 50, y: 50 } }, 'clic')).rejects.toBeInstanceOf(CuContextChangedError);
    expect(() => f.driver.contexto?.()).toThrow(CuContextChangedError);
    expect(f.contents.sendInputEvent).not.toHaveBeenCalled();
    if (change === 'pestaña') await expect(f.driver.capturar()).rejects.toBeInstanceOf(CuContextChangedError);
  });

  it('no actúa si cambia la pestaña mientras se autoriza la acción', async () => {
    const f = fixture(); await f.driver.capturar();
    f.service.authorizeAgentTarget.mockImplementationOnce(async () => {
      f.changeTab(); return { contents: f.contents, assertCurrent: () => {} };
    });
    await expect(f.driver.ejecutar({ tipo: 'click', punto: { x: 50, y: 50 } }, 'clic')).rejects.toBeInstanceOf(CuContextChangedError);
    expect(f.contents.sendInputEvent).not.toHaveBeenCalled();
  });

  it('descarta la observación si cambia la pestaña mientras se dibujan las marcas', async () => {
    vi.stubEnv('SOFLIA_BROWSER_SOM', '1');
    const f = fixture();
    f.service.getObservation.mockResolvedValueOnce({ observation: {
      capturedAt: '2026-09-05T00:00:00Z', screenshot: 'data:image/png;base64,aW1hZ2Vu',
      dom: { url: 'https://example.com', controls: [0, 1, 2].map((n) => ({ ref: `dom-${n}`, tag: 'button', name: 'Control', rect: { x: n * 100, y: 20, width: 50, height: 30 } })) },
    } } as never);
    vi.mocked(applySoMOverlay).mockImplementationOnce(async () => { f.changeTab(); return 'marcada'; });
    await expect(f.driver.capturar()).rejects.toBeInstanceOf(CuContextChangedError);
    expect(applySoMOverlay).toHaveBeenCalled();
    expect(() => f.driver.contexto?.()).toThrow(CuContextChangedError);
  });

  it('cancela durante insertText sin emitir Enter posterior', async () => {
    const f = fixture(); const abort = new AbortController(); await f.driver.capturar(abort.signal);
    f.contents.insertText.mockImplementationOnce(async () => { abort.abort('motivo no publicable'); });
    await expect(f.driver.ejecutar({ tipo: 'type', texto: 'texto', enter: true }, 'escribir', abort.signal)).rejects.toThrow('Tarea cancelada.');
    expect(f.contents.sendInputEvent).not.toHaveBeenCalled();
  });

  it('cancela la espera de quince segundos sin esperar a su temporizador', async () => {
    vi.useFakeTimers();
    const f = fixture(); const abort = new AbortController(); await f.driver.capturar(abort.signal);
    const waiting = f.driver.ejecutar({ tipo: 'wait', ms: 15_000 }, 'esperar', abort.signal);
    const rejected = expect(waiting).rejects.toThrow();
    await Promise.resolve(); abort.abort(); await rejected;
    expect(f.contents.sendInputEvent).not.toHaveBeenCalled();
  });

  it('revalida antes de cargar la URL y permite una navegación propia seguida de nueva captura', async () => {
    const f = fixture(); await f.driver.capturar();
    await f.driver.ejecutar({ tipo: 'navigate', url: 'https://example.com/otra' }, 'navegar');
    await expect(f.driver.capturar()).resolves.toHaveProperty('base64');
    f.service.navigate.mockImplementationOnce(async (_url, assertCurrent) => { f.changeTab(); assertCurrent?.(); });
    await expect(f.driver.ejecutar({ tipo: 'navigate', url: 'https://example.com/otra' }, 'navegar')).rejects.toBeInstanceOf(CuContextChangedError);
  });

  it('no captura ni pide autorización con una señal cancelada', async () => {
    const f = fixture(); const abort = new AbortController(); abort.abort();
    await expect(f.driver.capturar(abort.signal)).rejects.toThrow('cancelada');
    expect(f.service.getObservation).not.toHaveBeenCalled();
    expect(f.service.authorizeAgentTarget).not.toHaveBeenCalled();
  });
});
