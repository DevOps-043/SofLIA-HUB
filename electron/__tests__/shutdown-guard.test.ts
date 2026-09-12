import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShutdownGuard, SHUTDOWN_SAVE_TIMEOUT_MS, type ShutdownDecision } from '../main/shutdown-guard';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture() {
  const prepare = vi.fn(async () => {});
  const approve = vi.fn();
  const resume = vi.fn();
  const decide = vi.fn(async (): Promise<ShutdownDecision> => 'cancel');
  return { guard: new ShutdownGuard({ prepare, approve, resume, decide }), prepare, approve, resume, decide };
}

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('ShutdownGuard', () => {
  it('espera el guardado antes de permitir una sola salida', async () => {
    const f = fixture();
    const save = deferred();
    f.prepare.mockReturnValue(save.promise);
    const proceed = vi.fn();
    const pending = f.guard.request('quit', proceed);
    expect(f.guard.request('quit', vi.fn())).toBe(pending);
    await Promise.resolve();
    expect(proceed).not.toHaveBeenCalled();
    expect(f.guard.consumeQuitApproval()).toBe(false);
    save.resolve();
    expect(await pending).toBe(true);
    expect(f.prepare).toHaveBeenCalledTimes(1);
    expect(proceed).toHaveBeenCalledTimes(1);
    expect(f.guard.consumeQuitApproval()).toBe(true);
    expect(f.guard.consumeQuitApproval()).toBe(false);
    expect(f.decide).not.toHaveBeenCalled();
  });

  it('no mezcla una instalación con una salida normal pendiente', async () => {
    const f = fixture();
    const save = deferred();
    f.prepare.mockReturnValue(save.promise);
    const pending = f.guard.request('quit', vi.fn());
    const install = vi.fn();
    expect(await f.guard.request('update', install)).toBe(false);
    save.resolve();
    await pending;
    expect(install).not.toHaveBeenCalled();
  });

  it('cancela ante error sin revelar el mensaje del proveedor al diálogo', async () => {
    const f = fixture();
    f.prepare.mockRejectedValue(new Error('C:/ruta-privada/token'));
    const proceed = vi.fn();
    expect(await f.guard.request('quit', proceed)).toBe(false);
    expect(f.decide).toHaveBeenCalledWith('save-failed');
    expect(f.resume).toHaveBeenCalledOnce();
    expect(proceed).not.toHaveBeenCalled();
  });

  it('permite reintentar un error resuelto sin duplicar la salida', async () => {
    const f = fixture();
    f.prepare.mockRejectedValueOnce(new Error('ocupado'));
    f.decide.mockResolvedValueOnce('retry');
    const proceed = vi.fn();
    expect(await f.guard.request('quit', proceed)).toBe(true);
    expect(f.prepare).toHaveBeenCalledTimes(2);
    expect(proceed).toHaveBeenCalledOnce();
  });

  it('sale sin guardar sólo después de una decisión explícita', async () => {
    const f = fixture();
    f.prepare.mockRejectedValue(new Error('ocupado'));
    f.decide.mockResolvedValue('proceed');
    const proceed = vi.fn();
    expect(await f.guard.request('quit', proceed)).toBe(true);
    expect(f.approve).toHaveBeenCalledOnce();
    expect(proceed).toHaveBeenCalledOnce();
  });

  it('el timeout cancela y una escritura tardía nunca provoca salida', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const save = deferred();
    f.prepare.mockReturnValue(save.promise);
    const proceed = vi.fn();
    const pending = f.guard.request('quit', proceed);
    await vi.advanceTimersByTimeAsync(SHUTDOWN_SAVE_TIMEOUT_MS);
    expect(await pending).toBe(false);
    expect(f.decide).toHaveBeenCalledWith('timeout');
    save.resolve();
    await Promise.resolve();
    expect(proceed).not.toHaveBeenCalled();
  });

  it('reintentar un timeout espera la misma escritura y no crea otra', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const save = deferred();
    f.prepare.mockReturnValue(save.promise);
    f.decide.mockResolvedValueOnce('retry');
    const pending = f.guard.request('quit', vi.fn());
    await vi.advanceTimersByTimeAsync(SHUTDOWN_SAVE_TIMEOUT_MS);
    expect(f.prepare).toHaveBeenCalledTimes(1);
    save.resolve();
    expect(await pending).toBe(true);
  });

  it('cancelar invalida la autorización pendiente y permite un intento nuevo', async () => {
    const f = fixture();
    const save = deferred();
    f.prepare.mockReturnValueOnce(save.promise);
    const oldProceed = vi.fn();
    const pending = f.guard.request('quit', oldProceed);
    await Promise.resolve();
    f.guard.cancel();
    const newProceed = vi.fn();
    expect(await f.guard.request('quit', newProceed)).toBe(true);
    save.resolve();
    expect(await pending).toBe(false);
    expect(oldProceed).not.toHaveBeenCalled();
    expect(newProceed).toHaveBeenCalledOnce();
  });

  it('un fallo del diálogo o del instalador cancela sin dejar una autorización', async () => {
    const f = fixture();
    f.prepare.mockRejectedValueOnce(new Error('fallo'));
    f.decide.mockRejectedValueOnce(new Error('diálogo no disponible'));
    expect(await f.guard.request('quit', vi.fn())).toBe(false);
    expect(await f.guard.request('update', () => { throw new Error('instalador no disponible'); })).toBe(false);
    expect(f.guard.consumeQuitApproval()).toBe(false);
    expect(f.resume).toHaveBeenCalledTimes(2);
  });

  it('cancelar antes del primer microtask no inicia un guardado tardío', async () => {
    const f = fixture();
    const proceed = vi.fn();
    const pending = f.guard.request('quit', proceed);
    f.guard.cancel();
    expect(await pending).toBe(false);
    expect(f.prepare).not.toHaveBeenCalled();
    expect(proceed).not.toHaveBeenCalled();
    expect(f.approve).not.toHaveBeenCalled();
  });

  it('el cierre comprometido no se revierte ni inicia otra operación', async () => {
    const f = fixture();
    f.guard.commit();
    f.guard.cancel();
    expect(await f.guard.request('update', vi.fn())).toBe(false);
    expect(f.resume).not.toHaveBeenCalled();
    expect(f.prepare).not.toHaveBeenCalled();
  });
});
