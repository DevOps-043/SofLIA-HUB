import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../desktop-agent/agent-config';
import { buildCursorRoundtripMover, runCoordinateSelfTest } from '../desktop-agent/coordinate-selftest';

/** Topologia real del usuario que reporto el cursor moviendose solo. */
const TRES_MONITORES = [
  { id: 1, bounds: { x: 0, y: 0, width: 2560, height: 1440 }, scaleFactor: 1 },
  { id: 2, bounds: { x: -1707, y: 200, width: 1707, height: 960 }, scaleFactor: 1 },
  { id: 3, bounds: { x: 2560, y: -120, width: 1920, height: 1080 }, scaleFactor: 1 },
];

const baseDeps = { config: DEFAULT_CONFIG, displays: TRES_MONITORES };

describe('Calibracion de coordenadas del Desktop Agent', () => {
  it('CAL-001: el modo pasivo valida el mapeo sin pedir jamas mover el cursor', async () => {
    const report = await runCoordinateSelfTest(baseDeps);

    expect(report.modo).toBe('passive');
    expect(report.ok).toBe(true);
    expect(report.monitores).toHaveLength(3);
    // Sin lectura fisica no hay posicion obtenida: el punto se juzga por el
    // round-trip DIP -> imagen -> DIP.
    expect(report.monitores.every((monitor) => monitor.puntos.every((punto) => punto.obtenidoFisico === null))).toBe(true);
  });

  it('CAL-002: el modo cursor agrupa los 5 puntos en UNA sola llamada por monitor', async () => {
    const mover = vi.fn(async (points: Array<{ x: number; y: number }>) => points.map((point) => ({ ...point })));

    const report = await runCoordinateSelfTest({ ...baseDeps, moveCursorAndRead: mover });

    expect(report.modo).toBe('cursor');
    expect(report.ok).toBe(true);
    // 3 llamadas (una por monitor), no 15 (una por punto): cada invocacion
    // abre un PowerShell y recompila el tipo C#.
    expect(mover).toHaveBeenCalledTimes(3);
    expect(mover.mock.calls.every(([points]) => points.length === 5)).toBe(true);
  });

  it('CAL-003: un fallo del round-trip de cursor degrada el reporte sin lanzar', async () => {
    const mover = vi.fn(async () => {
      throw new Error('PowerShell no devolvio ninguna posicion de cursor (stdout vacio).');
    });

    const report = await runCoordinateSelfTest({ ...baseDeps, moveCursorAndRead: mover });

    expect(report.ok).toBe(false);
    expect(report.monitores[0].errorCursor).toContain('stdout vacio');
    expect(report.monitores[0].puntos.every((punto) => !punto.ok)).toBe(true);
  });

  it('CAL-004: una desviacion mayor a la tolerancia marca el punto como fallido', async () => {
    const mover = async (points: Array<{ x: number; y: number }>) => points.map((point) => ({ x: point.x + 10, y: point.y }));

    const report = await runCoordinateSelfTest({ ...baseDeps, moveCursorAndRead: mover });

    expect(report.ok).toBe(false);
    expect(report.monitores[0].puntos[0].deltaPx).toBe(10);
  });

  it('CAL-005: un punto ilegible no invalida los demas del lote', async () => {
    const mover = async (points: Array<{ x: number; y: number }>) => points.map(
      (point, index) => (index === 0 ? null : { ...point }),
    );

    const report = await runCoordinateSelfTest({ ...baseDeps, moveCursorAndRead: mover });

    expect(report.monitores[0].puntos[0].ok).toBe(false);
    expect(report.monitores[0].puntos.slice(1).every((punto) => punto.ok)).toBe(true);
  });
});

describe('buildCursorRoundtripMover', () => {
  it('CAL-006: resuelve todo el lote con una sola sesion de PowerShell', async () => {
    const psEncoded = vi.fn(async () => '100,200\r\n300,400');
    const mover = buildCursorRoundtripMover(psEncoded);

    const leidos = await mover([{ x: 100, y: 200 }, { x: 300, y: 400 }]);

    expect(psEncoded).toHaveBeenCalledTimes(1);
    expect(leidos).toEqual([{ x: 100, y: 200 }, { x: 300, y: 400 }]);
  });

  it('CAL-007: compila el tipo C# una vez y restaura la posicion inicial', async () => {
    const psEncoded = vi.fn(async () => '10,20');
    await buildCursorRoundtripMover(psEncoded)([{ x: 10, y: 20 }]);

    const [script, timeout] = psEncoded.mock.calls[0] as unknown as [string, number];
    expect(script.match(/Add-Type/g)).toHaveLength(1);
    expect(script).toContain('[void][W.Cur]::SetCursorPos($inicial.X, $inicial.Y)');
    // Compilar con Add-Type domina el costo: 5s producia stdout vacio.
    expect(timeout).toBeGreaterThanOrEqual(20_000);
  });

  it('CAL-008: stdout vacio se reporta como error explicito, no como posicion invalida', async () => {
    const mover = buildCursorRoundtripMover(async () => '');

    await expect(mover([{ x: 1, y: 2 }])).rejects.toThrow(/stdout vacio/);
  });

  it('CAL-009: un fallo fatal de PowerShell se propaga con su mensaje', async () => {
    const mover = buildCursorRoundtripMover(async () => 'FATAL:No se pudo cargar user32.dll');

    await expect(mover([{ x: 1, y: 2 }])).rejects.toThrow(/No se pudo cargar user32\.dll/);
  });

  it('CAL-010: una linea ERR devuelve null para ese punto y conserva el resto', async () => {
    const mover = buildCursorRoundtripMover(async () => 'ERR:SetCursorPos rechazado\n300,400');

    expect(await mover([{ x: 100, y: 200 }, { x: 300, y: 400 }])).toEqual([null, { x: 300, y: 400 }]);
  });
});
