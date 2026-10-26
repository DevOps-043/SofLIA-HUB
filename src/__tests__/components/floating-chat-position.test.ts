import { describe, expect, it } from 'vitest';
import { clampFloatingPosition, floatingBrowserInsets } from '../../components/floating-chat/floating-chat-position';

describe('Posición del chat flotante', () => {
  it('mantiene accesible el panel al arrastrar fuera de los bordes o reducir la ventana', () => {
    expect(clampFloatingPosition({ left: -200, top: 900 }, { width: 380, height: 70 }, { width: 800, height: 600 })).toEqual({ left: 8, top: 522 });
    expect(clampFloatingPosition({ left: 900, top: 700 }, { width: 344, height: 200 }, { width: 360, height: 400 })).toEqual({ left: 8, top: 192 });
  });
  it('conserva la composición inferior inicial', () => {
    expect(floatingBrowserInsets(null, { width: 1200, height: 800 }, 100, 0, 84)).toEqual({ left: 0, right: 0, top: 0, bottom: 84, occluded: false });
  });
  it.each([{ left: 30, top: 150 }, { left: 790, top: 200 }, { left: 400, top: 140 }, { left: 400, top: 650 }])('reserva un rectángulo nativo sin intersección al mover a %o', point => {
    const panel = { ...point, width: 380, height: 100, moved: true }, surface = { width: 1200, height: 800 };
    const insets = floatingBrowserInsets(panel, surface, 100, 0, 84);
    const view = { left: insets.left, right: surface.width - insets.right, top: 100 + insets.top, bottom: surface.height - insets.bottom };
    expect(insets.occluded).toBe(false);
    expect(view.right <= panel.left || view.left >= panel.left + panel.width || view.bottom <= panel.top || view.top >= panel.top + panel.height).toBe(true);
  });
  it('retira temporalmente la vista nativa si el panel no deja una región operable', () => {
    expect(floatingBrowserInsets({ left: 8, top: 150, width: 344, height: 400, moved: true }, { width: 360, height: 600 }, 100, 0, 84).occluded).toBe(true);
  });
});
