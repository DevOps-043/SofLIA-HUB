import { describe, expect, it, vi } from 'vitest';
import { createInputDriver } from '../desktop-agent/input-driver';

function fakeControls() {
  return {
    mouse: {
      clickAtPhysicalPoint: vi.fn(async () => {}),
      rightClickAtPhysicalPoint: vi.fn(async () => {}),
      doubleClickAtPhysicalPoint: vi.fn(async () => {}),
      mouseMoveToPhysicalPoint: vi.fn(async () => {}),
      dragBetweenPhysicalPoints: vi.fn(async () => {}),
      mouseScroll: vi.fn(async () => {}),
    } as any,
    keyboard: {
      keyboardType: vi.fn(async () => {}),
      keyboardKey: vi.fn(async () => {}),
      keyboardHotkey: vi.fn(async () => {}),
    } as any,
  };
}

describe('createInputDriver: seleccion de backend', () => {
  it('ID-001: backend legacy usa los controles PowerShell existentes', async () => {
    const { mouse, keyboard } = fakeControls();
    const driver = createInputDriver({ backend: 'legacy', mouse, keyboard });

    expect(driver.capacidades()).toMatchObject({ backend: 'legacy', movimientoHumano: false });
    await driver.click({ x: 10, y: 20 });
    expect(mouse.clickAtPhysicalPoint).toHaveBeenCalledWith(10, 20);
    await driver.typeText('hola');
    expect(keyboard.keyboardType).toHaveBeenCalledWith('hola');
  });

  it('ID-002: pide nut pero no carga => cae a legacy sin romper', async () => {
    const { mouse, keyboard } = fakeControls();
    const driver = createInputDriver({ backend: 'nut', mouse, keyboard, loadNut: () => null });

    expect(driver.capacidades().backend).toBe('legacy');
    await driver.doubleClick({ x: 5, y: 6 });
    expect(mouse.doubleClickAtPhysicalPoint).toHaveBeenCalledWith(5, 6);
  });

  it('ID-003: con nut disponible usa el backend nativo con movimiento humano', async () => {
    const { mouse, keyboard } = fakeControls();
    const setPosition = vi.fn(async () => {});
    const clickFn = vi.fn(async () => {});
    const fakeNut = {
      mouse: { config: {}, setPosition, click: clickFn, getPosition: async () => ({ x: 0, y: 0 }) },
      keyboard: { config: {}, type: vi.fn(async () => {}), pressKey: vi.fn(async () => {}), releaseKey: vi.fn(async () => {}) },
      Point: class { constructor(public x: number, public y: number) {} },
      Button: { LEFT: 'L', RIGHT: 'R', MIDDLE: 'M' },
      Key: { Enter: 'Enter' },
      straightTo: vi.fn(),
    };
    const driver = createInputDriver({ backend: 'nut', mouse, keyboard, loadNut: () => fakeNut });

    expect(driver.capacidades()).toMatchObject({ backend: 'nut', movimientoHumano: true });
    await driver.click({ x: 300, y: 400 });
    // Movimiento humano: varios setPosition (trayectoria) y un click nativo.
    expect(setPosition.mock.calls.length).toBeGreaterThan(1);
    expect(clickFn).toHaveBeenCalledWith('L');
    // No toca los controles legacy.
    expect(mouse.clickAtPhysicalPoint).not.toHaveBeenCalled();
  });
});
