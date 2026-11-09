import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopKeyboardControls } from '../desktop-agent/keyboard-controls';
import { desktopKeys } from '../../src/shared/desktop-keys';
import { execFile } from 'node:child_process';
import { clipboard } from 'electron';
import type { InputDriver } from '../desktop-agent/input-driver/types';
vi.mock('node:child_process', () => ({ execFile: vi.fn((_file, _args, _options, callback) => { callback(null, '', ''); }) }));
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
beforeEach(() => Object.defineProperty(process, 'platform', { value: 'win32', configurable: true }));
afterEach(() => { Object.defineProperty(process, 'platform', originalPlatform); vi.restoreAllMocks(); });
describe('Teclado Desktop con tokens declarados', () => {
  it('fragmento arbitrario nunca llega a PowerShell', async () => {
    const ps = vi.fn(async () => ''); const keyboard = new DesktopKeyboardControls(ps, async () => {});
    await expect(keyboard.keyboardKey("'); comando-ficticio; '")).rejects.toThrow();
    expect(ps).not.toHaveBeenCalled();
  });
  it.each(['ctrl+c', 'ctrl++', '+', '^c', '^+n', '%{F4}', '{ENTER}', 'super+r', 'Control_L+a', 'F24'])('conserva tecla/acorde válido %s', async key => {
    const ps = vi.fn(async () => ''); const keyboard = new DesktopKeyboardControls(ps, async () => {});
    await keyboard.keyboardKey(key); expect(ps).toHaveBeenCalledOnce(); expect(ps.mock.calls[0]?.length).toBe(1);
  });
  it.each(['a+b', 'ctrl+ctrl+c', 'ctrl+alt', 'ctrl+', '$(comando)', '{ENTER 50}', "';script", ''])('rechaza antes de driver y proceso: %s', async key => {
    const ps = vi.fn(), pressKeys = vi.fn(); const keyboard = new DesktopKeyboardControls(ps, async () => {});
    keyboard.setInputDriver({ pressKeys } as unknown as InputDriver);
    await expect(keyboard.keyboardKey(key)).rejects.toThrow(); expect(pressKeys).not.toHaveBeenCalled(); expect(ps).not.toHaveBeenCalled();
  });
  it('driver sólo recibe tokens canónicos; hotkey no admite fragmentos', async () => {
    const pressKeys = vi.fn(async () => {}), keyboard = new DesktopKeyboardControls(vi.fn(), async () => {});
    keyboard.setInputDriver({ pressKeys } as unknown as InputDriver); await keyboard.keyboardKey('super+r');
    expect(pressKeys).toHaveBeenCalledWith(['meta', 'r']); await expect(keyboard.keyboardHotkey('ctrl', "';x")).rejects.toThrow();
    expect(desktopKeys('ctrl++')).toEqual(['ctrl', '+']);
  });
  it('Linux conserva texto con prefijo de opción como dato tras --', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    vi.stubEnv('DISPLAY', ':ficticio'); vi.stubEnv('WAYLAND_DISPLAY', ''); vi.stubEnv('XDG_SESSION_TYPE', 'x11');
    try { const keyboard = new DesktopKeyboardControls(vi.fn(), async () => {}); await keyboard.keyboardType('--file /ruta-ficticia'); expect(execFile).toHaveBeenCalledWith('xdotool', ['type', '--clearmodifiers', '--', '--file /ruta-ficticia'], expect.any(Object), expect.any(Function)); }
    finally { vi.unstubAllEnvs(); }
  });
  it('clipboard no sobrescribe un cambio ajeno durante espera', async () => {
    let value = 'anterior'; vi.spyOn(clipboard, 'readText').mockImplementation(async () => value);
    const write = vi.spyOn(clipboard, 'writeText').mockImplementation(async next => { value = next; });
    const keyboard = new DesktopKeyboardControls(async () => { value = 'cambio-ajeno'; return ''; }, async () => {});
    await keyboard.keyboardType('nuevo'); expect(write).toHaveBeenCalledTimes(1); expect(value).toBe('cambio-ajeno');
  });
});
