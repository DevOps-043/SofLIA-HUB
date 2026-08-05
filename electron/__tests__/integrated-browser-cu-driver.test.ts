import { describe, expect, it, vi } from 'vitest';
import { createIntegratedBrowserCuDriver } from '../integrated-browser';
import type { IntegratedBrowserService } from '../integrated-browser';

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
      getWebContentsForAgent: () => contents,
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
    expect(service.navigate).toHaveBeenCalledWith('example.com');
  });

  it('refuerza cada captura con el DOM saneado de la misma pestaña', async () => {
    const service = {
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
});
