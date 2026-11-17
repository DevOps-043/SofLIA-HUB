import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from 'electron';
import { preparePrivatePython } from '../python/automatic-setup';

const { execute, signed } = vi.hoisted(() => ({ execute: vi.fn(), signed: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: execute }));
vi.mock('../python/signed-engine', () => ({ ensureSignedVoiceEngine: signed }));
const resourcesDescriptor = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllEnvs(); execute.mockReset(); signed.mockReset();
  Object.defineProperty(app, 'isPackaged', { configurable: true, value: false });
  if (resourcesDescriptor) Object.defineProperty(process, 'resourcesPath', resourcesDescriptor);
  else Reflect.deleteProperty(process, 'resourcesPath');
});

describe('Lanzamiento del preparador privado', () => {
  it('invoca sólo el script fijo, sin shell y sin heredar hooks o credenciales', async () => {
    vi.stubEnv('NODE_OPTIONS', '--require archivo-ajeno'); vi.stubEnv('GH_TOKEN', 'dato-ficticio');
    execute.mockImplementation((_exe, _args, _options, done) => done(null, '', ''));
    await preparePrivatePython();
    const [executable, args, options] = execute.mock.calls[0];
    expect(executable).toBe(process.execPath);
    expect(args).toEqual([path.join(app.getAppPath(), 'scripts/setup-python-runtime.js')]);
    expect(options.shell).toBeUndefined(); expect(options.windowsHide).toBe(true);
    expect(options.env).toMatchObject({ ELECTRON_RUN_AS_NODE: '1', SOFLIA_PYTHON_RUNTIME_DIRECTORY: path.join(app.getAppPath(), 'python-runtime') });
    expect(options.env).not.toHaveProperty('NODE_OPTIONS'); expect(options.env).not.toHaveProperty('GH_TOKEN');
  });
  it('la reparación empaquetada escribe en el perfil, sin alterar resources', async () => {
    Object.defineProperty(app, 'isPackaged', { configurable: true, value: true });
    Object.defineProperty(process, 'resourcesPath', { configurable: true, value: path.resolve('recursos-ficticios') });
    execute.mockImplementation((_exe, _args, _options, done) => done(null, '', ''));
    signed.mockResolvedValue('motor-firmado');
    await preparePrivatePython();
    if (process.platform === 'win32') {
      expect(signed).toHaveBeenCalledOnce();
      expect(execute).not.toHaveBeenCalled();
      return;
    }
    const [, args, options] = execute.mock.calls[0];
    expect(args).toEqual([path.join(process.resourcesPath, 'python-setup/scripts/setup-python-runtime.js')]);
    expect(options.env.SOFLIA_PYTHON_RUNTIME_DIRECTORY).toBe(path.join(app.getPath('userData'), 'python-runtime'));
  });
  it.runIf(process.platform === 'win32')('una firma no confiable no deriva a instalación sin firma', async () => {
    Object.defineProperty(app, 'isPackaged', { configurable: true, value: true });
    signed.mockRejectedValue(new Error('voice_engine_untrusted'));
    await expect(preparePrivatePython()).rejects.toThrow('voice_engine_untrusted');
    expect(execute).not.toHaveBeenCalled();
  });
  it.each([
    ['ImportError: Una directiva de Control de aplicaciones bloqueó este archivo. C:/privado', 'voice_runtime_blocked'],
    ['Error de red con ruta C:/privado', 'voice_setup_failed'],
  ])('clasifica el fallo sin filtrar stderr: %s', async (stderr, code) => {
    execute.mockImplementation((_exe, _args, _options, done) => done(new Error('detalle privado'), '', stderr));
    await expect(preparePrivatePython()).rejects.toThrow(code);
  });
});
