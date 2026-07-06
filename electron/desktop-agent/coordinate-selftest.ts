import { screen as electronScreen } from 'electron';
import type { DesktopAgentConfig } from './agent-config';
import type { ScreenshotVirtualBounds } from './types';
import { buildScreenshotLayout, computeAdaptiveTargetSize } from './screenshot-layout';
import { dipToScreenPoint, mapDipPointToScreenshotPoint, mapScreenshotToDipPoint } from './screenshot-coordinates';

type Point = { x: number; y: number };

export type CalibrationPointResult = {
  dip: Point;
  imagen: Point;
  esperadoFisico: Point;
  obtenidoFisico: Point;
  deltaPx: number;
  ok: boolean;
};

export type CalibrationMonitorReport = {
  monitor: string;
  boundsDip: ScreenshotVirtualBounds;
  scaleFactor: number;
  puntos: CalibrationPointResult[];
  ok: boolean;
};

export type CalibrationReport = {
  ok: boolean;
  toleranciaPx: number;
  monitores: CalibrationMonitorReport[];
  generadoEn: number;
  error?: string;
};

export type CalibrationDeps = {
  config: DesktopAgentConfig;
  /** Mueve el cursor a un punto FISICO y devuelve la posicion FISICA real leida. */
  moveCursorAndRead: (point: Point) => Promise<Point>;
  displays?: Array<{ id: string | number; bounds: ScreenshotVirtualBounds; scaleFactor: number }>;
  toleranciaPx?: number;
};

const DEFAULT_TOLERANCE_PX = 2;

const CURSOR_ROUNDTRIP_SCRIPT = (x: number, y: number) => `
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
Add-Type -TypeDefinition $source
[void][W.Cur]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})
Start-Sleep -Milliseconds 40
$p = New-Object W.Cur+POINT
[void][W.Cur]::GetCursorPos([ref]$p)
"$($p.X),$($p.Y)"
`;

export function buildCursorRoundtripMover(
  psEncoded: (script: string, timeout?: number) => Promise<string>,
): (point: Point) => Promise<Point> {
  return async (point) => {
    const stdout = await psEncoded(CURSOR_ROUNDTRIP_SCRIPT(point.x, point.y), 5000);
    const [x, y] = stdout.trim().split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`GetCursorPos devolvio una posicion invalida: "${stdout.trim()}"`);
    }
    return { x, y };
  };
}

/**
 * Autotest de calibracion del pipeline de coordenadas: por cada monitor,
 * mapea 5 puntos DIP (centro + cuadrantes) por el ciclo completo
 * DIP -> imagen -> DIP -> fisico, mueve el cursor real y compara con
 * GetCursorPos. Valida la topologia real (multi-monitor, DPI mixto) sin
 * depender del modelo de vision.
 */
export async function runCoordinateSelfTest(deps: CalibrationDeps): Promise<CalibrationReport> {
  const toleranciaPx = deps.toleranciaPx ?? DEFAULT_TOLERANCE_PX;
  const generadoEn = Date.now();
  let displays: CalibrationDeps['displays'];
  try {
    displays = deps.displays ?? electronScreen.getAllDisplays();
  } catch (err) {
    return { ok: false, toleranciaPx, monitores: [], generadoEn, error: `No se pudieron enumerar los monitores: ${toErrorMessage(err)}` };
  }
  if (!displays || displays.length === 0) {
    return { ok: false, toleranciaPx, monitores: [], generadoEn, error: 'Sin monitores detectados.' };
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

    const puntosDip = buildProbePoints(bounds);
    const puntos: CalibrationPointResult[] = [];
    for (const dip of puntosDip) {
      const imagen = mapDipPointToScreenshotPoint(dip.x, dip.y, layout);
      const dipVuelta = imagen ? mapScreenshotToDipPoint(imagen.x, imagen.y, layout) : null;
      const esperadoFisico = dipToScreenPoint(dipVuelta ?? dip);
      let obtenidoFisico: Point;
      try {
        obtenidoFisico = await deps.moveCursorAndRead(esperadoFisico);
      } catch (err) {
        puntos.push({
          dip,
          imagen: imagen ?? { x: -1, y: -1 },
          esperadoFisico,
          obtenidoFisico: { x: -1, y: -1 },
          deltaPx: Number.POSITIVE_INFINITY,
          ok: false,
        });
        console.warn(`[DesktopAgent] Calibracion: fallo al mover el cursor: ${toErrorMessage(err)}`);
        continue;
      }
      const deltaPx = Math.max(Math.abs(obtenidoFisico.x - esperadoFisico.x), Math.abs(obtenidoFisico.y - esperadoFisico.y));
      puntos.push({
        dip,
        imagen: imagen ?? { x: -1, y: -1 },
        esperadoFisico,
        obtenidoFisico,
        deltaPx,
        ok: deltaPx <= toleranciaPx,
      });
    }

    const ok = puntos.length > 0 && puntos.every((punto) => punto.ok);
    monitores.push({
      monitor: `monitor ${index + 1} (display ${display.id})`,
      boundsDip: bounds,
      scaleFactor: display.scaleFactor,
      puntos,
      ok,
    });
    console.log(
      `[DesktopAgent] Calibracion ${ok ? 'OK' : 'FALLO'} en monitor ${index + 1} (escala ${display.scaleFactor}x): ${puntos.filter((punto) => punto.ok).length}/${puntos.length} puntos dentro de ±${toleranciaPx}px.`,
    );
  }

  return { ok: monitores.every((monitor) => monitor.ok), toleranciaPx, monitores, generadoEn };
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
