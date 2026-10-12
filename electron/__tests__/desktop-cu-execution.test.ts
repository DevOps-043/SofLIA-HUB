import { describe, expect, it, vi } from 'vitest';
import { ejecutarAccionDesktop } from '../desktop-agent/gemini-cu/desktop-driver';
import { mapCuFunctionCall } from '../desktop-agent/gemini-cu/action-mapping';
import { buildWindowsHotkey } from '../desktop-agent/windows-hotkey';
import { DesktopKeyboardControls } from '../desktop-agent/keyboard-controls';
import type { DesktopActionPayload } from '../desktop-agent-types';

describe('acciones físicas de Computer Use', () => {
  it('escritura dirigida enfoca el punto antes de escribir', async () => {
    const executeAction = vi.fn(async (action: DesktopActionPayload) => { void action; });
    const mapped = mapCuFunctionCall({ name: 'type_text_at', args: { x: 250, y: 500, text: 'Prueba del orbe', press_enter: false } }, 800, 600);
    await ejecutarAccionDesktop({ executeAction, delay: vi.fn(), takeScreenshot: vi.fn(), getScreenshotSize: () => ({ width: 800, height: 600 }) }, mapped.action, 'Escribir');
    expect(executeAction.mock.calls.map(call => call[0])).toEqual([
      { action: 'click', x: 200, y: 300, message: 'Escribir' },
      { action: 'type', text: 'Prueba del orbe', message: 'Escribir' },
    ]);
  });
  it('una acción desconocida y una navegación imposible no se ignoran', async () => {
    const deps = { executeAction: vi.fn(), delay: vi.fn(), takeScreenshot: vi.fn(), getScreenshotSize: () => ({ width: 1, height: 1 }) };
    await expect(ejecutarAccionDesktop(deps, { tipo: 'desconocida', nombre: 'error', args: {} }, '')).rejects.toThrow('no está soportada');
    await expect(ejecutarAccionDesktop(deps, { tipo: 'go_back' }, '')).rejects.toThrow('no está disponible');
  });
  it('el atajo Super+R usa la tecla Windows real y libera modificadores', async () => {
    if (process.platform !== 'win32') return;
    const ps = vi.fn(async (script: string) => { void script; return ''; });
    const keyboard = new DesktopKeyboardControls(ps, vi.fn());
    await keyboard.keyboardKey('super+r');
    const script = ps.mock.calls[0]?.[0];
    expect(script).toContain('keybd_event(91'); expect(script).toContain('finally');
    expect(() => buildWindowsHotkey(['win', 'desconocida'])).toThrow('no soportada');
  });
});
