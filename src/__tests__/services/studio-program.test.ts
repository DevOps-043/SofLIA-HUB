import { afterEach, describe, expect, it, vi } from 'vitest';
import { countdownText, holdingSchema, transitionSchema } from '../../shared/studio-program';
import { StudioProgramRenderer, createMediaProgramSource, createTextProgramSource, type ProgramSource } from '../../services/studio-program-renderer';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('reloj y transiciones del curso', () => {
  it('limita duración y cuenta absoluta, sin reanudar al llegar a cero', () => {
    expect(countdownText(null, 1000)).toBeNull(); expect(countdownText(61000, 1000)).toBe('01:00');
    expect(countdownText(61000, 60500)).toBe('00:01'); expect(countdownText(61000, 90000)).toBe('00:00');
    expect(transitionSchema.safeParse({ effect: 'fade', durationMs: 500 }).success).toBe(true);
    expect(transitionSchema.safeParse({ effect: 'fade', durationMs: 50000 }).success).toBe(false);
    expect(transitionSchema.safeParse({ effect: 'visual', durationMs: 1500, sceneId: 'imagen' }).success).toBe(true);
    expect(transitionSchema.safeParse({ effect: 'visual', durationMs: 1500 }).success).toBe(false);
    expect(transitionSchema.safeParse({ effect: 'visual', durationMs: 499, sceneId: 'imagen' }).success).toBe(false);
    expect(transitionSchema.safeParse({ effect: 'visual', durationMs: 10001, sceneId: 'imagen' }).success).toBe(false);
    expect(transitionSchema.safeParse({ effect: 'fade', durationMs: 2001 }).success).toBe(false);
    expect(holdingSchema.safeParse({ phase: 'break', seconds: -1 }).success).toBe(false);
  });
  it.each(['fade', 'wipe'] as const)('mantiene pista y fuente anterior hasta terminar %s', async (effect) => {
    let tick: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { tick = cb; return 1; })); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const ctx = { fillStyle: '', globalAlpha: 1, fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn() };
    const track = { stop: vi.fn() }, stream = { getTracks: () => [track] };
    const canvas = { getContext: () => ctx, captureStream: vi.fn(() => stream) } as unknown as HTMLCanvasElement;
    const previous: ProgramSource = { draw: vi.fn(), close: vi.fn() }, next: ProgramSource = { draw: vi.fn(), close: vi.fn() };
    const renderer = new StudioProgramRenderer(canvas, vi.fn()); await renderer.take(previous, { effect: 'cut', durationMs: 100 });
    const originalStream = renderer.capture(); const pending = renderer.take(next, { effect, durationMs: 500 });
    tick(250); expect(previous.close).not.toHaveBeenCalled(); expect(next.draw).toHaveBeenCalledOnce();
    expect(renderer.capture()).toBe(originalStream); expect(canvas.captureStream).toHaveBeenCalledOnce();
    const rejected = { draw: vi.fn(), close: vi.fn() }; await expect(renderer.take(rejected, { effect, durationMs: 500 })).rejects.toThrow(); expect(rejected.close).toHaveBeenCalledOnce();
    tick(600); await pending; expect(previous.close).toHaveBeenCalledOnce(); expect(track.stop).not.toHaveBeenCalled();
    renderer.close(); expect(next.close).toHaveBeenCalledOnce(); expect(track.stop).toHaveBeenCalledOnce();
  });
  it('el receso mantiene el reloj de su fecha de entrada a programa', () => {
    const ctx = { fillStyle: '', textAlign: '', font: '', fillRect: vi.fn(), fillText: vi.fn(), measureText: () => ({ width: 20 }) } as unknown as CanvasRenderingContext2D;
    const source = createTextProgramSource({ id: 'receso', kind: 'holding', name: 'Receso', title: 'Volvemos', description: '', holding: { phase: 'break', seconds: 60 } }, 1000);
    source.draw(ctx, 31000); expect(ctx.fillText).toHaveBeenCalledWith('00:30', 640, 640);
    source.draw(ctx, 90000); expect(ctx.fillText).toHaveBeenCalledWith('00:00', 640, 640);
  });
  it('inicia el reloj cuando aparece y no mientras se carga el contenido intermedio', () => {
    const ctx = { fillRect: vi.fn(), fillText: vi.fn(), measureText: () => ({ width: 20 }) } as unknown as CanvasRenderingContext2D;
    const source = createTextProgramSource({ id: 'receso', kind: 'holding', name: 'Receso', title: 'Volvemos', description: '', holding: { phase: 'break', seconds: 60 } });
    source.draw(ctx, 50000); expect(ctx.fillText).toHaveBeenLastCalledWith('01:00', 640, 640);
    source.draw(ctx, 60000); expect(ctx.fillText).toHaveBeenLastCalledWith('00:50', 640, 640);
  });
  it('cancela la carga de una pantalla y detiene su captura sin esperar los 10 segundos', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const stop = vi.fn(), controller = new AbortController();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const source = createMediaProgramSource({ id: 'pantalla', kind: 'screen', name: 'Presentación', title: '', description: '' }, stream, controller.signal);
    const failure = expect(source).rejects.toThrow('canceló'); controller.abort(); await failure;
    expect(stop).toHaveBeenCalledOnce(); expect(pause).toHaveBeenCalledOnce();
  });
  it.each([false, true])('muestra el intermedio hasta el destino y conserva pista (movimiento reducido: %s)', async (reduced) => {
    let tick: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { tick = cb; return 1; })); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const ctx = { fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), globalAlpha: 1 };
    const stream = { getTracks: () => [] };
    const renderer = new StudioProgramRenderer({ getContext: () => ctx, captureStream: () => stream } as unknown as HTMLCanvasElement, vi.fn());
    const previous = { draw: vi.fn(), close: vi.fn() }, bridge = { draw: vi.fn(), close: vi.fn() }, target = { draw: vi.fn(), close: vi.fn() };
    await renderer.take(previous, { effect: 'cut', durationMs: 100 });
    const captured = renderer.capture();
    const change = renderer.take(target, { effect: 'visual', durationMs: 1500, sceneId: 'imagen' }, bridge, reduced);
    tick(-10); expect(ctx.globalAlpha).toBe(reduced ? 1 : 0);
    tick(700); expect(bridge.draw).toHaveBeenCalledTimes(2); expect(target.draw).not.toHaveBeenCalled(); expect(previous.close).not.toHaveBeenCalled();
    tick(1400); expect(target.draw).toHaveBeenCalledTimes(reduced ? 0 : 1);
    tick(1550); await change;
    expect(renderer.capture()).toBe(captured); expect(previous.close).toHaveBeenCalledOnce(); expect(bridge.close).toHaveBeenCalledOnce();
    renderer.close(); expect(target.close).toHaveBeenCalledOnce();
  });
  it('libera las tres fuentes si se cancela durante el intermedio', async () => {
    let tick: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { tick = cb; return 1; })); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const renderer = new StudioProgramRenderer({ getContext: () => ({ fillRect() {}, save() {}, restore() {} }) } as unknown as HTMLCanvasElement, vi.fn());
    const previous = { draw: vi.fn(), close: vi.fn() }, bridge = { draw: vi.fn(), close: vi.fn() }, target = { draw: vi.fn(), close: vi.fn() };
    await renderer.take(previous, { effect: 'cut', durationMs: 100 });
    const change = renderer.take(target, { effect: 'visual', durationMs: 1500, sceneId: 'imagen' }, bridge);
    tick(700); renderer.close(); await change; tick(2000);
    expect(previous.close).toHaveBeenCalledOnce(); expect(bridge.close).toHaveBeenCalledOnce(); expect(target.close).toHaveBeenCalledOnce(); expect(target.draw).not.toHaveBeenCalled();
  });
  it('conserva la escena anterior si el intermedio falla y libera el destino', async () => {
    let tick: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { tick = cb; return 1; })); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const renderer = new StudioProgramRenderer({ getContext: () => ({ fillRect() {}, save() {}, restore() {} }) } as unknown as HTMLCanvasElement, vi.fn());
    const previous = { draw: vi.fn(), close: vi.fn() }, bridge = { draw: () => { throw new Error('Imagen perdida'); }, close: vi.fn() }, target = { draw: vi.fn(), close: vi.fn() };
    await renderer.take(previous, { effect: 'cut', durationMs: 100 });
    const failure = expect(renderer.take(target, { effect: 'visual', durationMs: 1500, sceneId: 'imagen' }, bridge)).rejects.toThrow('escena anterior');
    tick(700); await failure;
    expect(previous.close).not.toHaveBeenCalled(); expect(bridge.close).toHaveBeenCalledOnce(); expect(target.close).toHaveBeenCalledOnce(); renderer.close();
  });
  it('descarta un destino que falla al dibujar sin retirar el programa anterior', async () => {
    let tick: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { tick = cb; return 1; })); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const ctx = { fillRect: vi.fn(), save: vi.fn(), restore: vi.fn() };
    const renderer = new StudioProgramRenderer({ getContext: () => ctx } as unknown as HTMLCanvasElement, vi.fn());
    const previous = { draw: vi.fn(), close: vi.fn() }, broken = { draw: () => { throw new Error('Fuente perdida'); }, close: vi.fn() };
    await renderer.take(previous, { effect: 'cut', durationMs: 100 });
    const change = renderer.take(broken, { effect: 'fade', durationMs: 500 }); const failure = expect(change).rejects.toThrow('escena anterior');
    tick(250); await failure; expect(previous.close).not.toHaveBeenCalled(); expect(broken.close).toHaveBeenCalledOnce(); expect(ctx.restore).toHaveBeenCalledOnce();
    renderer.close();
  });
});
