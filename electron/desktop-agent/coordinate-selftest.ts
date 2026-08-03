import { screen as electronScreen } from 'electron';
import type { DesktopAgentConfig } from './agent-config';
import type { ScreenshotVirtualBounds } from './types';
import { buildScreenshotLayout, computeAdaptiveTargetSize } from './screenshot-layout';
import { dipToScreenPoint, mapDipPointToScreenshotPoint, mapScreenshotToDipPoint } from './screenshot-coordinates';

type Point = { x: number; y: number };

/**
 * 'passive' valida solo la aritmetica de coordenadas y NUNCA toca el mouse.
 * 'cursor' agrega el round-trip real SetCursorPos/GetCursorPos, que secuestra
 * el puntero del usuario y por eso solo corre a peticion explicita.
 */
export type CalibrationMode = 'cursor' | 'passive';

export type CalibrationPointResult = {
  dip: Point;
  imagen: Point | null;
  esperadoFisico: Point;
  /** Solo en modo 'cursor': posicion fisica real leida tras mover el puntero. */
  obtenidoFisico: Point | null;
  deltaPx: number;
  ok: boolean;
};

export type CalibrationMonitorReport = {
  monitor: string;
  boundsDip: ScreenshotVirtualBounds;
  scaleFactor: number;
  puntos: CalibrationPointResult[];
  ok: boolean;
  /** Motivo por el que el round-trip de cursor no pudo leerse, si aplica. */
  errorCursor?: string;
};

export type CalibrationReport = {
  ok: boolean;
  modo: CalibrationMode;
  toleranciaPx: number;
  monitores: CalibrationMonitorReport[];
  generadoEn: number;
  error?: string;
};

export type CalibrationDeps = {
  config: DesktopAgentConfig;
  /**
   * Mueve el cursor a cada punto FISICO y devuelve la posicion FISICA real
   * leida (null en los puntos que no se pudieron leer). Se recibe el lote
   * completo a proposito: una sola invocacion de PowerShell por monitor en vez
   * de una por punto. Omitirlo ejecuta el autotest en modo pasivo.
   */
  moveCursorAndRead?: (points: Point[]) => Promise<Array<Point | null>>;
  displays?: Array<{ id: string | number; bounds: ScreenshotVirtualBounds; scaleFactor: number }>;
  toleranciaPx?: number;
};

const DEFAULT_TOLERANCE_PX = 2;
/** Compilar el tipo C# con Add-Type domina el costo; 5s se quedaba corto. */
const CURSOR_SCRIPT_TIMEOUT_MS = 20_000;
const CURSOR_SETTLE_MS = 40;

/**
 * Recorre todos los puntos en UNA sola sesion de PowerShell: antes se abria un
 * proceso (y se recompilaba el tipo C#) por punto, lo que agotaba el timeout y
 * devolvia stdout vacio. Guarda la posicion inicial y la restaura al final: un
 * diagnostico no debe dejar el mouse tirado en una esquina.
 */
const CURSOR_ROUNDTRIP_SCRIPT = (points: Point[]) => `
$ErrorActionPreference = 'Stop'
$source = @"
using System;
using System.Runtime.InteropServices;
namespace W {
  public static class Cur {
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  }
}
"@
try {
  Add-Type -TypeDefinition $source
  $inicial = New-Object 'W.Cur+POINT'
  [void][W.Cur]::GetCursorPos([ref]$inicial)
  $objetivos = @(${points.map((point) => `'${Math.round(point.x)},${Math.round(point.y)}'`).join(',')})
  foreach ($objetivo in $objetivos) {
    $partes = $objetivo.Split(',')
    if (-not [W.Cur]::SetCursorPos([int]$partes[0], [int]$partes[1])) { 'ERR:SetCursorPos rechazado'; continue }
    Start-Sleep -Milliseconds ${CURSOR_SETTLE_MS}
    $p = New-Object 'W.Cur+POINT'
    if (-not [W.Cur]::GetCursorPos([ref]$p)) { 'ERR:GetCursorPos rechazado'; continue }
    "$($p.X),$($p.Y)"
  }
  [void][W.Cur]::SetCursorPos($inicial.X, $inicial.Y)
} catch {
  "FATAL:$($_.Exception.Message)"
}
`;

export function buildCursorRoundtripMover(
  psEncoded: (script: string, timeout?: number) => Promise<string>,
): (points: Point[]) => Promise<Array<Point | null>> {
  return async (points) => {
    if (points.length === 0) return [];
    const stdout = await psEncoded(CURSOR_ROUNDTRIP_SCRIPT(points), CURSOR_SCRIPT_TIMEOUT_MS);
    const lineas = stdout.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);

    const fatal = lineas.find((linea) => linea.startsWith('FATAL:'));
    if (fatal) throw new Error(`PowerShell fallo durante el round-trip de cursor: ${fatal.slice('FATAL:'.length)}`);
    if (lineas.length === 0) {
      throw new Error('PowerShell no devolvio ninguna posicion de cursor (stdout vacio).');
    }

    return points.map((_point, index) => {
      const linea = lineas[index];
      if (!linea || linea.startsWith('ERR:')) return null;
      const [x, y] = linea.split(',').map(Number);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    });
  };
}

/**
 * Autotest de calibracion del pipeline de coordenadas: por cada monitor,
 * mapea 5 puntos DIP (centro + cuadrantes) por el ciclo DIP -> imagen -> DIP.
 * En modo 'cursor' ademas los materializa con SetCursorPos y compara contra
 * GetCursorPos. Valida la topologia real (multi-monitor, DPI mixto) sin
 * depender del modelo de vision.
 */
export async function runCoordinateSelfTest(deps: CalibrationDeps): Promise<CalibrationReport> {
  const toleranciaPx = deps.toleranciaPx ?? DEFAULT_TOLERANCE_PX;
  const modo: CalibrationMode = deps.moveCursorAndRead ? 'cursor' : 'passive';
  const generadoEn = Date.now();
  let displays: CalibrationDeps['displays'];
  try {
    displays = deps.displays ?? electronScreen.getAllDisplays();
  } catch (err) {
    return { ok: false, modo, toleranciaPx, monitores: [], generadoEn, error: `No se pudieron enumerar los monitores: ${toErrorMessage(err)}` };
  }
  if (!displays || displays.length === 0) {
    return { ok: false, modo, toleranciaPx, monitores: [], generadoEn, error: 'Sin monitores detectados.' };
  }

  const monitores: CalibrationMonitorReport[] = [];
  for (const [index, display] of displays.entries()) {
    const bounds = display.bounds;
    const target = computeAdaptiveTargetSize(bounds, {
      targetWidth: deps.config.screenshotWidth,
      targetHeight: deps.config.screenshotHeight,
      minRenderScale: deps.config.minRenderScale,
      maxScreenshotEdge: deps.config.maxScreenshotEdge,
    });
    const layout = buildScreenshotLayout({
      displays,
      targetWidth: target.width,
      targetHeight: target.height,
      captureBounds: { ...bounds },
    });

    // Fase pura: el mapeo no toca el sistema, asi que se resuelve entero antes
    // de decidir si hace falta mover el cursor.
    const mapeos = buildProbePoints(bounds).map((dip) => {
      const imagen = mapDipPointToScreenshotPoint(dip.x, dip.y, layout);
      const dipVuelta = imagen ? mapScreenshotToDipPoint(imagen.x, imagen.y, layout) : null;
      return { dip, imagen, dipVuelta, esperadoFisico: dipToScreenPoint(dipVuelta ?? dip) };
    });

    let leidos: Array<Point | null> = mapeos.map(() => null);
    let errorCursor: string | undefined;
    if (deps.moveCursorAndRead) {
      try {
        leidos = await deps.moveCursorAndRead(mapeos.map((mapeo) => mapeo.esperadoFisico));
      } catch (err) {
        errorCursor = toErrorMessage(err);
        console.warn(`[DesktopAgent] Calibracion: fallo al mover el cursor: ${errorCursor}`);
      }
    }

    const puntos = mapeos.map((mapeo, posicion) => buildPointResult(mapeo, leidos[posicion] ?? null, modo, toleranciaPx));
    const ok = puntos.length > 0 && puntos.every((punto) => punto.ok);
    monitores.push({
      monitor: `monitor ${index + 1} (display ${display.id})`,
      boundsDip: bounds,
      scaleFactor: display.scaleFactor,
      puntos,
      ok,
      ...(errorCursor ? { errorCursor } : {}),
    });
    console.log(
      `[DesktopAgent] Calibracion ${ok ? 'OK' : 'FALLO'} (${modo}) en monitor ${index + 1} (escala ${display.scaleFactor}x): ${puntos.filter((punto) => punto.ok).length}/${puntos.length} puntos dentro de ±${toleranciaPx}px.`,
    );
  }

  return { ok: monitores.every((monitor) => monitor.ok), modo, toleranciaPx, monitores, generadoEn };
}

type ProbeMapping = {
  dip: Point;
  imagen: Point | null;
  dipVuelta: Point | null;
  esperadoFisico: Point;
};

function buildPointResult(
  mapeo: ProbeMapping,
  obtenidoFisico: Point | null,
  modo: CalibrationMode,
  toleranciaPx: number,
): CalibrationPointResult {
  const base = { dip: mapeo.dip, imagen: mapeo.imagen, esperadoFisico: mapeo.esperadoFisico };

  // Sin mapeo el punto no es comparable: es un fallo del pipeline, no del mouse.
  if (!mapeo.imagen || !mapeo.dipVuelta) {
    return { ...base, obtenidoFisico: null, deltaPx: Number.POSITIVE_INFINITY, ok: false };
  }

  if (modo === 'passive') {
    const deltaPx = Math.max(
      Math.abs(mapeo.dipVuelta.x - mapeo.dip.x),
      Math.abs(mapeo.dipVuelta.y - mapeo.dip.y),
    );
    return { ...base, obtenidoFisico: null, deltaPx, ok: deltaPx <= toleranciaPx };
  }

  if (!obtenidoFisico) {
    return { ...base, obtenidoFisico: null, deltaPx: Number.POSITIVE_INFINITY, ok: false };
  }
  const deltaPx = Math.max(
    Math.abs(obtenidoFisico.x - mapeo.esperadoFisico.x),
    Math.abs(obtenidoFisico.y - mapeo.esperadoFisico.y),
  );
  return { ...base, obtenidoFisico, deltaPx, ok: deltaPx <= toleranciaPx };
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Centro + puntos al 25%/75% de cada eje (esquinas interiores de cuadrantes). */
function buildProbePoints(bounds: ScreenshotVirtualBounds): Point[] {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const qx = bounds.width / 4;
  const qy = bounds.height / 4;
  return [
    { x: cx, y: cy },
    { x: cx - qx, y: cy - qy },
    { x: cx + qx, y: cy - qy },
    { x: cx - qx, y: cy + qy },
    { x: cx + qx, y: cy + qy },
  ];
}
