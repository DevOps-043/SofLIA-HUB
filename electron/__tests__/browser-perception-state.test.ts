import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserPerceptionState, type BrowserPerceptionTarget, type BrowserVisualCapture } from '../integrated-browser/perception-state';
import type { BrowserObservationSnapshot } from '../integrated-browser/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const target = (changes: Partial<BrowserPerceptionTarget> = {}): BrowserPerceptionTarget => ({
  tabId: 'pestaña', url: 'https://example.test/', contents: {}, documentToken: 'documento',
  loadSequence: 1, visualRevision: 1, sessionGeneration: 1, policyRevision: 1, controlRevision: 1, ...changes,
});
const visual = (key: BrowserPerceptionTarget, screenshot = 'frame-nuevo'): BrowserVisualCapture => ({
  tabId: key.tabId, url: key.url, capturedAt: new Date().toISOString(), screenshot, revision: key.visualRevision,
});
const dom: BrowserObservationSnapshot['dom'] = { title: 'Prueba', url: 'https://example.test/', language: 'es', text: 'Contenido propio',
  headings: [], landmarks: [], controls: [], images: [], frames: [], truncated: false,
  viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 600 } };
const observation = () => ({ tabId: 'pestaña', capturedAt: new Date().toISOString(), screenshot: 'imagen', dom });
const fixture = () => {
  let current = true;
  const describeError = vi.fn(() => 'Error controlado');
  const state = new BrowserPerceptionState({ isCurrent: () => current, describeError });
  return { state, describeError, invalidateExternal: () => { current = false; } };
};
afterEach(() => vi.useRealTimers());

describe('propiedad de percepción efímera', () => {
  it('una guarda capturada antes de esperar no revive tras pausar y reactivar', () => {
    const { state } = fixture(), guard = state.guardCycle(); expect(guard()).toBe(true);
    state.setEnabled(false); state.setEnabled(true); expect(guard()).toBe(false);
    const fresh = state.guardCycle(); expect(fresh()).toBe(true); state.reset(); expect(fresh()).toBe(false);
  });

  it('coalesce el mismo destino vigente y publica una sola captura', async () => {
    const { state } = fixture(), key = target(), frame = deferred<BrowserVisualCapture>();
    const produce = vi.fn(() => frame.promise), lease = state.acquire(key);
    const a = state.captureVisual(lease, produce), b = state.captureVisual(state.acquire({ ...key }), produce);
    await Promise.resolve(); expect(produce).toHaveBeenCalledTimes(1);
    frame.resolve(visual(key)); expect(await a).toEqual(await b);
    expect(state.visual(key)?.screenshot).toBe('frame-nuevo'); expect(state.status(4000).capturing).toBe(false);
  });

  it('pausa/reactivación descarta frame anterior y serializa una producción nueva', async () => {
    const { state } = fixture(), key = target(), old = deferred<BrowserVisualCapture>(), next = deferred<BrowserVisualCapture>();
    const first = state.captureVisual(state.acquire(key), () => old.promise); await Promise.resolve();
    state.setEnabled(false); state.setEnabled(true);
    const produce = vi.fn(() => next.promise), second = state.captureVisual(state.acquire(key), produce);
    expect(produce).not.toHaveBeenCalled(); old.resolve(visual(key, 'revocado'));
    expect(await first).toBeNull(); await vi.waitFor(() => expect(produce).toHaveBeenCalledTimes(1));
    expect(state.visual(key)).toBeNull(); expect(state.status(4000).capturing).toBe(true);
    next.resolve(visual(key)); expect((await second)?.screenshot).toBe('frame-nuevo');
  });

  it.each(['pausa', 'cierre', 'pestaña'] as const)('ignora errores tardíos de un trabajo invalidado por %s', async kind => {
    const { state, describeError } = fixture(), key = target(), old = deferred<BrowserVisualCapture>();
    const pending = state.captureVisual(state.acquire(key), () => old.promise); await Promise.resolve();
    if (kind === 'pausa') { state.setEnabled(false); state.setEnabled(true); }
    else if (kind === 'cierre') state.reset(); else state.invalidate(key.tabId);
    old.reject(new Error('Contenido privado anterior')); expect(await pending).toBeNull();
    expect(describeError).not.toHaveBeenCalled(); expect(state.status(4000).lastError).toBeNull();
  });

  it.each(['contents', 'documentToken', 'loadSequence', 'sessionGeneration', 'visualRevision', 'policyRevision', 'controlRevision'] as const)(
    'no comparte un destino con cambio de %s aunque URL/tab sean iguales', async field => {
      const { state } = fixture(), key = target(), old = deferred<BrowserVisualCapture>();
      const first = state.captureVisual(state.acquire(key), () => old.promise); await Promise.resolve();
      const changed = { ...key, [field]: field === 'contents' ? {} : typeof key[field] === 'number' ? 2 : 'otro' };
      const produce = vi.fn(async () => visual(changed));
      const second = state.captureVisual(state.acquire(changed), produce);
      expect(produce).not.toHaveBeenCalled(); old.resolve(visual(key, 'anterior')); await first;
      expect((await second)?.revision).toBe(changed.visualRevision); expect(produce).toHaveBeenCalledTimes(1);
      expect(state.visual(key)).toBeNull();
    });

  it('un destino externo revocado no publica ni siquiera con producción correcta', async () => {
    const f = fixture(), key = target(), frame = deferred<BrowserVisualCapture>();
    const pending = f.state.captureVisual(f.state.acquire(key), () => frame.promise); await Promise.resolve();
    f.invalidateExternal(); frame.resolve(visual(key)); expect(await pending).toBeNull();
    expect(f.state.status(4000).lastCapturedAt).toBeNull();
  });

  it('invalidar antes del primer microtask libera el slot sin producir', async () => {
    const { state } = fixture(), key = target(), produce = vi.fn(async () => visual(key));
    const pending = state.captureVisual(state.acquire(key), produce); state.reset();
    expect(await pending).toBeNull(); expect(produce).not.toHaveBeenCalled();
    expect(state.status(4000).capturing).toBe(false);
    expect(await state.captureVisual(state.acquire(key), produce)).toBeTruthy();
  });

  it('un contexto obsoleto en cola no arranca al liberarse el slot', async () => {
    const { state } = fixture(), key = target(), old = deferred<BrowserVisualCapture>();
    const first = state.captureVisual(state.acquire(key), () => old.promise); await Promise.resolve();
    const produce = vi.fn(async () => visual(key));
    const second = state.captureVisual(state.acquire({ ...key, documentToken: 'otro' }), produce);
    state.reset(); old.resolve(visual(key)); await Promise.all([first, second]);
    expect(produce).not.toHaveBeenCalled(); expect(state.status(4000).capturing).toBe(false);
  });

  it('observación publica IDs/secuencia sólo para resultados vigentes y limpia errores', async () => {
    const { state } = fixture(), key = target(), stale = deferred<ReturnType<typeof observation>>();
    const a = state.captureObservation(state.acquire(key), () => stale.promise); await Promise.resolve();
    state.reset(); stale.resolve(observation()); expect(await a).toBeNull();
    await state.captureVisual(state.acquire(key), async () => { throw new Error('fallo'); });
    expect(state.status(4000).lastError).toBe('Error controlado');
    const b = await state.captureObservation(state.acquire(key), async () => observation());
    expect(b).toMatchObject({ id: expect.any(String), sequence: 1, dom });
    expect(state.status(4000).lastError).toBeNull();
    expect((await state.captureObservation(state.acquire(key), async () => observation()))?.sequence).toBe(2);
  });

  it('invalidar otra pestaña conserva la caché y el ciclo del destino activo', async () => {
    const { state } = fixture(), key = target();
    await state.captureVisual(state.acquire(key), async () => visual(key)); state.invalidate('otra');
    expect(state.visual(key)).toBeTruthy(); state.invalidate(key.tabId); expect(state.visual(key)).toBeNull();
  });

  it('timer por eventos se reemplaza y pausa/cierre impiden su ejecución', async () => {
    vi.useFakeTimers(); const { state } = fixture(), capture = vi.fn(async () => null);
    state.schedule(100, capture); state.schedule(200, capture);
    await vi.advanceTimersByTimeAsync(199); expect(capture).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(capture).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000); expect(capture).toHaveBeenCalledTimes(1);
    state.schedule(1, capture); state.setEnabled(false); await vi.advanceTimersByTimeAsync(10);
    state.setEnabled(true); state.schedule(1, capture); state.reset(); await vi.advanceTimersByTimeAsync(10);
    expect(capture).toHaveBeenCalledTimes(1); expect(state.timerPending).toBe(false);
  });

  it('un error del timer se controla y un rechazo tardío no pertenece al siguiente ciclo', async () => {
    vi.useFakeTimers(); const { state } = fixture();
    state.schedule(1, async () => { throw new Error('Fallo de preparación'); });
    await vi.advanceTimersByTimeAsync(1); expect(state.status(4000).lastError).toBe('Error controlado');
    const pending = deferred<null>(); state.schedule(1, () => pending.promise);
    await vi.advanceTimersByTimeAsync(1); state.setEnabled(false); state.setEnabled(true);
    pending.reject(new Error('Error revocado')); await vi.advanceTimersByTimeAsync(0);
    expect(state.status(4000).lastError).toBeNull();
  });

  it('pausa entre disparo del timer y su microtask impide empezar la captura revocada', async () => {
    vi.useFakeTimers(); const { state } = fixture(), capture = vi.fn(async () => null);
    state.schedule(1, capture); vi.advanceTimersByTime(1);
    state.setEnabled(false); state.setEnabled(true);
    await Promise.resolve(); await Promise.resolve(); expect(capture).not.toHaveBeenCalled();
  });
});
