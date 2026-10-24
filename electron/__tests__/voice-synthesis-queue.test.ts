import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceSynthesisQueue, VOICE_SYNTHESIS_QUEUE_MS, VOICE_SYNTHESIS_WAITING } from '../voice/synthesis-queue';
import { deferred } from './project-hub/fixtures';
afterEach(() => vi.useRealTimers());
describe('Prefetch acotado de voz', () => {
  it('permite cuatro frases paralelas y retira una espera cancelada antes del proveedor', async () => {
    const queue = new VoiceSynthesisQueue(); const controls = Array.from({ length: 6 }, () => new AbortController());
    const waiting = Array.from({ length: 6 }, () => deferred<number>()); const started = vi.fn();
    const calls = controls.map((control, index) => queue.run(control.signal, () => { started(index); return waiting[index].promise; }));
    const cancelled = expect(calls[4]).rejects.toThrow('context_invalid');
    expect(started).toHaveBeenCalledTimes(4); controls[4].abort(); await cancelled;
    waiting[0].resolve(0); await calls[0]; expect(started).toHaveBeenCalledTimes(5); expect(started).toHaveBeenLastCalledWith(5);
    for (const index of [1, 2, 3, 5]) waiting[index].resolve(index);
    await Promise.all([calls[1], calls[2], calls[3], calls[5]]);
  });
  it('rechaza exceso de espera sin ampliar la cola y libera sus timers', async () => {
    const queue = new VoiceSynthesisQueue(); const stop = deferred<number>();
    const active = Array.from({ length: 4 }, () => queue.run(new AbortController().signal, () => stop.promise));
    const controls = Array.from({ length: VOICE_SYNTHESIS_WAITING }, () => new AbortController());
    const waiting = controls.map(controller => expect(queue.run(controller.signal, async () => 1)).rejects.toThrow('context_invalid'));
    await expect(queue.run(new AbortController().signal, async () => 0)).rejects.toThrow('voice_busy');
    controls.forEach(controller => controller.abort()); await Promise.all(waiting); stop.resolve(0); await Promise.all(active);
  });
  it('una espera vence antes de consumir cuota', async () => {
    vi.useFakeTimers(); const queue = new VoiceSynthesisQueue(); const stop = deferred<number>();
    const active = Array.from({ length: 4 }, () => queue.run(new AbortController().signal, () => stop.promise)); const provider = vi.fn(async () => 1);
    const pending = expect(queue.run(new AbortController().signal, provider)).rejects.toThrow('voice_busy');
    await vi.advanceTimersByTimeAsync(VOICE_SYNTHESIS_QUEUE_MS); await pending; expect(provider).not.toHaveBeenCalled();
    stop.resolve(0); await Promise.all(active); expect(vi.getTimerCount()).toBe(0);
  });
});
