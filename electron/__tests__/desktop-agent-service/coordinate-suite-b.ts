import { describe, expect, it, vi } from 'vitest';
import { createDesktopAgentService } from './fixture';
import { mockSingleDisplay, setLayout } from './display-fixture';

const BASE_LAYOUT = {
  screenshotWidth: 1024,
  screenshotHeight: 768,
  offsetX: 0,
  offsetY: 0,
  renderScale: 1,
  virtualBounds: { x: 0, y: 0, width: 1024, height: 768 },
  displayRegions: [{ displayId: '0', bounds: { x: 0, y: 0, width: 1024, height: 768 }, left: 0, top: 0, width: 1024, height: 768 }],
};

describe('DesktopAgentService - snapping de acciones', () => {
  it('CU-143D: executeAction snaps approximate click to the center of the nearest interactive element', async () => {
    const service = await createDesktopAgentService();
    mockSingleDisplay();
    setLayout(service, BASE_LAYOUT);
    service.currentUIElements = [{
      id: 1,
      name: 'Primer chat',
      controlType: 'ListItem',
      boundingRect: { x: 300, y: 200, width: 160, height: 36 },
      isEnabled: true,
      automationId: '',
      value: '',
    }];
    const mouseClickSpy = vi.spyOn(service, 'mouseClick').mockResolvedValue(undefined);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await service.executeAction({ action: 'click', x: 312, y: 214, message: 'abrir chat' });

    expect(mouseClickSpy).toHaveBeenCalledWith(380, 218);
    consoleLogSpy.mockRestore();
  });

  it('CU-143E: executeAction snaps near-padding coordinates back into visible content', async () => {
    const service = await createDesktopAgentService();
    mockSingleDisplay();
    setLayout(service, {
      ...BASE_LAYOUT,
      offsetY: 24,
      virtualBounds: { x: 0, y: 0, width: 1024, height: 720 },
      displayRegions: [{ displayId: '0', bounds: { x: 0, y: 0, width: 1024, height: 720 }, left: 0, top: 24, width: 1024, height: 720 }],
    });
    service.currentUIElements = [];
    const mouseClickSpy = vi.spyOn(service, 'mouseClick').mockResolvedValue(undefined);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await service.executeAction({ action: 'click', x: 240, y: 18, message: 'reentrar a contenido visible' });

    expect(mouseClickSpy).toHaveBeenCalledWith(240, 24);
    consoleLogSpy.mockRestore();
  });
});
