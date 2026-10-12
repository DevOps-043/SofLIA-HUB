import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, screen } from 'electron';
import { GuidanceSurfaces } from '../orb-guidance/surfaces';
import { initialGuidanceState } from '../../src/shared/orb-guidance';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(screen, { getDisplayNearestPoint: vi.fn(() => screen.getPrimaryDisplay()), getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })) });
});
afterEach(() => vi.useRealTimers());
function fixture() {
  const orb = new BrowserWindow();
  let visible = true;
  vi.mocked(orb.isVisible).mockImplementation(() => visible);
  vi.mocked(orb.hide).mockImplementation(() => { visible = false; });
  Object.assign(orb, { showInactive: vi.fn(() => { visible = true; }), setFocusable: vi.fn() });
  const compact = vi.fn();
  const showOrb = vi.fn(async () => { visible = true; });
  const surfaces = new GuidanceSurfaces({ getOrb: () => orb, compact, showOrb });
  const state = { ...initialGuidanceState(), phase: 'presenting' as const, reducedMotion: true, target: { point: { x: 600, y: 300 } } };
  return { orb, surfaces, compact, showOrb, state };
}
describe('superficies de guía y captura limpia', () => {
  it('una actualización visual espera a que termine la captura', async () => {
    const { surfaces, showOrb, orb, state } = fixture(); const image = deferred<string>();
    const pending = surfaces.capture(() => image.promise);
    await vi.advanceTimersByTimeAsync(32);
    const rendering = surfaces.render(state);
    await Promise.resolve(); expect(showOrb).not.toHaveBeenCalled(); expect(orb.isVisible()).toBe(false);
    // Evitar crear marcas en este caso: sólo se comprueba la barrera de captura.
    surfaces.clear(); image.resolve('imagen');
    expect(await pending).toBe('imagen'); await rendering;
    expect(showOrb).not.toHaveBeenCalled(); surfaces.dispose();
  });
  it('cerrar la asistencia durante una captura impide que reaparezca la ventana', async () => {
    const { surfaces, orb } = fixture(); const image = deferred<string>();
    const pending = surfaces.capture(() => image.promise); await vi.advanceTimersByTimeAsync(32);
    surfaces.dismiss(); image.resolve('imagen'); await pending;
    expect(orb.isVisible()).toBe(false); surfaces.dispose();
  });
  it('restaura el orbe sólo al terminar todas las capturas y permite recuperarlo pausado', async () => {
    const { surfaces, orb } = fixture(); const first = deferred<string>(), second = deferred<string>();
    const a = surfaces.capture(() => first.promise), b = surfaces.capture(() => second.promise);
    await vi.advanceTimersByTimeAsync(32); surfaces.suspend();
    first.resolve('a'); await a; expect(orb.isVisible()).toBe(false);
    second.resolve('b'); await b; expect(orb.isVisible()).toBe(true); surfaces.dispose();
  });
  it('la animación cancelada libera su promesa y no termina el movimiento anterior', async () => {
    const { surfaces, state, orb } = fixture();
    const display = screen.getPrimaryDisplay();
    vi.spyOn(screen, 'getDisplayNearestPoint').mockReturnValue(display);
    const pending = surfaces.render({ ...state, reducedMotion: false });
    await vi.advanceTimersByTimeAsync(16); surfaces.clear(); await pending;
    const calls = vi.mocked(orb.setBounds).mock.calls.length;
    await vi.advanceTimersByTimeAsync(500); expect(orb.setBounds).toHaveBeenCalledTimes(calls); surfaces.dispose();
  });
  it('cancelar libera un render aunque el proveedor de captura siga pendiente', async () => {
    const { surfaces, state } = fixture(); const image = deferred<string>();
    const capture = surfaces.capture(() => image.promise); await vi.advanceTimersByTimeAsync(32);
    const pending = surfaces.render(state); surfaces.clear(); await pending;
    image.resolve('imagen'); await capture; surfaces.dispose();
  });
  it('el orbe deja pasar la entrada durante un arrastre y restaura los controles al terminar', async () => {
    const { surfaces, orb } = fixture();
    await surfaces.input(async () => { expect(orb.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true); });
    expect(orb.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false); surfaces.dispose();
  });
});
