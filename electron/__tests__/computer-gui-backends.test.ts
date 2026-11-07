import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import { exec, spawn } from 'node:child_process';
import { performGuiAction } from '../computer-use/gui-action';
import { guiProcessFixture } from './helpers/gui-process.fixture';
import { buildGuiCommand } from '../computer-use/gui/backends';
import { parseGuiInput, parseGuiKeys, windowsLiteralText } from '../computer-use/gui/input';
vi.mock('node:child_process', () => ({
  exec: vi.fn((_command: string, callback: (error: null, out: string) => void) => callback(null, '')),
  spawn: vi.fn(),
}));
beforeEach(() => {
  vi.stubEnv('DISPLAY', ':ficticio'); vi.stubEnv('XDG_SESSION_TYPE', 'x11'); vi.stubEnv('WAYLAND_DISPLAY', '');
  vi.mocked(spawn).mockImplementation(() => { const fake = guiProcessFixture(); queueMicrotask(() => fake.close()); return fake.child as unknown as ReturnType<typeof spawn>; });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('Backend GUI sin interpretación del usuario', () => {
  it('texto hostil no atraviesa shell', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('linux');
    await performGuiAction('type', undefined, '$(comando-ficticio) " ; ^%{}');
    expect(exec).not.toHaveBeenCalled();
  });
  it('tecla malformada se rechaza antes del proceso', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('linux');
    await expect(performGuiAction('key', undefined, 'Return; comando-ficticio')).rejects.toThrow();
    expect(exec).not.toHaveBeenCalled();
  });
  it('coordenada no finita nunca se convierte en script', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('win32');
    await expect(performGuiAction('left_click', [NaN, 2])).rejects.toThrow();
    expect(exec).not.toHaveBeenCalled();
  });
  it.each(['win32', 'darwin', 'linux'] as const)('texto hostil queda en datos, código fijo y sin shell: %s', async platform => {
    vi.spyOn(os, 'platform').mockReturnValue(platform);
    const text = '$(comando-ficticio) ` ; " \' +^%~(){}[]\n日本語';
    const fake = guiProcessFixture(); vi.mocked(spawn).mockImplementationOnce(() => { queueMicrotask(() => fake.close()); return fake.child as unknown as ReturnType<typeof spawn>; });
    await performGuiAction('type', undefined, text);
    const [file, args, options] = vi.mocked(spawn).mock.calls[0];
    expect(options).toMatchObject({ shell: false, windowsHide: true }); expect(exec).not.toHaveBeenCalled();
    expect(args?.[1]).not.toContain(text);
    if (platform === 'win32') expect(JSON.parse(Buffer.from(fake.input(), 'base64').toString()).text).toBe(windowsLiteralText(text));
    if (platform === 'linux') { expect(file).toBe('xdotool'); expect(fake.input()).toBe(text); expect(args).toContain('--file'); }
    if (platform === 'darwin') { expect(args?.slice(-1)[0]).toBe(text); expect(args?.[1]).toContain('on run argv'); }
  });
  it.each(['win32', 'darwin', 'linux'] as const)('conserva todas las primitivas de mouse: %s', platform => {
    for (const action of ['mouse_move', 'left_click', 'left_click_drag', 'right_click', 'middle_click', 'double_click']) {
      const command = buildGuiCommand(parseGuiInput({ action, coordinate: [-30, 45] }), platform);
      expect(command.file).toBeTruthy(); expect(command.args).not.toContain('shell');
      if (platform === 'win32' || platform === 'darwin') expect(JSON.parse(Buffer.from(command.input!, 'base64').toString())).toMatchObject({ action, x: -30, y: 45 });
      else { expect(command.args).toContain('-30'); expect(command.args).toContain('45'); }
    }
  });
  it('Windows recibe 20000 caracteres por stdin sin inflar línea de comando', () => {
    const command = buildGuiCommand(parseGuiInput({ action: 'type', text: '{'.repeat(20000) }), 'win32');
    expect(command.args.join(' ').length).toBeLessThan(16000); expect(command.input!.length).toBeGreaterThan(60000);
    expect(windowsLiteralText('+^%~(){}[]')).toBe('{+}{^}{%}{~}{(}{)}{{}{}}{[}{]}');
  });
  it.each(['ctrl+c', '^c', 'ctrl+shift+n', '^+n', '%{F4}', '{ENTER}', 'Control_L+a', 'command+c', 'F24'])('normaliza tecla conocida %s', key => {
    expect(parseGuiKeys(key).length).toBeGreaterThan(0);
  });
  it.each(['x;comando', '$(x)', 'ctrl+ctrl+c', 'ctrl+alt', '{ENTER 500}', 'a+b', '', '\0', 'ctrl+'])('rechaza combinación no declarada %s', key => {
    expect(() => parseGuiKeys(key)).toThrow();
  });
  it('traduce códigos/aliases por SO y rechaza tecla macOS no disponible', () => {
    const input = parseGuiInput({ action: 'key', text: 'ctrl+Left' });
    expect(buildGuiCommand(input, 'linux').args.slice(-1)[0]).toBe('Control_L+Left');
    expect(buildGuiCommand(input, 'darwin').args.slice(-3)).toEqual(['code', '123', 'ctrl']);
    expect(JSON.parse(Buffer.from(buildGuiCommand(input, 'win32').input!, 'base64').toString()).keys).toEqual([17, 37]);
    expect(() => buildGuiCommand(parseGuiInput({ action: 'key', text: 'F24' }), 'darwin')).toThrow();
  });
  it('Wayland, headless y plataformas ajenas no ejecutan una alternativa', () => {
    const input = parseGuiInput({ action: 'left_click', coordinate: [10, 20] });
    vi.stubEnv('WAYLAND_DISPLAY', 'ficticio'); expect(() => buildGuiCommand(input, 'linux')).toThrow();
    vi.stubEnv('WAYLAND_DISPLAY', ''); vi.stubEnv('DISPLAY', ''); expect(() => buildGuiCommand(input, 'linux')).toThrow();
    expect(() => buildGuiCommand(input, 'freebsd')).toThrow();
  });
});
