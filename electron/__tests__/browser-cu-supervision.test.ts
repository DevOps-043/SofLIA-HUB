import { describe, expect, it, vi } from 'vitest';
import { BrowserCuSupervisor } from '../desktop-agent/browser-cu-supervisor';
import { runSupervisedCuLoop } from '../desktop-agent/gemini-cu/supervised-loop';
import { CuContextChangedError } from '../desktop-agent/gemini-cu/execution-guard';
import type { CuClient } from '../desktop-agent/gemini-cu/client';
import type { CuDriver } from '../desktop-agent/gemini-cu/types';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const action = { functionCall: { name: 'click', args: { x: 200, y: 300 } }, text: '' };
const done = { functionCall: null, text: 'Listo' };
function fixture(maxSteps = 5) {
  const root = new AbortController(); const control = new BrowserCuSupervisor('browser-cu-prueba', maxSteps, root);
  const client: CuClient = { disponible: () => true, iniciar: vi.fn(async () => action), continuar: vi.fn(async () => done) };
  const driver: CuDriver = { entorno: 'ENVIRONMENT_BROWSER', capturar: vi.fn(async () => ({ base64: 'nueva', width: 100, height: 100 })), ejecutar: vi.fn(async () => {}), contexto: vi.fn(() => ({})) };
  const onStep = vi.fn();
  const run = () => runSupervisedCuLoop({ client, driver, task: 'Tarea', maxSteps, delay: async () => {}, onStep }, control);
  return { root, control, client, driver, run, onStep };
}
async function paused(control: BrowserCuSupervisor) { await vi.waitFor(() => expect(control.snapshot().status).toBe('paused')); }

describe('Supervisión del loop CU real', () => {
  it('descarta respuesta tardía y reanuda con una captura nueva', async () => {
    const f = fixture(); const pending = deferred<typeof action>();
    vi.mocked(f.client.iniciar).mockImplementationOnce(() => pending.promise);
    const result = f.run(); await vi.waitFor(() => expect(f.client.iniciar).toHaveBeenCalledOnce());
    f.control.command('pause'); await paused(f.control);
    expect(f.driver.ejecutar).not.toHaveBeenCalled();
    f.control.command('resume'); expect(await result).toMatchObject({ estado: 'completada', pasos: 1 });
    expect(f.client.iniciar).toHaveBeenCalledTimes(2);
    expect(f.driver.capturar).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(f.client.iniciar).mock.calls;
    expect(calls[0][3]?.aborted).toBe(true); expect(calls[1][3]?.aborted).toBe(false);
    pending.resolve(action); await Promise.resolve(); expect(f.driver.ejecutar).toHaveBeenCalledOnce();
    f.control.finish();
  });
  it('no declara pausa ni permite reanudar hasta drenar entrada nativa', async () => {
    const f = fixture(); const pending = deferred<void>();
    vi.mocked(f.driver.ejecutar).mockImplementationOnce(() => pending.promise);
    const result = f.run(); await vi.waitFor(() => expect(f.driver.ejecutar).toHaveBeenCalledOnce());
    f.control.command('pause'); expect(f.control.snapshot().status).toBe('pausing');
    expect(() => f.control.command('resume')).toThrow(); expect(f.client.continuar).not.toHaveBeenCalled();
    pending.resolve(); await paused(f.control); f.control.command('take-control');
    expect(await result).toMatchObject({ estado: 'cancelada', pasos: 1 });
    expect(f.client.continuar).not.toHaveBeenCalled(); f.control.finish();
  });
  it('acumula pasos y no repone el presupuesto al reanudar', async () => {
    const f = fixture(3); const pending = deferred<typeof action>();
    vi.mocked(f.client.continuar).mockImplementationOnce(() => pending.promise).mockResolvedValue(action);
    const result = f.run(); await vi.waitFor(() => expect(f.client.continuar).toHaveBeenCalledOnce());
    f.control.command('pause'); await paused(f.control); f.control.command('resume');
    expect(await result).toMatchObject({ estado: 'presupuesto_agotado', pasos: 3 });
    expect(f.onStep.mock.calls.map(([step]) => step.step)).toEqual([1, 2, 3]);
    expect(f.driver.ejecutar).toHaveBeenCalledTimes(3); pending.resolve(action); f.control.finish();
  });
  it.each(['stop', 'take-control', 'externa', 'finish'] as const)('cierra la espera pausada por %s sin otra captura', async mode => {
    const f = fixture(); vi.mocked(f.client.iniciar).mockImplementationOnce(() => new Promise(() => {}));
    const result = f.run(); await vi.waitFor(() => expect(f.client.iniciar).toHaveBeenCalledOnce());
    f.control.command('pause'); await paused(f.control);
    if (mode === 'externa') f.root.abort(); else if (mode === 'finish') f.control.finish(); else f.control.command(mode);
    expect(await result).toMatchObject({ estado: 'cancelada', pasos: 0 });
    expect(f.driver.capturar).toHaveBeenCalledOnce(); f.control.finish();
  });
  it('conserva la guarda original y bloquea destino cambiado al reanudar', async () => {
    const f = fixture(); vi.mocked(f.client.iniciar).mockImplementationOnce(() => new Promise(() => {}));
    const result = f.run(); await vi.waitFor(() => expect(f.client.iniciar).toHaveBeenCalledOnce());
    f.control.command('pause'); await paused(f.control);
    vi.mocked(f.driver.capturar).mockRejectedValueOnce(new CuContextChangedError());
    f.control.command('resume'); expect(await result).toMatchObject({ estado: 'bloqueada' });
    expect(f.driver.ejecutar).not.toHaveBeenCalled(); f.control.finish();
  });
  it('prohíbe pausa al arrancar y retira listeners al terminar', () => {
    const f = fixture(); const remove = vi.spyOn(f.root.signal, 'removeEventListener'); const listener = vi.fn();
    expect(() => f.control.command('pause')).toThrow();
    const unsubscribe = f.control.subscribe(listener); f.control.beginPhase(); unsubscribe(); f.control.finish();
    expect(listener).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(() => f.control.beginPhase()).toThrow(); expect(() => f.control.command('resume')).toThrow();
  });
});
