import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserSessionCheckpoint } from '../integrated-browser/session-checkpoint';
import type { BrowserSessionSnapshot } from '../integrated-browser/platform-types';

function snapshot(title = 'Ejemplo'): BrowserSessionSnapshot {
  return {
    version: 2, savedAt: new Date().toISOString(), cleanExit: true,
    activeTabId: 'tab-1', primaryTabId: 'tab-1', secondaryTabId: null,
    detachedTabIds: [], viewMode: 'single', tabLayout: 'horizontal', groups: [],
    tabs: [{ id: 'tab-1', url: 'https://example.test/', title, pinned: false, muted: false, groupId: null, position: 0 }],
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fixture() {
  const save = vi.fn<(snapshot: BrowserSessionSnapshot) => Promise<void>>().mockResolvedValue();
  const onError = vi.fn<(error: unknown) => void>();
  const checkpoint = new BrowserSessionCheckpoint({ save }, onError);
  const context = {
    scopeId: 'cuenta-a',
    assertCurrent: vi.fn<() => void>(),
    buildSnapshot: vi.fn<() => BrowserSessionSnapshot | null>().mockReturnValue(snapshot()),
    canRetryLastSnapshot: vi.fn<() => boolean>().mockReturnValue(false),
    afterSave: vi.fn<() => Promise<void>>().mockResolvedValue(),
  };
  return { checkpoint, save, onError, context };
}

afterEach(() => { vi.useRealTimers(); });

describe('Checkpoint de sesión del navegador', () => {
  it('agrupa cambios durante 250 ms y captura el contenido más reciente al escribir', async () => {
    vi.useFakeTimers();
    const { checkpoint, save } = fixture();
    let current = snapshot('Primero');
    const build = vi.fn(() => current);
    checkpoint.queue('cuenta-a', build);
    await vi.advanceTimersByTimeAsync(200);
    current = snapshot('Último');
    checkpoint.queue('cuenta-a', build);
    await vi.advanceTimersByTimeAsync(249);
    expect(save).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith(current);
  });

  it('reporta el fallo del autosave sin perder el rechazo para la barrera', async () => {
    vi.useFakeTimers();
    const { checkpoint, save, onError, context } = fixture();
    const error = new Error('disco ocupado');
    save.mockRejectedValueOnce(error);
    checkpoint.queue(context.scopeId, () => snapshot());
    await vi.advanceTimersByTimeAsync(250);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    context.buildSnapshot.mockReturnValue(null);
    await expect(checkpoint.flush(context)).rejects.toBe(error);
    expect(context.afterSave).not.toHaveBeenCalled();
  });

  it('cancelar el temporizador retira el snapshot pendiente', async () => {
    vi.useFakeTimers();
    const { checkpoint, save } = fixture();
    checkpoint.queue('cuenta-a', () => snapshot());
    checkpoint.cancelScheduledSave();
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
  });

  it('confirmar cierre cancela autosave e impide construir nuevas sesiones', async () => {
    vi.useFakeTimers();
    const { checkpoint, save } = fixture();
    const build = vi.fn(() => snapshot());
    checkpoint.queue('cuenta-a', build);
    checkpoint.commit();
    checkpoint.queue('cuenta-a', build);
    await checkpoint.persist('cuenta-a', build);
    await vi.runAllTimersAsync();
    expect(checkpoint.isCommitted).toBe(true);
    expect(build).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    checkpoint.resume();
    await checkpoint.persist('cuenta-a', build);
    expect(save).toHaveBeenCalledOnce();
  });

  it('el cierre cancela el autosave y espera la escritura y la limpieza', async () => {
    vi.useFakeTimers();
    const { checkpoint, save, context } = fixture();
    const writing = deferred();
    const cleaning = deferred();
    const cleanupStarted = deferred();
    save.mockReturnValueOnce(writing.promise);
    context.afterSave.mockImplementationOnce(() => { cleanupStarted.resolve(); return cleaning.promise; });
    checkpoint.queue(context.scopeId, () => snapshot());
    let completed = false;
    const closing = checkpoint.flush(context).then(() => { completed = true; });
    expect(checkpoint.isFlushing).toBe(true);
    checkpoint.queue(context.scopeId, () => snapshot('No programar'));
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledOnce();
    expect(context.afterSave).not.toHaveBeenCalled();
    writing.resolve();
    await cleanupStarted.promise;
    expect(context.afterSave).toHaveBeenCalledOnce();
    expect(completed).toBe(false);
    cleaning.resolve();
    await closing;
    expect(completed).toBe(true);
  });

  it('incorpora cambios durante E/S e ignora solo savedAt al estabilizar', async () => {
    const { checkpoint, save, context } = fixture();
    const writing = deferred();
    save.mockReturnValueOnce(writing.promise);
    let current = snapshot('Primero');
    let time = 0;
    context.buildSnapshot.mockImplementation(() => ({ ...current, savedAt: new Date(++time).toISOString() }));
    const closing = checkpoint.flush(context);
    expect(save).toHaveBeenCalledOnce();
    current = snapshot('Cambio durante escritura');
    writing.resolve();
    await closing;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].tabs[0].title).toBe('Cambio durante escritura');
  });

  it('espera un guardado previo aunque ya no haya pestañas para construir', async () => {
    const { checkpoint, save, context } = fixture();
    const writing = deferred();
    save.mockReturnValueOnce(writing.promise);
    const saved = checkpoint.persist(context.scopeId, () => snapshot());
    context.buildSnapshot.mockReturnValue(null);
    const closing = checkpoint.flush(context);
    await Promise.resolve();
    expect(context.afterSave).not.toHaveBeenCalled();
    writing.resolve();
    await Promise.all([saved, closing]);
    expect(save).toHaveBeenCalledOnce();
    expect(context.afterSave).toHaveBeenCalledOnce();
  });

  it.each(['cuenta-a', 'cuenta-b'])('reintenta la última sesión fallida únicamente para su perfil: %s', async (scopeId) => {
    const { checkpoint, save, context } = fixture();
    const previous = snapshot('Última sesión antes de cerrar');
    const error = new Error('disco ocupado');
    save.mockRejectedValueOnce(error);
    await expect(checkpoint.persist('cuenta-a', () => previous)).rejects.toBe(error);
    context.scopeId = scopeId;
    context.canRetryLastSnapshot.mockReturnValue(true);
    context.buildSnapshot.mockReturnValue(null);
    if (scopeId === 'cuenta-a') {
      await checkpoint.flush(context);
      expect(save).toHaveBeenCalledTimes(2);
      expect(save.mock.calls[1][0]).toBe(previous);
    } else {
      await expect(checkpoint.flush(context)).rejects.toBe(error);
      expect(save).toHaveBeenCalledOnce();
    }
  });

  it('un rechazo antiguo no marca como fallida la escritura más reciente', async () => {
    const { checkpoint, save, context } = fixture();
    const earlier = deferred();
    save.mockReturnValueOnce(earlier.promise);
    const failure = expect(checkpoint.persist(context.scopeId, () => snapshot('Antigua'))).rejects.toThrow('antiguo');
    await checkpoint.persist(context.scopeId, () => snapshot('Actual'));
    earlier.reject(new Error('antiguo'));
    await failure;
    context.buildSnapshot.mockReturnValue(null);
    context.canRetryLastSnapshot.mockReturnValue(true);
    await checkpoint.flush(context);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it.each(['preparación', 'escritura'])('reanudar invalida el cierre pendiente durante %s', async (stage) => {
    const { checkpoint, save, context } = fixture();
    const held = deferred();
    const closing = checkpoint.flush({ ...context,
      ...(stage === 'preparación' ? { prepare: () => held.promise } : {}),
      ...(stage === 'escritura' ? { buildSnapshot: () => { save.mockReturnValueOnce(held.promise); return snapshot(); } } : {}),
    });
    const rejected = expect(closing).rejects.toThrow('La sesión cambió');
    checkpoint.resume();
    expect(checkpoint.isFlushing).toBe(false);
    held.resolve();
    await rejected;
    expect(save).toHaveBeenCalledTimes(stage === 'preparación' ? 0 : 1);
    expect(context.afterSave).not.toHaveBeenCalled();
  });

  it('una guarda de perfil vencida bloquea el guardado tras cargar', async () => {
    const { checkpoint, save, context } = fixture();
    context.assertCurrent.mockImplementation(() => { throw new Error('Perfil cambiado'); });
    await expect(checkpoint.flush({ ...context, prepare: async () => undefined })).rejects.toThrow('Perfil cambiado');
    expect(save).not.toHaveBeenCalled();
  });

  it('cancelar durante la última espera de limpieza invalida también el checkpoint', async () => {
    const { checkpoint, context } = fixture();
    const cleaning = deferred();
    const started = deferred();
    context.afterSave.mockImplementationOnce(() => { started.resolve(); return cleaning.promise; });
    const closing = checkpoint.flush(context);
    const rejected = expect(closing).rejects.toThrow('La sesión cambió');
    await started.promise;
    checkpoint.resume();
    cleaning.resolve();
    await rejected;
  });

  it('el reinicio de perfil descarta el fallo y autosave anteriores sin reabrir el cierre', async () => {
    vi.useFakeTimers();
    const { checkpoint, save, context } = fixture();
    save.mockRejectedValueOnce(new Error('fallo anterior'));
    await expect(checkpoint.persist(context.scopeId, () => snapshot())).rejects.toThrow('fallo anterior');
    checkpoint.queue(context.scopeId, () => snapshot());
    checkpoint.commit();
    checkpoint.resetProfile();
    expect(checkpoint.isCommitted).toBe(true);
    checkpoint.attachWindow();
    expect(checkpoint.isCommitted).toBe(false);
    context.scopeId = 'cuenta-b';
    context.buildSnapshot.mockReturnValue(null);
    context.canRetryLastSnapshot.mockReturnValue(true);
    await checkpoint.flush(context);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledOnce();
    expect(context.afterSave).toHaveBeenCalledOnce();
  });

  it('reiniciar el perfil cancela el autosave aunque el navegador siga abierto', async () => {
    vi.useFakeTimers();
    const { checkpoint, save } = fixture();
    checkpoint.queue('cuenta-a', () => snapshot('Cuenta anterior'));
    checkpoint.resetProfile();
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
    checkpoint.queue('cuenta-b', () => snapshot('Cuenta nueva'));
    await vi.advanceTimersByTimeAsync(250);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0].tabs[0].title).toBe('Cuenta nueva');
  });
});
