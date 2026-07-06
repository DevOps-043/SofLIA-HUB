import { describe, expect, it, vi } from 'vitest';
import { createDesktopAgentService } from './fixture';
import { mockDualDisplay, mockSingleDisplay, setLayout } from './display-fixture';

describe('DesktopAgentService - coordenadas de pantalla', () => {
  it('CU-143A: round-trips coordinates across multi-monitor screenshot layout', async () => {
    const service = await createDesktopAgentService();
    mockDualDisplay();
    service.calculateScreenScale();

    const screenshotPoint = service.mapDesktopPointToScreenshotPoint(2500, 900);
    expect(screenshotPoint).not.toBeNull();
    expect(screenshotPoint!.x).toBeGreaterThan(700);
    expect(screenshotPoint!.y).toBeGreaterThan(450);

    const dipPoint = service.mapScreenshotToDipPoint(screenshotPoint!.x, screenshotPoint!.y);
    expect(dipPoint!.x).toBeCloseTo(2500, 0);
    expect(dipPoint!.y).toBeCloseTo(900, 0);
  });

  it('CU-143B: type action uses screenshot coordinates directly before typing', async () => {
    const service = await createDesktopAgentService();
    mockSingleDisplay();
    // Con el binding de layout, resolver coordenadas exige un layout valido de la captura.
    setLayout(service, {
      screenshotWidth: 1024,
      screenshotHeight: 768,
      offsetX: 0,
      offsetY: 0,
      renderScale: 1,
      virtualBounds: { x: 0, y: 0, width: 1024, height: 768 },
      displayRegions: [{ displayId: '0', bounds: { x: 0, y: 0, width: 1024, height: 768 }, left: 0, top: 0, width: 1024, height: 768 }],
    });
    const mouseClickSpy = vi.spyOn(service, 'mouseClick').mockResolvedValue(undefined);
    const keyboardTypeSpy = vi.spyOn(service, 'keyboardType').mockResolvedValue(undefined);
    vi.spyOn(service, 'delay').mockResolvedValue(undefined);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await service.executeAction({ action: 'type', x: 100, y: 200, text: 'hola', message: 'enfocar y escribir' });

    expect(mouseClickSpy).toHaveBeenCalledWith(100, 200);
    expect(keyboardTypeSpy).toHaveBeenCalledWith('hola');
    consoleLogSpy.mockRestore();
  });

  it('CU-143C: updateScreenScale preserves focused capture layout when one is already active', async () => {
    const service = await createDesktopAgentService();
    mockSingleDisplay();
    setLayout(service, {
      screenshotWidth: 1024,
      screenshotHeight: 768,
      offsetX: 0,
      offsetY: 0,
      renderScale: 1,
      virtualBounds: { x: 300, y: 200, width: 1024, height: 768 },
      displayRegions: [{ displayId: '0', bounds: { x: 300, y: 200, width: 1024, height: 768 }, left: 0, top: 0, width: 1024, height: 768 }],
    });

    service.updateScreenScale(1024, 768);
    const dipPoint = service.mapScreenshotToDipPoint(10, 20);

    expect(dipPoint!.x).toBeCloseTo(310, 0);
    expect(dipPoint!.y).toBeCloseTo(220, 0);
  });
});
