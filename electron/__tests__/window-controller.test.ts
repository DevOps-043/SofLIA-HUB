import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { createOrFocusMainWindow } from '../main/window-controller';

function baseInput(showWindow: boolean) {
  return {
    currentWindow: null,
    showWindow,
    isQuitting: () => false,
    preloadPath: '/preload.js',
    iconPath: '/icono.ico',
    rendererUrl: 'http://localhost:5173',
    rendererDist: '/dist',
    onClosed: () => {},
  };
}

describe('createOrFocusMainWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('no muestra la ventana hasta ready-to-show y luego la revela una vez', () => {
    const win = createOrFocusMainWindow(baseInput(true)) as unknown as BrowserWindow;
    expect(win.show).not.toHaveBeenCalled();

    win.emit('ready-to-show');
    expect(win.show).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);

    // El fallback no debe volver a mostrarla.
    vi.advanceTimersByTime(10000);
    expect(win.show).toHaveBeenCalledTimes(1);
  });

  it('muestra la ventana por fallback si ready-to-show nunca dispara', () => {
    const win = createOrFocusMainWindow(baseInput(true)) as unknown as BrowserWindow;
    expect(win.show).not.toHaveBeenCalled();

    vi.advanceTimersByTime(4000);
    expect(win.show).toHaveBeenCalledTimes(1);
  });

  it('en modo background (showWindow=false) no revela la ventana', () => {
    const win = createOrFocusMainWindow(baseInput(false)) as unknown as BrowserWindow;

    win.emit('ready-to-show');
    vi.advanceTimersByTime(10000);
    expect(win.show).not.toHaveBeenCalled();
    expect(win.focus).not.toHaveBeenCalled();
  });

  it('reutiliza la ventana existente y la enfoca de inmediato', () => {
    const existing = new BrowserWindow();
    const input = { ...baseInput(true), currentWindow: existing as unknown as null };

    const win = createOrFocusMainWindow(input);

    expect(win).toBe(existing);
    expect(existing.show).toHaveBeenCalledTimes(1);
    expect(existing.focus).toHaveBeenCalledTimes(1);
  });
});
