import { describe, expect, it } from 'vitest';
import { denormalizar, mapCuFunctionCall, normalizarTeclas, extraerSafety } from '../desktop-agent/gemini-cu/action-mapping';

const W = 1920;
const H = 1080;

describe('Denormalización 0-999 → píxeles', () => {
  it('CU-M-001: convierte coordenada normalizada a píxel de la captura', () => {
    expect(denormalizar(0, W)).toBe(0);
    expect(denormalizar(500, W)).toBe(960);      // 500/1000*1920
    expect(denormalizar(978, H)).toBe(1056);     // barra de tareas (fondo)
    expect(denormalizar(999, W)).toBe(1918);
  });
  it('CU-M-002: robusto a NaN/undefined/strings', () => {
    expect(denormalizar(undefined, W)).toBe(0);
    expect(denormalizar('abc', W)).toBe(0);
    expect(denormalizar('500', W)).toBe(960);
  });
});

describe('Mapeo de acciones Computer Use', () => {
  it('CU-M-010: click con x,y normalizados e intent', () => {
    const m = mapCuFunctionCall({ id: 'c1', name: 'click', args: { x: 293, y: 978, intent: 'Abrir Inicio' } }, W, H);
    expect(m.callId).toBe('c1');
    expect(m.intent).toBe('Abrir Inicio');
    expect(m.action).toEqual({ tipo: 'click', punto: { x: 563, y: 1056 } });
  });

  it('CU-M-011: double_click y right_click', () => {
    expect(mapCuFunctionCall({ name: 'double_click', args: { x: 500, y: 500 } }, W, H).action)
      .toEqual({ tipo: 'double_click', punto: { x: 960, y: 540 } });
    expect(mapCuFunctionCall({ name: 'right_click', args: { x: 0, y: 0 } }, W, H).action)
      .toEqual({ tipo: 'right_click', punto: { x: 0, y: 0 } });
  });

  it('CU-M-012: type con press_enter', () => {
    const m = mapCuFunctionCall({ name: 'type', args: { text: 'hola', press_enter: true } }, W, H);
    expect(m.action).toEqual({ tipo: 'type', texto: 'hola', enter: true });
  });

  it('CU-M-013: press_key / hotkey normaliza a "ctrl+s"', () => {
    expect(mapCuFunctionCall({ name: 'press_key', args: { keys: 'Enter' } }, W, H).action)
      .toEqual({ tipo: 'key', teclas: 'enter' });
    expect(mapCuFunctionCall({ name: 'hotkey', args: { keys: ['Ctrl', 'S'] } }, W, H).action)
      .toEqual({ tipo: 'key', teclas: 'ctrl+s' });
  });

  it('CU-M-014: scroll con dirección y magnitud saneada', () => {
    expect(mapCuFunctionCall({ name: 'scroll', args: { direction: 'down', magnitude: 5 } }, W, H).action)
      .toEqual({ tipo: 'scroll', direccion: 'down', magnitud: 5, punto: undefined });
    // magnitud inválida -> 3
    expect(mapCuFunctionCall({ name: 'scroll', args: { direction: 'up' } }, W, H).action)
      .toMatchObject({ tipo: 'scroll', direccion: 'up', magnitud: 3 });
  });

  it('CU-M-015: drag_and_drop con destino', () => {
    const m = mapCuFunctionCall({ name: 'drag_and_drop', args: { x: 100, y: 100, destination_x: 900, destination_y: 500 } }, W, H);
    expect(m.action).toEqual({ tipo: 'drag', desde: { x: 192, y: 108 }, hasta: { x: 1728, y: 540 } });
  });

  it('CU-M-016: wait, navigate y go_back', () => {
    expect(mapCuFunctionCall({ name: 'wait', args: { ms: 2000 } }, W, H).action).toEqual({ tipo: 'wait', ms: 2000 });
    expect(mapCuFunctionCall({ name: 'navigate', args: { url: 'https://x.com' } }, W, H).action).toEqual({ tipo: 'navigate', url: 'https://x.com' });
    expect(mapCuFunctionCall({ name: 'go_back', args: {} }, W, H).action).toEqual({ tipo: 'go_back' });
  });

  it('CU-M-017: acción desconocida no rompe (se marca desconocida)', () => {
    const m = mapCuFunctionCall({ name: 'accion_rara', args: { foo: 1 } }, W, H);
    expect(m.action).toEqual({ tipo: 'desconocida', nombre: 'accion_rara', args: { foo: 1 } });
  });
});

describe('Extracción de safety_decision', () => {
  it('CU-M-020: lee require_confirmation con explicación', () => {
    const s = extraerSafety({ safety_decision: { decision: 'require_confirmation', explanation: 'compra' } });
    expect(s).toEqual({ decision: 'require_confirmation', explanation: 'compra' });
  });
  it('CU-M-021: sin safety_decision devuelve null', () => {
    expect(extraerSafety({})).toBeNull();
    expect(extraerSafety({ safety_decision: { decision: 'raro' } })).toBeNull();
  });
});

describe('normalizarTeclas', () => {
  it('CU-M-030: array y string', () => {
    expect(normalizarTeclas(['Ctrl', 'Shift', 'T'])).toBe('ctrl+shift+t');
    expect(normalizarTeclas('Alt F4')).toBe('alt+f4');
    expect(normalizarTeclas(undefined)).toBe('');
  });
});
