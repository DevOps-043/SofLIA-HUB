import type { WebContents } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCdpSessionState } from '../integrated-browser/cdp-session';
import { describeResolutionFailure, resolveBrowserElement } from '../integrated-browser/page-interaction';

function newContents(sendCommand: (method: string, params?: Record<string, unknown>) => Promise<unknown>) {
  const executeJavaScript = vi.fn<WebContents['executeJavaScript']>(async () => null);
  const executeJavaScriptInIsolatedWorld = vi.fn<WebContents['executeJavaScriptInIsolatedWorld']>(async () => null);
  const contents = {
    isDestroyed: () => false,
    executeJavaScript,
    executeJavaScriptInIsolatedWorld,
    debugger: {
      isAttached: () => false,
      attach: vi.fn(),
      detach: vi.fn(),
      once: vi.fn(),
      sendCommand: vi.fn(sendCommand),
    },
  };
  return { contents: contents as unknown as WebContents, executeJavaScript, executeJavaScriptInIsolatedWorld };
}

const MEDIDA_OK = {
  ok: true,
  tag: 'button',
  role: '',
  name: 'Pagar',
  type: '',
  href: '',
  disabled: false,
  editable: false,
  x: 120,
  y: 420,
  occluded: false,
};

describe('resolucion de elementos del navegador', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resuelve una referencia dom- en el mundo aislado del agente', async () => {
    const harness = newContents(async () => ({}));
    resetCdpSessionState(harness.contents);
    harness.executeJavaScriptInIsolatedWorld.mockResolvedValue({ ...MEDIDA_OK, x: 10, y: 20 });

    const resolucion = await resolveBrowserElement(harness.contents, 'dom-42');

    expect(resolucion.ok).toBe(true);
    expect(harness.executeJavaScript).not.toHaveBeenCalled();
    const codigo = String(harness.executeJavaScriptInIsolatedWorld.mock.calls[0]?.[1]?.[0]?.code ?? '');
    expect(codigo).toContain('__sofliaBrowserRefs');
    expect(codigo).toContain('"dom-42"');
  });

  it('resuelve una referencia cdp- por backendNodeId y libera el manejador', async () => {
    const sendCommand = vi.fn(async (method: string) => {
      if (method === 'DOM.resolveNode') return { object: { objectId: 'objeto-1' } };
      if (method === 'Runtime.callFunctionOn') return { result: { value: MEDIDA_OK } };
      return {};
    });
    const harness = newContents(sendCommand);
    resetCdpSessionState(harness.contents);

    const resolucion = await resolveBrowserElement(harness.contents, 'cdp-203');

    const { ok: _descartado, ...medido } = MEDIDA_OK;
    expect(resolucion).toEqual({ ok: true, target: { ...medido, ref: 'cdp-203' } });
    expect(sendCommand).toHaveBeenCalledWith('DOM.resolveNode', { backendNodeId: 203 });
    // Un manejador retenido impide que Chromium recolecte el nodo.
    expect(sendCommand.mock.calls.some((call) => call[0] === 'Runtime.releaseObject')).toBe(true);
    expect(harness.executeJavaScriptInIsolatedWorld).not.toHaveBeenCalled();
  });

  it('trata como vencida la referencia cdp- cuyo nodo ya no existe', async () => {
    const harness = newContents(async (method: string) => {
      if (method === 'DOM.resolveNode') throw new Error('No node with given id found');
      return {};
    });
    resetCdpSessionState(harness.contents);

    const resolucion = await resolveBrowserElement(harness.contents, 'cdp-203');

    expect(resolucion).toEqual({ ok: false, reason: 'referencia-vencida' });
    expect(describeResolutionFailure('referencia-vencida')).toContain('vuelve a leer el DOM');
  });

  it('rechaza una referencia cdp- malformada sin abrir la sesion', async () => {
    const harness = newContents(async () => ({}));
    resetCdpSessionState(harness.contents);

    await expect(resolveBrowserElement(harness.contents, 'cdp-abc')).resolves.toEqual({
      ok: false,
      reason: 'referencia-vencida',
    });
    expect(harness.contents.debugger.sendCommand).not.toHaveBeenCalled();
  });

  it('propaga el fallo del marco aislado con un mensaje accionable', async () => {
    const harness = newContents(async (method: string) => {
      if (method === 'DOM.resolveNode') return { object: { objectId: 'objeto-1' } };
      if (method === 'Runtime.callFunctionOn') return { result: { value: { ok: false, reason: 'marco-aislado' } } };
      return {};
    });
    resetCdpSessionState(harness.contents);

    const resolucion = await resolveBrowserElement(harness.contents, 'cdp-203');

    // Sin poder leer el desplazamiento del marco padre, el punto de impacto
    // seria otro elemento: es preferible fallar que hacer clic a ciegas.
    expect(resolucion).toEqual({ ok: false, reason: 'marco-aislado' });
    expect(describeResolutionFailure('marco-aislado')).toContain('otro origen');
  });

  it('degrada sin romper cuando la sesion de inspeccion no esta disponible', async () => {
    const harness = newContents(async () => ({}));
    (harness.contents.debugger.attach as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Another debugger is already attached');
    });
    resetCdpSessionState(harness.contents);

    await expect(resolveBrowserElement(harness.contents, 'cdp-203')).resolves.toEqual({
      ok: false,
      reason: 'sin-registro',
    });
  });
});
