import type { DesktopActionPayload } from '../desktop-agent-types';
import { DeterministicActionError } from './action-errors';

export type ResolvedScreenPoint = {
  x: number;
  y: number;
  dipX?: number;
  dipY?: number;
  source: 'layout' | 'scale';
  regionLabel?: string | null;
};

export function formatActionCoordinateResolution(
  action: DesktopActionPayload,
  resolveScreenPoint: (x: number, y: number) => ResolvedScreenPoint,
): string | null {
  const describePoint = (label: string, x: number, y: number): string => {
    const resolved = resolveScreenPoint(x, y);
    const dipSuffix = resolved.source === 'layout' && resolved.dipX !== undefined && resolved.dipY !== undefined
      ? ` -> dip (${resolved.dipX.toFixed(1)}, ${resolved.dipY.toFixed(1)})`
      : '';
    const regionSuffix = resolved.regionLabel ? ` [${resolved.regionLabel}]` : '';
    return `${label} img (${Math.round(x)}, ${Math.round(y)})${dipSuffix} -> screen (${resolved.x}, ${resolved.y})${regionSuffix}`;
  };

  if (action.action === 'drag' && action.x !== undefined && action.y !== undefined && action.x2 !== undefined && action.y2 !== undefined) {
    return `[DesktopAgent] Coordenadas resueltas (${action.action}): ${describePoint('inicio', action.x, action.y)} | ${describePoint('fin', action.x2, action.y2)}`;
  }
  if (action.x !== undefined && action.y !== undefined) {
    return `[DesktopAgent] Coordenadas resueltas (${action.action}): ${describePoint('punto', action.x, action.y)}`;
  }
  if (action.action === 'zoom') {
    const zx = action.zoomX ?? action.x;
    const zy = action.zoomY ?? action.y;
    if (zx !== undefined && zy !== undefined) {
      return `[DesktopAgent] Coordenadas resueltas (${action.action}): ${describePoint('centro', zx, zy)}`;
    }
  }
  return null;
}

export function assertActionTargetsVisibleContent(
  action: DesktopActionPayload,
  resolveScreenPoint: (x: number, y: number) => ResolvedScreenPoint,
): void {
  const assertPoint = (label: string, x: number, y: number): void => {
    const resolved = resolveScreenPoint(x, y);
    if (resolved.regionLabel === 'padding') {
      // Es geometria determinista: ese punto es la barra negra del compositor,
      // no contenido. Reintentar la misma coordenada no cambia nada -> se falla
      // rapido (sin 3 reintentos) con un mensaje que empuja a otra estrategia.
      throw new DeterministicActionError(
        `La coordenada ${label} (${Math.round(x)}, ${Math.round(y)}) cae en el padding negro fuera del contenido visible. NO reintentes ahi: elige un marcador [N] sobre contenido real, o usa scroll/teclado para navegar.`,
      );
    }
  };

  if (action.action === 'drag' && action.x !== undefined && action.y !== undefined && action.x2 !== undefined && action.y2 !== undefined) {
    assertPoint('inicio', action.x, action.y);
    assertPoint('fin', action.x2, action.y2);
    return;
  }
  if (action.action === 'zoom') {
    const zx = action.zoomX ?? action.x;
    const zy = action.zoomY ?? action.y;
    if (zx !== undefined && zy !== undefined) assertPoint('zoom', zx, zy);
    return;
  }
  if (action.x !== undefined && action.y !== undefined) assertPoint('punto', action.x, action.y);
}
