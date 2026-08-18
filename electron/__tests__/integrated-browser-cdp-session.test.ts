import type { WebContents } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CdpUnavailableError,
  acquireCdpLease,
  resetCdpSessionState,
  withCdpSession,
} from '../integrated-browser/cdp-session';

/**
 * Doble del depurador de Electron. Reproduce lo que importa del contrato real:
 * `isAttached` habla solo de nuestra conexion y `attach` falla cuando otro
 * cliente (DevTools) ya tiene tomada la sesion.
 */
function newContents(options: { attachFails?: boolean } = {}) {
  const listeners = new Map<string, Array<(event: unknown, reason?: string) => void>>();
  const messageHandlers: Array<(event: unknown, method: string, params: unknown) => void> = [];
  const state = { attached: false, destroyed: false };
  const attach = vi.fn(() => {
    if (options.attachFails) throw new Error('Another debugger is already attached');
    state.attached = true;
  });
  const detach = vi.fn(() => { state.attached = false; });
  const sendCommand = vi.fn(async () => ({ ok: true }));
  const contents = {
    isDestroyed: () => state.destroyed,
    debugger: {
      isAttached: () => state.attached,
      attach,
      detach,
      sendCommand,
      once: (event: string, handler: (event: unknown, reason?: string) => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      },
      on: (event: string, handler: (event: unknown, method: string, params: unknown) => void) => {
        if (event === 'message') messageHandlers.push(handler);
      },
    },
  };
  return {
    contents: contents as unknown as WebContents,
    attach,
    detach,
    sendCommand,
    state,
    emitDetach: (reason?: string) => {
      state.attached = false;
      (listeners.get('detach') ?? []).splice(0).forEach((handler) => handler({}, reason));
    },
    emitMessage: (method: string, params: unknown) => messageHandlers.forEach((h) => h({}, method, params)),
    messageHandlerCount: () => messageHandlers.length,
  };
}

function methodsOf(sendCommand: ReturnType<typeof vi.fn>): string[] {
  return sendCommand.mock.calls.map((call) => String(call[0]));
}

describe('sesion CDP compartida', () => {
  let harness: ReturnType<typeof newContents>;

  beforeEach(() => {
    harness = newContents();
    resetCdpSessionState(harness.contents);
  });

  it('abre la sesion, habilita el dominio y lo suelta todo al terminar', async () => {
    const resultado = await withCdpSession(harness.contents, ['Accessibility'], async (send) => {
      const respuesta = await send('Accessibility.getFullAXTree');
      return respuesta.ok;
    });

    expect(resultado).toBe(true);
    expect(harness.attach).toHaveBeenCalledTimes(1);
    expect(methodsOf(harness.sendCommand)).toEqual([
      'Accessibility.enable',
      'Accessibility.getFullAXTree',
      'Accessibility.disable',
    ]);
    expect(harness.detach).toHaveBeenCalledTimes(1);
  });

  it('libera la sesion aunque el trabajo falle', async () => {
    await expect(
      withCdpSession(harness.contents, ['DOMSnapshot'], async () => {
        throw new Error('captura rota');
      }),
    ).rejects.toThrow('captura rota');

    expect(methodsOf(harness.sendCommand)).toEqual(['DOMSnapshot.enable', 'DOMSnapshot.disable']);
    expect(harness.detach).toHaveBeenCalledTimes(1);
  });

  it('no cierra la sesion que otro consumidor sigue usando', async () => {
    // Este es el fallo que motivo el modulo: dos capturas solapadas hacian su
    // propio attach/detach y la primera en terminar dejaba a la otra sin sesion.
    let soltarPrimera: (() => void) | undefined;
    const primera = withCdpSession(harness.contents, ['Accessibility'], async (send) => {
      await new Promise<void>((resolve) => { soltarPrimera = resolve; });
      await send('Accessibility.getFullAXTree');
    });
    await Promise.resolve();

    const segunda = withCdpSession(harness.contents, ['Accessibility'], async (send) => {
      await send('Accessibility.getFullAXTree');
    });
    await segunda;

    // La segunda ya termino y la sesion sigue viva porque la primera la retiene.
    expect(harness.detach).not.toHaveBeenCalled();
    expect(harness.state.attached).toBe(true);
    expect(methodsOf(harness.sendCommand).filter((m) => m === 'Accessibility.enable')).toHaveLength(1);

    soltarPrimera?.();
    await primera;

    expect(harness.detach).toHaveBeenCalledTimes(1);
    expect(methodsOf(harness.sendCommand).filter((m) => m === 'Accessibility.disable')).toHaveLength(1);
  });

  it('falla con CdpUnavailableError cuando DevTools ya tiene la sesion', async () => {
    const ocupado = newContents({ attachFails: true });
    resetCdpSessionState(ocupado.contents);

    await expect(
      withCdpSession(ocupado.contents, ['DOMSnapshot'], async () => 'nunca'),
    ).rejects.toBeInstanceOf(CdpUnavailableError);
    expect(ocupado.sendCommand).not.toHaveBeenCalled();
  });

  it('rechaza sin dejar la sesion abierta si un dominio no engancha', async () => {
    harness.sendCommand.mockImplementation(async (method: string) => {
      if (method === 'DOMSnapshot.enable') throw new Error('dominio no soportado');
      return { ok: true };
    });

    await expect(
      withCdpSession(harness.contents, ['DOMSnapshot'], async () => 'nunca'),
    ).rejects.toBeInstanceOf(CdpUnavailableError);
    expect(harness.detach).toHaveBeenCalledTimes(1);
  });

  it('olvida el estado cuando Chromium cierra la sesion por su cuenta', async () => {
    await withCdpSession(harness.contents, ['Accessibility'], async () => 'listo');
    harness.state.attached = true;
    harness.emitDetach();

    await withCdpSession(harness.contents, ['Accessibility'], async () => 'listo');
    // Tras el aviso de Chromium el modulo vuelve a habilitar el dominio en vez
    // de darlo por activo con una sesion que ya no existe.
    expect(methodsOf(harness.sendCommand).filter((m) => m === 'Accessibility.enable')).toHaveLength(2);
  });

  it('no envia comandos sobre una pestana destruida', async () => {
    await expect(
      withCdpSession(harness.contents, ['Accessibility'], async (send) => {
        harness.state.destroyed = true;
        return send('Accessibility.getFullAXTree');
      }),
    ).rejects.toBeInstanceOf(CdpUnavailableError);
  });

  describe('arrendamiento persistente', () => {
    it('mantiene la sesion abierta hasta que se suelta', async () => {
      const lease = await acquireCdpLease(harness.contents, ['Page', 'Runtime']);

      expect(lease.alive).toBe(true);
      expect(harness.detach).not.toHaveBeenCalled();
      // `addScriptToEvaluateOnNewDocument` y `addBinding` solo viven mientras la
      // sesion sigue adjunta: por eso el arrendamiento existe.
      expect(harness.state.attached).toBe(true);

      await lease.release();
      expect(lease.alive).toBe(false);
      expect(harness.detach).toHaveBeenCalledTimes(1);
    });

    it('reparte los eventos del protocolo al metodo suscrito', async () => {
      const lease = await acquireCdpLease(harness.contents, ['Runtime']);
      const recibidos: unknown[] = [];
      lease.on('Runtime.bindingCalled', (params) => recibidos.push(params));

      harness.emitMessage('Runtime.bindingCalled', { name: 'puente' });
      harness.emitMessage('Runtime.consoleAPICalled', { type: 'log' });

      expect(recibidos).toEqual([{ name: 'puente' }]);
      await lease.release();
    });

    it('deja de repartir eventos a un arrendamiento ya soltado', async () => {
      const lease = await acquireCdpLease(harness.contents, ['Runtime']);
      const recibidos: unknown[] = [];
      lease.on('Runtime.bindingCalled', (params) => recibidos.push(params));
      await lease.release();

      harness.emitMessage('Runtime.bindingCalled', { name: 'puente' });

      expect(recibidos).toEqual([]);
    });

    it('avisa al arrendatario cuando DevTools se lleva la sesion', async () => {
      const onLost = vi.fn();
      const lease = await acquireCdpLease(harness.contents, ['Page'], { onLost });

      harness.emitDetach('canceled by user');

      expect(onLost).toHaveBeenCalledWith('canceled by user');
      expect(lease.alive).toBe(false);
      await expect(lease.send('Page.enable')).rejects.toBeInstanceOf(CdpUnavailableError);
    });

    it('soltar un arrendamiento ya perdido no desbalancea a los demas', async () => {
      const lease = await acquireCdpLease(harness.contents, ['Page']);
      harness.emitDetach('target closed');
      harness.detach.mockClear();

      await lease.release();

      // El aviso de cierre ya puso el contador a cero; restar otra vez habria
      // cerrado la sesion de una captura puntual posterior.
      const otra = await acquireCdpLease(harness.contents, ['Page']);
      expect(otra.alive).toBe(true);
      await otra.release();
    });

    it('comparte la conexion con una captura puntual simultanea', async () => {
      const lease = await acquireCdpLease(harness.contents, ['Page']);
      harness.attach.mockClear();

      await withCdpSession(harness.contents, ['Accessibility'], async (send) => send('Accessibility.getFullAXTree'));

      // La captura reutiliza la sesion del arrendamiento en vez de abrir otra,
      // y al terminar no se la cierra por debajo.
      expect(harness.attach).not.toHaveBeenCalled();
      expect(harness.detach).not.toHaveBeenCalled();
      expect(lease.alive).toBe(true);
      await lease.release();
      expect(harness.detach).toHaveBeenCalledTimes(1);
    });

    it('engancha el despacho de mensajes una sola vez por pestana', async () => {
      const primera = await acquireCdpLease(harness.contents, ['Page']);
      const segunda = await acquireCdpLease(harness.contents, ['Runtime']);

      expect(harness.messageHandlerCount()).toBe(1);

      await primera.release();
      await segunda.release();
    });
  });
});
