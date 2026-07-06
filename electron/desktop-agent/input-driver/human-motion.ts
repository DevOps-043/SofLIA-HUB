import type { PhysicalPoint } from './types';

/**
 * Generacion de trayectorias de mouse "humanas" (PURO, sin dependencias
 * nativas — de ahi que sea testeable en aislamiento).
 *
 * Modelo: una curva Bezier cubica entre origen y destino con dos puntos de
 * control desviados perpendicularmente (arco natural, no linea recta), muestreada
 * en N pasos cuyo espaciado sigue un ease-in-out (acelera al salir, frena al
 * llegar). La cantidad de pasos y la duracion crecen con la distancia (inspirado
 * en la ley de Fitts: mover mas lejos toma mas tiempo). Se agrega jitter acotado
 * para que no sea perfectamente geometrico.
 */

export type HumanPathOptions = {
  /** Pasos minimos aunque la distancia sea corta. */
  minSteps?: number;
  /** Pasos maximos para no saturar en distancias largas. */
  maxSteps?: number;
  /** Pixeles por paso objetivo (menos = trayectoria mas densa/suave). */
  pixelsPerStep?: number;
  /** Amplitud maxima del arco como fraccion de la distancia. */
  curvature?: number;
  /** Jitter maximo en pixeles perpendicular a la trayectoria. */
  jitter?: number;
  /** Generador aleatorio inyectable (para tests deterministas). */
  random?: () => number;
};

export type PathWaypoint = { x: number; y: number; /** ms acumulados desde el inicio */ atMs: number };

const DEFAULTS = {
  minSteps: 8,
  maxSteps: 60,
  pixelsPerStep: 12,
  curvature: 0.12,
  jitter: 2,
  baseDurationMs: 120,
  msPerPixel: 0.7,
};

export function distance(a: PhysicalPoint, b: PhysicalPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Duracion total del movimiento en ms segun la distancia (ley de Fitts simplificada). */
export function motionDurationMs(dist: number): number {
  return Math.round(DEFAULTS.baseDurationMs + dist * DEFAULTS.msPerPixel);
}

/**
 * Construye los waypoints físico→físico. Garantiza que el primer punto es el
 * origen exacto y el ultimo es el destino exacto (el jitter nunca desplaza los
 * extremos: el click debe caer donde se pidio).
 */
export function buildHumanPath(
  desde: PhysicalPoint,
  hasta: PhysicalPoint,
  options: HumanPathOptions = {},
): PathWaypoint[] {
  const opts = { ...DEFAULTS, ...options };
  const random = options.random ?? Math.random;
  const dist = distance(desde, hasta);

  if (dist < 1) {
    return [{ x: hasta.x, y: hasta.y, atMs: 0 }];
  }

  const steps = clamp(Math.round(dist / opts.pixelsPerStep), opts.minSteps, opts.maxSteps);
  const totalMs = motionDurationMs(dist);

  // Puntos de control desviados perpendicularmente para dar arco.
  const dirX = (hasta.x - desde.x) / dist;
  const dirY = (hasta.y - desde.y) / dist;
  const perpX = -dirY;
  const perpY = dirX;
  const arc = dist * opts.curvature * (random() * 2 - 1);
  const c1 = { x: desde.x + dirX * dist * 0.33 + perpX * arc, y: desde.y + dirY * dist * 0.33 + perpY * arc };
  const c2 = { x: desde.x + dirX * dist * 0.66 + perpX * arc, y: desde.y + dirY * dist * 0.66 + perpY * arc };

  const waypoints: PathWaypoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const linear = i / steps;
    const eased = easeInOut(linear);
    const point = cubicBezier(desde, c1, c2, hasta, eased);
    const isEndpoint = i === 0 || i === steps;
    const jx = isEndpoint ? 0 : perpX * (random() * 2 - 1) * opts.jitter;
    const jy = isEndpoint ? 0 : perpY * (random() * 2 - 1) * opts.jitter;
    waypoints.push({
      x: i === 0 ? desde.x : i === steps ? hasta.x : Math.round(point.x + jx),
      y: i === 0 ? desde.y : i === steps ? hasta.y : Math.round(point.y + jy),
      atMs: Math.round(eased * totalMs),
    });
  }
  return waypoints;
}

function cubicBezier(p0: PhysicalPoint, p1: PhysicalPoint, p2: PhysicalPoint, p3: PhysicalPoint, t: number): PhysicalPoint {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x,
    y: w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y,
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
