import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ run: vi.fn(), readFile: vi.fn(), readlink: vi.fn() }));
vi.mock('node:child_process', () => ({
  execFile: Object.assign(vi.fn(), {
    [Symbol.for('nodejs.util.promisify.custom')]: async (_file: string, args: string[]) => ({ stdout: mocks.run(args) }),
  }),
}));
vi.mock('node:fs/promises', () => ({ default: { readFile: mocks.readFile, readlink: mocks.readlink } }));
const { focusLinuxApplicationWindow } = await import('../computer-use/app-resolver/linux-window');

beforeEach(() => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
  vi.stubEnv('XDG_SESSION_TYPE', 'x11'); vi.stubEnv('DISPLAY', ':0'); vi.stubEnv('WAYLAND_DISPLAY', '');
  vi.clearAllMocks();
  mocks.readFile.mockResolvedValue('firefox'); mocks.readlink.mockResolvedValue('/usr/lib/firefox/firefox');
  mocks.run.mockImplementation((args: string[]) => ({
    search: '101', getwindowpid: '123', getwindowname: 'Mozilla Firefox', windowactivate: '', getactivewindow: '101',
  })[args[0] as 'search']);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('comprobación de ventana Linux', () => {
  it('activa y comprueba la ventana que pertenece al proceso de Firefox', async () => {
    expect(await focusLinuxApplicationWindow('firefox', '/usr/bin/firefox')).toEqual({ pid: 123, process: 'firefox', title: 'Mozilla Firefox' });
    expect(mocks.run).toHaveBeenCalledWith(['windowactivate', '--sync', '101']);
  });
  it('un chat titulado Firefox no se confunde con Firefox', async () => {
    mocks.readFile.mockResolvedValue('pulse-hub'); mocks.readlink.mockResolvedValue('/opt/pulse-hub');
    expect(await focusLinuxApplicationWindow('firefox', '/usr/bin/firefox')).toBeNull();
    expect(mocks.run).not.toHaveBeenCalledWith(['windowactivate', '--sync', '101']);
  });
  it('no confirma primer plano si el gestor rechaza la activación', async () => {
    mocks.run.mockImplementation((args: string[]) => ({ search: '101', getwindowpid: '123', getwindowname: 'Firefox', windowactivate: '', getactivewindow: '202' })[args[0] as 'search']);
    expect(await focusLinuxApplicationWindow('firefox', '/usr/bin/firefox')).toBeNull();
  });
  it('Wayland nunca consulta xdotool ni inventa evidencia X11', async () => {
    vi.stubEnv('XDG_SESSION_TYPE', 'wayland');
    expect(await focusLinuxApplicationWindow('firefox', '/usr/bin/firefox')).toBeNull();
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('xdotool ausente falla sin afirmar éxito', async () => {
    mocks.run.mockImplementation(() => { throw new Error('ENOENT'); });
    expect(await focusLinuxApplicationWindow('firefox', '/usr/bin/firefox')).toBeNull();
  });
});
