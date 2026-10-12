import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), launch: vi.fn(), focus: vi.fn() }));
vi.mock('../computer-use/app-resolver', () => ({
  resolveApplicationTarget: mocks.resolve,
  launchPathNonBlocking: mocks.launch,
  focusExistingApplicationWindow: mocks.focus,
  looksLikeConcreteApplicationPath: () => false,
}));
const { handleOpenPath } = await import('../computer-use/app-open-tool');

beforeEach(() => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
  vi.stubEnv('XDG_SESSION_TYPE', 'wayland');
  mocks.resolve.mockResolvedValue({ path: '/usr/bin/firefox', source: 'linux-path' });
  mocks.launch.mockResolvedValue({ success: true });
  mocks.focus.mockResolvedValue(null);
  vi.clearAllMocks();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('evidencia de apertura', () => {
  it('Wayland informa lanzamiento sin inventar una ventana', async () => {
    expect(await handleOpenPath('open_application', { path: 'firefox' })).toMatchObject({
      success: true, launch_started: true, window_verified: false,
      message: expect.stringContaining('no permite verificar'),
    });
    expect(mocks.launch).toHaveBeenCalledTimes(1);
  });
  it('el fallo del launcher prevalece sobre cualquier confirmación', async () => {
    mocks.launch.mockResolvedValue({ success: false, error: 'Permiso denegado' });
    expect(await handleOpenPath('open_application', { path: 'firefox' })).toMatchObject({ success: false, error: expect.stringContaining('Permiso denegado') });
  });
  it('no lanza si el resolver no encuentra la aplicación', async () => {
    mocks.resolve.mockResolvedValue(null);
    expect(await handleOpenPath('open_application', { path: 'inexistente' })).toMatchObject({ success: false });
    expect(mocks.launch).not.toHaveBeenCalled();
  });
  it('una ventana existente tiene evidencia y no duplica la apertura', async () => {
    mocks.focus.mockResolvedValue({ title: 'Firefox', process: 'firefox', pid: 123 });
    expect(await handleOpenPath('open_application', { path: 'firefox' })).toMatchObject({ success: true, window_verified: true });
    expect(mocks.launch).not.toHaveBeenCalled();
  });
  it('X11 exige una ventana después del lanzamiento', async () => {
    vi.stubEnv('XDG_SESSION_TYPE', 'x11');
    vi.stubEnv('WAYLAND_DISPLAY', '');
    vi.stubEnv('DISPLAY', ':0');
    const result = await handleOpenPath('open_application', { path: 'firefox' });
    expect(result).toMatchObject({ success: false, launch_started: true, window_verified: false });
  });
});
