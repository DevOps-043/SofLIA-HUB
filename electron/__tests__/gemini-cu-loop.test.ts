import { describe, expect, it, vi } from 'vitest';
import { runComputerUseLoop } from '../desktop-agent/gemini-cu/loop';
import { traducirTeclasPlaywright } from '../desktop-agent/gemini-cu/browser-driver';
import type { CuAction, CuDriver, CuFunctionCall } from '../desktop-agent/gemini-cu/types';
import type { CuClient } from '../desktop-agent/gemini-cu/client';

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
});

describe('Traducción de teclas a Playwright', () => {
  it('CU-B-001: mapea combos a la sintaxis de Playwright', () => {
    expect(traducirTeclasPlaywright('ctrl+s')).toBe('Control+S');
    expect(traducirTeclasPlaywright('alt+f4')).toBe('Alt+F4');
    expect(traducirTeclasPlaywright('enter')).toBe('Enter');
    expect(traducirTeclasPlaywright('ctrl+shift+t')).toBe('Control+Shift+T');
  });
});
