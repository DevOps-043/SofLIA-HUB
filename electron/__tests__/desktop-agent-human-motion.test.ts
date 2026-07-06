import { describe, expect, it } from 'vitest';
import { buildHumanPath, distance, motionDurationMs } from '../desktop-agent/input-driver/human-motion';

/** RNG determinista para tests reproducibles. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('human-motion: trayectorias', () => {
  it('HM-001: el primer punto es el origen exacto y el ultimo el destino exacto', () => {
    const path = buildHumanPath({ x: 100, y: 200 }, { x: 900, y: 640 }, { random: seededRandom(1) });
    expect(path[0]).toMatchObject({ x: 100, y: 200 });
    expect(path[path.length - 1]).toMatchObject({ x: 900, y: 640 });
  });

  it('HM-002: el tiempo acumulado es monotono no decreciente y termina en la duracion total', () => {
    const desde = { x: 0, y: 0 };
    const hasta = { x: 600, y: 400 };
    const path = buildHumanPath(desde, hasta, { random: seededRandom(7) });
    for (let i = 1; i < path.length; i++) {
      expect(path[i].atMs).toBeGreaterThanOrEqual(path[i - 1].atMs);
    }
    expect(path[path.length - 1].atMs).toBe(motionDurationMs(distance(desde, hasta)));
  });

  it('HM-003: mas distancia => mas pasos (acotado)', () => {
    const corto = buildHumanPath({ x: 0, y: 0 }, { x: 30, y: 0 }, { random: seededRandom(3) });
    const largo = buildHumanPath({ x: 0, y: 0 }, { x: 1500, y: 0 }, { random: seededRandom(3) });
    expect(largo.length).toBeGreaterThan(corto.length);
    expect(largo.length).toBeLessThanOrEqual(61); // maxSteps 60 + punto inicial
  });

  it('HM-004: el jitter no desvia los puntos interiores mas alla de la cota', () => {
    // Trayectoria horizontal: los puntos interiores no deben alejarse en Y mas
    // que el jitter configurado (el arco es 0 en linea recta sin curvatura).
    const path = buildHumanPath({ x: 0, y: 500 }, { x: 800, y: 500 }, {
      random: seededRandom(42),
      curvature: 0,
      jitter: 3,
    });
    for (let i = 1; i < path.length - 1; i++) {
      expect(Math.abs(path[i].y - 500)).toBeLessThanOrEqual(3);
    }
  });

  it('HM-005: distancia cero devuelve un unico punto en el destino', () => {
    const path = buildHumanPath({ x: 50, y: 50 }, { x: 50, y: 50 });
    expect(path).toHaveLength(1);
    expect(path[0]).toMatchObject({ x: 50, y: 50 });
  });
});
