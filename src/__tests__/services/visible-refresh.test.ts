import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisibleRefresh } from '../../services/visible-refresh';

let hidden = false;
beforeEach(() => {
  vi.useFakeTimers(); hidden = false;
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible');
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const visibility = (value: boolean) => { hidden = value; document.dispatchEvent(new Event('visibilitychange')); };

describe('Refresco coordinado por visibilidad', () => {
  it('agrupa doscientos eventos en una solicitud y no conserva timers al retirar', async () => {
    const task = vi.fn();
    const refresh = createVisibleRefresh(task, 8000, vi.fn());
    for (let index = 0; index < 200; index++) refresh.request();
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(50);
    expect(task).toHaveBeenCalledTimes(1);
    refresh.dispose();
    window.dispatchEvent(new Event('focus')); visibility(false); visibility(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(task).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('no consulta durante un minuto oculto y recupera invalidaciones al volver', async () => {
    hidden = true;
    const task = vi.fn();
    const refresh = createVisibleRefresh(task, 8000, vi.fn());
    for (let index = 0; index < 200; index++) refresh.request();
    await vi.advanceTimersByTimeAsync(60000);
    expect(task).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    visibility(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(task).toHaveBeenCalledTimes(1);
    refresh.dispose();
  });

  it('no solapa una solicitud lenta y agrupa una recuperación posterior', async () => {
    let finish!: () => void;
    const task = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; })).mockResolvedValue(undefined);
    const refresh = createVisibleRefresh(task, 8000, vi.fn());
    refresh.request(); await vi.advanceTimersByTimeAsync(50);
    for (let index = 0; index < 200; index++) refresh.request();
    await vi.advanceTimersByTimeAsync(60000);
    expect(task).toHaveBeenCalledTimes(1);
    finish(); await vi.advanceTimersByTimeAsync(50);
    expect(task).toHaveBeenCalledTimes(2);
    refresh.dispose();
  });

  it('un error permite reintento y dispose durante la solicitud no reactiva timers', async () => {
    const error = new Error('Sin red'), onError = vi.fn();
    let finish!: () => void;
    const task = vi.fn().mockRejectedValueOnce(error).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const refresh = createVisibleRefresh(task, 8000, onError);
    refresh.request(); await vi.advanceTimersByTimeAsync(50);
    expect(onError).toHaveBeenCalledWith(error);
    await vi.advanceTimersByTimeAsync(8050);
    expect(task).toHaveBeenCalledTimes(2);
    refresh.dispose(); finish();
    await vi.advanceTimersByTimeAsync(60000);
    expect(task).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ocultar cancela el refresco aún no iniciado y conserva la recuperación', async () => {
    const task = vi.fn(), refresh = createVisibleRefresh(task, 15000, vi.fn());
    refresh.request(); visibility(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(task).not.toHaveBeenCalled();
    visibility(false); await vi.advanceTimersByTimeAsync(50);
    expect(task).toHaveBeenCalledTimes(1);
    refresh.dispose();
  });
});
