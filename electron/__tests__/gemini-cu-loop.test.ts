import { describe, expect, it, vi } from 'vitest';
import { runComputerUseLoop } from '../desktop-agent/gemini-cu/loop';
import { traducirTeclasPlaywright } from '../desktop-agent/gemini-cu/browser-driver';
import type { CuAction, CuDriver, CuFunctionCall } from '../desktop-agent/gemini-cu/types';
import type { CuClient } from '../desktop-agent/gemini-cu/client';
import { CuContextChangedError } from '../desktop-agent/gemini-cu/execution-guard';

/** Cliente CU falso: devuelve una secuencia guionada de function_calls. */
function fakeClient(fcs: (CuFunctionCall | null)[], texts: string[] = []): CuClient & { continuar: any } {
  let idx = -1;
  return {
    disponible: () => true,
    iniciar: vi.fn(async () => { idx = 0; return { functionCall: fcs[0] ?? null, text: texts[0] ?? '' }; }),
    continuar: vi.fn(async () => { idx++; return { functionCall: fcs[idx] ?? null, text: texts[idx] ?? '' }; }),
  } as any;
}

function fakeDriver(): CuDriver & { acciones: CuAction[] } {
  const acciones: CuAction[] = [];
  return {
    entorno: 'ENVIRONMENT_DESKTOP',
    acciones,
    capturar: vi.fn(async () => ({ base64: 'x', width: 1000, height: 1000 })),
    ejecutar: vi.fn(async (a: CuAction) => { acciones.push(a); }),
    contexto: () => ({ url: 'about:blank' }),
  } as any;
}

const click = (x = 500, y = 500, safety?: unknown): CuFunctionCall => ({
  id: 'c', name: 'click', args: { x, y, ...(safety ? { safety_decision: safety } : {}) },
});
const base = (client: CuClient, driver: CuDriver, over: Partial<Parameters<typeof runComputerUseLoop>[0]> = {}) => ({
  client, driver, task: 'tarea', maxSteps: 10, delay: vi.fn(async () => {}), ...over,
});

describe('runComputerUseLoop', () => {
  it('continúa una descarga transitoria en la misma conversación hasta verificar la meta', async () => {
    const driver = fakeDriver(), client = fakeClient([click(), null, null], ['', 'El launcher está actualizando', 'Minecraft abierto']);
    client.reanudar = vi.fn(async () => ({ functionCall: { name: 'wait_5_seconds', args: {} }, text: '' }));
    const verifyCompletion = vi.fn().mockResolvedValueOnce({ confirmed: false, canContinue: true, reason: 'Descarga en curso.' })
      .mockResolvedValueOnce({ confirmed: true, reason: 'Juego y versión visibles.' });
    expect(await runComputerUseLoop(base(client, driver, { verifyCompletion }))).toMatchObject({ estado: 'completada', pasos: 3 });
    expect(client.iniciar).toHaveBeenCalledOnce();
    expect(client.reanudar).toHaveBeenCalledWith('x', 'Descarga en curso.', undefined);
    expect(driver.acciones.map(action => action.tipo)).toEqual(['click', 'wait']);
  });
  it.each([false, undefined])('no reanuda si la comprobación no autoriza explícitamente continuar (%s)', async canContinue => {
    const driver = fakeDriver(), client = fakeClient([null], ['¿Quieres continuar?']);
    client.reanudar = vi.fn();
    const verifyCompletion = vi.fn(async () => ({ confirmed: false, reason: 'Falta acceso o aprobación.', canContinue }));
    expect(await runComputerUseLoop(base(client, driver, { verifyCompletion }))).toMatchObject({ estado: 'fallida', pasos: 0 });
    expect(client.reanudar).not.toHaveBeenCalled(); expect(driver.ejecutar).not.toHaveBeenCalled();
  });
  it('acota cierres transitorios repetidos y respeta el presupuesto original', async () => {
    const driver = fakeDriver(), client = fakeClient([null]);
    client.reanudar = vi.fn(async () => ({ functionCall: null, text: 'Sigue cargando' }));
    const verifyCompletion = vi.fn(async () => ({ confirmed: false, canContinue: true, reason: 'Descarga en curso.' }));
    expect(await runComputerUseLoop(base(client, driver, { verifyCompletion }))).toMatchObject({ estado: 'fallida', pasos: 2 });
    expect(client.reanudar).toHaveBeenCalledTimes(2);
    vi.mocked(client.reanudar).mockClear();
    expect(await runComputerUseLoop(base(client, driver, { maxSteps: 1, verifyCompletion }))).toMatchObject({ estado: 'presupuesto_agotado', pasos: 1 });
    expect(client.reanudar).toHaveBeenCalledOnce();
  });
  it('verifica el cierre tras la última acción sin ejecutar una acción extra', async () => {
    const driver = fakeDriver(), client = fakeClient([click(), null], ['', 'Listo']);
    const verifyCompletion = vi.fn(async () => ({ confirmed: true, reason: 'Meta visible.' }));
    expect(await runComputerUseLoop(base(client, driver, { maxSteps: 1, verifyCompletion }))).toMatchObject({ estado: 'completada', pasos: 1 });
    expect(driver.ejecutar).toHaveBeenCalledOnce(); expect(verifyCompletion).toHaveBeenCalledOnce();
  });
  it('una recuperación conserva el bloqueo HITL antes de una acción sensible', async () => {
    const driver = fakeDriver(), client = fakeClient([null]);
    client.reanudar = vi.fn(async () => ({ functionCall: click(50, 50, { decision: 'require_confirmation' }), text: '' }));
    const verifyCompletion = vi.fn(async () => ({ confirmed: false, canContinue: true, reason: 'Cargando.' }));
    expect(await runComputerUseLoop(base(client, driver, { verifyCompletion }))).toMatchObject({ estado: 'cancelada' });
    expect(driver.ejecutar).not.toHaveBeenCalled();
  });
  it('cancela la recuperación pendiente y descarta su acción tardía', async () => {
    const abort = new AbortController(), driver = fakeDriver(), client = fakeClient([null]);
    let finish!: (value: { functionCall: CuFunctionCall; text: string }) => void;
    let entered!: () => void; const ready = new Promise<void>(resolve => { entered = resolve; });
    client.reanudar = vi.fn(() => { entered(); return new Promise<{ functionCall: CuFunctionCall; text: string }>(resolve => { finish = resolve; }); });
    const verifyCompletion = vi.fn(async () => ({ confirmed: false, canContinue: true, reason: 'Cargando.' }));
    const result = runComputerUseLoop(base(client, driver, { abortSignal: abort.signal, verifyCompletion }));
    await ready; abort.abort();
    expect(await result).toMatchObject({ estado: 'cancelada', pasos: 1 });
    finish({ functionCall: click(), text: '' }); await Promise.resolve();
    expect(driver.ejecutar).not.toHaveBeenCalled();
    expect(client.reanudar).toHaveBeenCalledWith('x', 'Cargando.', abort.signal);
  });
  it('no declara éxito si el modelo termina después de un clic fallido', async () => {
    const driver = fakeDriver(), client = fakeClient([click(), null], ['', 'Ya abrí Bloc de notas']);
    client.reanudar = vi.fn();
    vi.mocked(driver.ejecutar).mockRejectedValueOnce(new Error('El clic no se pudo ejecutar'));
    expect(await runComputerUseLoop(base(client, driver))).toMatchObject({ estado: 'fallida', pasos: 1 });
    expect(client.reanudar).not.toHaveBeenCalled();
  });
  it('no ejecuta la recuperación si el destino cambió durante la respuesta', async () => {
    const driver = fakeDriver(), client = fakeClient([null]); let changed = false;
    driver.contexto = () => { if (changed) throw new CuContextChangedError(); return {}; };
    client.reanudar = vi.fn(async () => { changed = true; return { functionCall: click(), text: '' }; });
    const verifyCompletion = vi.fn(async () => ({ confirmed: false, canContinue: true, reason: 'Cargando.' }));
    expect(await runComputerUseLoop(base(client, driver, { verifyCompletion }))).toMatchObject({ estado: 'bloqueada', pasos: 1 });
    expect(driver.ejecutar).not.toHaveBeenCalled();
  });
  it('la captura final debe corroborar la tarea antes de declarar éxito', async () => {
    const driver = fakeDriver(), client = fakeClient([click(), null], ['', 'Listo']);
    const verifyCompletion = vi.fn(async () => ({ confirmed: false, reason: 'Bloc de notas no está abierto.' }));
    const result = await runComputerUseLoop(base(client, driver, { settleDelayMs: 400, verifyCompletion }));
    expect(result.estado).toBe('fallida'); expect(result.mensaje).toContain('no está abierto');
    expect(verifyCompletion).toHaveBeenCalledWith(expect.objectContaining({ base64: 'x' }), 'Listo', undefined);
  });
  it('la verificación recaptura después de recibir el cierre, no reutiliza la imagen previa', async () => {
    const driver = fakeDriver(), client = fakeClient([click(), null], ['', 'Listo']);
    vi.mocked(driver.capturar).mockResolvedValueOnce({ base64: 'antes', width: 1000, height: 1000 })
      .mockResolvedValueOnce({ base64: 'nota-abierta', width: 1000, height: 1000 })
      .mockResolvedValueOnce({ base64: 'nota-cerrada', width: 1000, height: 1000 });
    const verifyCompletion = vi.fn(async () => ({ confirmed: false, reason: 'La nota ya no está visible.' }));
    expect((await runComputerUseLoop(base(client, driver, { verifyCompletion }))).estado).toBe('fallida');
    expect(verifyCompletion).toHaveBeenCalledWith(expect.objectContaining({ base64: 'nota-cerrada' }), 'Listo', undefined);
  });
  it.each(['inicio', 'continuación', 'confirmación'] as const)('deja de esperar %s aunque nunca responda y descarta su respuesta tardía', async (phase) => {
    const abort = new AbortController(); const driver = fakeDriver();
    const client = fakeClient([click(50, 50, phase === 'confirmación' ? { decision: 'require_confirmation' } : undefined)]);
    let entered!: () => void; const ready = new Promise<void>(done => { entered = done; });
    let finish!: () => void;
    const pending = () => { entered(); return new Promise<void>(done => { finish = done; }); };
    const response = async () => { await pending(); return { functionCall: click(), text: '' }; };
    if (phase === 'inicio') vi.mocked(client.iniciar).mockImplementationOnce(response);
    if (phase === 'continuación') client.continuar.mockImplementationOnce(response);
    const result = runComputerUseLoop(base(client, driver, { abortSignal: abort.signal, confirmSafety: async () => { await pending(); return true; } }));
    await ready; abort.abort('motivo privado');
    expect(await result).toMatchObject({ estado: 'cancelada', mensaje: 'Tarea cancelada.' });
    const count = phase === 'continuación' ? 1 : 0;
    expect(driver.acciones).toHaveLength(count);
    finish();
    await Promise.resolve();
    expect(driver.acciones).toHaveLength(count);
    expect(client.iniciar).toHaveBeenCalledWith('tarea', 'x', undefined, abort.signal);
  });

  it('CU-L-001: ejecuta acciones y termina (completada) al llegar function_call null', async () => {
    const client = fakeClient([click(), click(), null], ['', '', 'Listo']);
    const driver = fakeDriver();
    const r = await runComputerUseLoop(base(client, driver));
    expect(driver.acciones.map((a) => a.tipo)).toEqual(['click', 'click']);
    expect(r.estado).toBe('completada');
    expect(r.mensaje).toBe('Listo');
    expect(r.pasos).toBe(2);
  });

  it('CU-L-002: si nunca termina, agota el presupuesto', async () => {
    const client = fakeClient(Array(20).fill(click()));
    const driver = fakeDriver();
    const r = await runComputerUseLoop(base(client, driver, { maxSteps: 3 }));
    expect(r.estado).toBe('presupuesto_agotado');
    expect(r.pasos).toBe(3);
    expect(driver.acciones).toHaveLength(3);
  });

  it('CU-L-003: cancelación por abortSignal', async () => {
    const controller = new AbortController();
    controller.abort();
    const client = fakeClient([click(), null]);
    const driver = fakeDriver();
    const r = await runComputerUseLoop(base(client, driver, { abortSignal: controller.signal }));
    expect(r.estado).toBe('cancelada');
    expect(driver.acciones).toHaveLength(0);
    expect(driver.capturar).not.toHaveBeenCalled();
    expect(client.iniciar).not.toHaveBeenCalled();
  });

  it('CU-L-004: safety "blocked" no ejecuta y reporta bloqueada', async () => {
    const client = fakeClient([click(500, 500, { decision: 'blocked', explanation: 'peligro' })]);
    const driver = fakeDriver();
    const r = await runComputerUseLoop(base(client, driver));
    expect(r.estado).toBe('bloqueada');
    expect(r.mensaje).toContain('peligro');
    expect(driver.acciones).toHaveLength(0);
  });

  it('CU-L-005: require_confirmation sin aprobación cancela; con aprobación ejecuta y manda acknowledgement', async () => {
    // Sin aprobación
    const c1 = fakeClient([click(500, 500, { decision: 'require_confirmation', explanation: 'compra' })]);
    const d1 = fakeDriver();
    const r1 = await runComputerUseLoop(base(c1, d1, { confirmSafety: async () => false }));
    expect(r1.estado).toBe('cancelada');
    expect(d1.acciones).toHaveLength(0);

    // Con aprobación
    const c2 = fakeClient([click(500, 500, { decision: 'require_confirmation', explanation: 'compra' }), null]);
    const d2 = fakeDriver();
    const r2 = await runComputerUseLoop(base(c2, d2, { confirmSafety: async () => true }));
    expect(d2.acciones).toHaveLength(1);
    expect(r2.estado).toBe('completada');
    // El function_response de continuar lleva safety_acknowledgement:true.
    expect((c2.continuar as any).mock.calls[0][3]).toMatchObject({ safety_acknowledgement: true });
  });

  it('CU-L-006: cliente no disponible -> fallida sin ejecutar', async () => {
    const client = { disponible: () => false, iniciar: vi.fn(), continuar: vi.fn() } as any;
    const driver = fakeDriver();
    const r = await runComputerUseLoop(base(client, driver));
    expect(r.estado).toBe('fallida');
    expect(driver.capturar).not.toHaveBeenCalled();
  });

  it('cancela después de capturar sin enviar la imagen al proveedor', async () => {
    const abort = new AbortController(); const driver = fakeDriver(); const client = fakeClient([click()]);
    vi.mocked(driver.capturar).mockImplementationOnce(async () => { abort.abort(); return { base64: 'x', width: 10, height: 10 }; });
    expect(await runComputerUseLoop(base(client, driver, { abortSignal: abort.signal }))).toMatchObject({ estado: 'cancelada' });
    expect(client.iniciar).not.toHaveBeenCalled();
    expect(driver.capturar).toHaveBeenCalledWith(abort.signal);
  });

  it('una aprobación tardía después de cancelar no ejecuta la acción', async () => {
    const abort = new AbortController(); const driver = fakeDriver();
    const client = fakeClient([click(50, 50, { decision: 'require_confirmation' })]);
    const result = await runComputerUseLoop(base(client, driver, {
      abortSignal: abort.signal, confirmSafety: async () => { abort.abort(); return true; },
    }));
    expect(result.estado).toBe('cancelada');
    expect(driver.ejecutar).not.toHaveBeenCalled();
    expect(client.continuar).not.toHaveBeenCalled();
  });

  it('un contexto invalidado termina la tarea sin recapturar ni reintentar en otro destino', async () => {
    const driver = fakeDriver(); const client = fakeClient([click()]);
    vi.mocked(driver.ejecutar).mockRejectedValueOnce(new CuContextChangedError());
    expect(await runComputerUseLoop(base(client, driver))).toMatchObject({ estado: 'bloqueada', pasos: 1 });
    expect(driver.capturar).toHaveBeenCalledTimes(1);
    expect(client.continuar).not.toHaveBeenCalled();
  });

  it.each(['respuesta', 'error'] as const)('normaliza cancelación durante una %s tardía del proveedor', async (mode) => {
    const abort = new AbortController(); const driver = fakeDriver(); const client = fakeClient([click()]);
    vi.mocked(client.iniciar).mockImplementationOnce(async () => {
      abort.abort();
      if (mode === 'error') throw new Error('error no publicable');
      return { functionCall: click(), text: '' };
    });
    expect(await runComputerUseLoop(base(client, driver, { abortSignal: abort.signal }))).toMatchObject({ estado: 'cancelada', mensaje: 'Tarea cancelada.' });
    expect(driver.ejecutar).not.toHaveBeenCalled();
    expect(client.continuar).not.toHaveBeenCalled();
  });

  it('una captura posterior cancelada no produce otra solicitud al modelo', async () => {
    const abort = new AbortController(); const driver = fakeDriver(); const client = fakeClient([click()]);
    vi.mocked(driver.capturar).mockResolvedValueOnce({ base64: 'x', width: 10, height: 10 })
      .mockImplementationOnce(async () => { abort.abort(); throw new Error('cancelada'); });
    expect(await runComputerUseLoop(base(client, driver, { abortSignal: abort.signal }))).toMatchObject({ estado: 'cancelada', pasos: 1 });
    expect(driver.ejecutar).toHaveBeenCalledWith(expect.any(Object), expect.any(String), abort.signal);
    expect(client.continuar).not.toHaveBeenCalled();
  });

  it('no acepta un cierre exitoso si el contexto cambió mientras el modelo respondía', async () => {
    const driver = fakeDriver(); const client = fakeClient([null], ['Listo']);
    let changed = false;
    driver.contexto = () => { if (changed) throw new CuContextChangedError(); return {}; };
    vi.mocked(client.iniciar).mockImplementationOnce(async () => { changed = true; return { functionCall: null, text: 'Listo' }; });
    expect(await runComputerUseLoop(base(client, driver))).toMatchObject({ estado: 'bloqueada', pasos: 0 });
    expect(client.iniciar).toHaveBeenCalledOnce();
  });
});

describe('Traducción de teclas a Playwright', () => {
  it('CU-B-001: mapea combos a la sintaxis de Playwright', () => {
    expect(traducirTeclasPlaywright('ctrl+s')).toBe('Control+S');
    expect(traducirTeclasPlaywright('alt+f4')).toBe('Alt+F4');
    expect(traducirTeclasPlaywright('enter')).toBe('Enter');
    expect(traducirTeclasPlaywright('ctrl+shift+t')).toBe('Control+Shift+T');
  });
});
