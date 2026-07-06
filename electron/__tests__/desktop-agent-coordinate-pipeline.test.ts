import { describe, expect, it, vi } from 'vitest';
import { screen as electronScreen } from 'electron';
import {
  buildScreenshotLayout,
  computeAdaptiveTargetSize,
  getVirtualDesktopBounds,
} from '../desktop-agent/screenshot-layout';
import {
  mapDipPointToScreenshotPoint,
  mapScreenshotToDipPoint,
  physicalRectToDipRect,
} from '../desktop-agent/screenshot-coordinates';
import { refineDesktopActionCoordinates } from '../desktop-agent/action-coordinate-refinement';
import { resolveScreenPointFromState } from '../desktop-agent/screen-scale-state';

// Topologia real del usuario: 3 monitores con resoluciones, posiciones y DPI distintos.
const TRES_MONITORES = [
  { id: 1, bounds: { x: 0, y: 0, width: 2560, height: 1440 }, scaleFactor: 1.0 },
  { id: 2, bounds: { x: -1707, y: 200, width: 1707, height: 960 }, scaleFactor: 1.5 },
  { id: 3, bounds: { x: 2560, y: -120, width: 1920, height: 1080 }, scaleFactor: 2.0 },
];

describe('Pipeline de coordenadas multi-monitor', () => {
  it('CP-001: bounds virtuales abarcan monitores con offsets negativos', () => {
    const bounds = getVirtualDesktopBounds(TRES_MONITORES);
    expect(bounds).toEqual({ x: -1707, y: -120, width: 6187, height: 1560 });
  });

  it('CP-002: round-trip imagen<->DIP con error < 1px en las 3 topologias', () => {
    const virtualBounds = getVirtualDesktopBounds(TRES_MONITORES);
    const target = computeAdaptiveTargetSize(virtualBounds, {
      targetWidth: 1024, targetHeight: 768, minRenderScale: 0.5, maxScreenshotEdge: 1568,
    });
    const layout = buildScreenshotLayout({
      displays: TRES_MONITORES,
      targetWidth: target.width,
      targetHeight: target.height,
      captureBounds: null,
    });

    // Un punto interior por monitor (centro de cada display en DIP).
    for (const display of TRES_MONITORES) {
      const dip = {
        x: display.bounds.x + display.bounds.width / 2,
        y: display.bounds.y + display.bounds.height / 2,
      };
      const imagen = mapDipPointToScreenshotPoint(dip.x, dip.y, layout);
      expect(imagen).not.toBeNull();
      const vuelta = mapScreenshotToDipPoint(imagen!.x, imagen!.y, layout);
      expect(vuelta).not.toBeNull();
      expect(Math.abs(vuelta!.x - dip.x)).toBeLessThan(1);
      expect(Math.abs(vuelta!.y - dip.y)).toBeLessThan(1);
    }
  });

  it('CP-003: cada region de display queda dentro de la imagen y sin solaparse fuera', () => {
    const layout = buildScreenshotLayout({
      displays: TRES_MONITORES,
      targetWidth: 1568,
      targetHeight: 396,
      captureBounds: null,
    });
    expect(layout.displayRegions).toHaveLength(3);
    for (const region of layout.displayRegions) {
      expect(region.left).toBeGreaterThanOrEqual(0);
      expect(region.top).toBeGreaterThanOrEqual(0);
      expect(region.left + region.width).toBeLessThanOrEqual(layout.screenshotWidth + 1);
      expect(region.top + region.height).toBeLessThanOrEqual(layout.screenshotHeight + 1);
    }
  });

  it('CP-004: computeAdaptiveTargetSize garantiza renderScale legible en escritorios anchos', () => {
    // Caso del log real: escritorio virtual de 5206x1080 comprimido a 1024x768 (renderScale 0.19).
    const bounds = { x: 0, y: 0, width: 5206, height: 1080 };
    const target = computeAdaptiveTargetSize(bounds, {
      targetWidth: 1024, targetHeight: 768, minRenderScale: 0.5, maxScreenshotEdge: 1568,
    });
    const renderScale = Math.min(target.width / bounds.width, target.height / bounds.height);
    // No alcanza 0.5 por el tope de 1568px, pero mejora sustancialmente el 0.19 original.
    expect(renderScale).toBeGreaterThan(0.25);
    expect(Math.max(target.width, target.height)).toBeLessThanOrEqual(1568);
  });

  it('CP-005: computeAdaptiveTargetSize conserva el tamano base cuando ya es legible', () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const target = computeAdaptiveTargetSize(bounds, {
      targetWidth: 1024, targetHeight: 768, minRenderScale: 0.5, maxScreenshotEdge: 1568,
    });
    expect(target).toEqual({ width: 1024, height: 768 });
  });

  it('CP-006: captura de monitor activo produce layout estable de un solo monitor', () => {
    const display = TRES_MONITORES[2];
    const layout = buildScreenshotLayout({
      displays: TRES_MONITORES,
      targetWidth: 1024,
      targetHeight: 768,
      captureBounds: { ...display.bounds },
    });
    expect(layout.virtualBounds).toEqual(display.bounds);
    expect(layout.displayRegions).toHaveLength(1);
    expect(layout.displayRegions[0].displayId).toBe('3');
  });

  it('CP-007: physicalRectToDipRect convierte por esquinas cuando screenToDipRect no existe', () => {
    const screenAny = electronScreen as any;
    const prevRect = screenAny.screenToDipRect;
    const prevPoint = screenAny.screenToDipPoint;
    screenAny.screenToDipRect = undefined;
    screenAny.screenToDipPoint = vi.fn((point: { x: number; y: number }) => ({ x: point.x / 2, y: point.y / 2 }));
    try {
      const dip = physicalRectToDipRect({ x: 200, y: 100, width: 400, height: 300 });
      expect(dip).toEqual({ x: 100, y: 50, width: 200, height: 150 });
    } finally {
      screenAny.screenToDipRect = prevRect;
      screenAny.screenToDipPoint = prevPoint;
    }
  });

  it('CP-008: sin layout y sin fallback legacy, resolver coordenadas es un error explicito', () => {
    expect(() => resolveScreenPointFromState({
      x: 100,
      y: 100,
      screenScale: { scaleX: 1.9, scaleY: 1.4 },
      legacyScaleFallbackEnabled: false,
      mapScreenshotToDipPoint: () => null,
      dipToScreenPoint: (point) => point,
      getRegionLabel: () => null,
    })).toThrow(/Captura sin layout/);
  });

  it('CP-009: con flag legacy activo se mantiene el fallback de escala anterior', () => {
    const resolved = resolveScreenPointFromState({
      x: 100,
      y: 100,
      screenScale: { scaleX: 2, scaleY: 1.5 },
      legacyScaleFallbackEnabled: true,
      mapScreenshotToDipPoint: () => null,
      dipToScreenPoint: (point) => point,
      getRegionLabel: () => null,
    });
    expect(resolved).toMatchObject({ x: 200, y: 150, source: 'scale' });
  });

  it('CP-010: click crudo no hace snap semantico hacia Text/Pane cercanos', () => {
    const refined = refineDesktopActionCoordinates({
      action: { action: 'click', x: 497, y: 629, message: 'click directo' },
      layout: null,
      currentUIElements: [
        {
          id: 1,
          name: '= ow | | E ow',
          controlType: 'Text',
          boundingRect: { x: 400, y: 600, width: 200, height: 80 },
          isEnabled: true,
          value: '',
        },
      ],
      mapDesktopRectToScreenshotRect: (rect) => rect,
      log: vi.fn(),
    });

    expect(refined).toMatchObject({ x: 497, y: 629 });
  });
});
