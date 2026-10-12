import { describe, expect, it } from 'vitest';
import { intersectRect, placeOrb, targetOnDisplay } from '../orb-guidance/geometry';
import { guidanceControlSchema, guidanceRequestSchema, practiceDefinitionSchema } from '../../src/shared/orb-guidance';

describe('geometría multimonitor y contratos de guía', () => {
  it.each([{ x: 0, y: 0, width: 1920, height: 1080 }, { x: -1920, y: -240, width: 1920, height: 1080 }])('mantiene el orbe visible sin cubrir el objetivo en %j', area => {
    const target = { point: { x: area.x + 10, y: area.y + 30 }, rect: { x: area.x + 2, y: area.y + 20, width: 90, height: 25 } };
    const bounds = placeOrb(target, area);
    expect(bounds.x).toBeGreaterThanOrEqual(area.x); expect(bounds.y).toBeGreaterThanOrEqual(area.y);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(area.x + area.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(area.y + area.height);
    expect(intersectRect(bounds, target.rect)).toBeNull();
  });
  it('recorta un objetivo que cruza monitores y descarta el monitor ajeno', () => {
    const target = { point: { x: -5, y: 100 }, rect: { x: -20, y: 80, width: 40, height: 40 } };
    expect(targetOnDisplay(target, { x: -1000, y: 0, width: 1000, height: 700 })?.rect).toEqual({ x: 980, y: 80, width: 20, height: 40 });
    expect(targetOnDisplay(target, { x: 0, y: 0, width: 1000, height: 700 })?.rect).toEqual({ x: 0, y: 80, width: 20, height: 40 });
    expect(targetOnDisplay(target, { x: 1000, y: 0, width: 1000, height: 700 })).toBeNull();
  });
  it('rechaza operaciones abiertas, recetas enormes y coordenadas desde IPC', () => {
    expect(guidanceControlSchema.safeParse({ action: 'pause', shell: 'exec' }).success).toBe(false);
    expect(guidanceRequestSchema.safeParse({ targetText: 'Guardar', instruction: 'Selecciona', x: 100, y: 100 }).success).toBe(false);
    expect(practiceDefinitionSchema.safeParse({ title: 'Práctica', steps: [] }).success).toBe(false);
    expect(practiceDefinitionSchema.safeParse({ title: 'Práctica', steps: Array.from({ length: 21 }, () => ({ instruction: 'Selecciona', targetText: 'Insertar', expectedText: 'Tabla' })) }).success).toBe(false);
  });
});
