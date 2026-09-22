import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const requireScript = createRequire(import.meta.url);
const hookPath = resolve('scripts/verify-packaged-python.cjs');
const supportPath = resolve('scripts/python-runtime-support.cjs');
const filesystem = requireScript('node:fs') as typeof import('node:fs');
const childProcess = requireScript('node:child_process') as typeof import('node:child_process');

function context(platform = 'win32') {
  return { electronPlatformName: platform, appOutDir: join('paquete', 'Pulse Hub'), packager: { appInfo: { productFilename: 'Pulse Hub' } } };
}

function loadHook() {
  delete requireScript.cache[hookPath];
  delete requireScript.cache[supportPath];
  return requireScript(hookPath);
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete requireScript.cache[hookPath];
  delete requireScript.cache[supportPath];
});

function completePackage() {
  const exists = vi.spyOn(filesystem, 'existsSync').mockReturnValue(true);
  const stat = vi.spyOn(filesystem, 'statSync').mockReturnValue({ isFile: () => true, size: 1 } as import('node:fs').Stats);
  const execute = vi.spyOn(childProcess, 'execFileSync').mockReturnValue('python-bundle-ok\n');
  return { exists, stat, execute };
}

describe('compuerta Python del instalador', () => {
  it.each(['win32', 'linux', 'darwin'])('comprueba el runtime y ambos sidecars en la estructura %s', async platform => {
    const { exists, execute } = completePackage();
    const verify = loadHook();
    const build = context(platform);
    const resources = platform === 'darwin'
      ? join(build.appOutDir, 'Pulse Hub.app', 'Contents', 'Resources')
      : join(build.appOutDir, 'resources');
    const executable = join(resources, 'python', ...(platform === 'win32' ? ['python.exe'] : ['bin', 'python3']));
    await expect(verify(build)).resolves.toBeUndefined();
    expect(exists.mock.calls).toEqual([[executable], [join(resources, 'python-sidecar', 'main.py')], [join(resources, 'python-tools', 'main.py')]]);
    expect(execute.mock.calls.map(call => call[0])).toEqual([executable, executable]);
    expect(execute.mock.calls[0][1]).toEqual(['-I', '-m', 'pip', '--isolated', 'check']);
    expect(execute.mock.calls[1][2]?.env).not.toHaveProperty('VITE_GEMINI_API_KEY');
    if (platform === 'linux') expect(execute.mock.calls[1][2]?.env?.LD_LIBRARY_PATH).toBe(join(resources, 'python', 'lib'));
    expect(console.log).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('ambos sidecars verificados'));
  });

  it.each(['python.exe', join('python-sidecar', 'main.py'), join('python-tools', 'main.py')])('bloquea el empaquetado si falta %s', async missing => {
    const { exists, execute } = completePackage();
    exists.mockImplementation(file => !String(file).endsWith(missing));
    await expect(loadHook()(context())).rejects.toThrow('Recurso Python ausente o incompleto');
    expect(execute).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it.each([
    ['directorio en lugar de archivo', { isFile: () => false, size: 100 }],
    ['archivo vacío', { isFile: () => true, size: 0 }],
  ])('rechaza un recurso incompleto: %s', async (_label, info) => {
    const { stat, execute } = completePackage();
    stat.mockReturnValue(info as import('node:fs').Stats);
    await expect(loadHook()(context())).rejects.toThrow('Recurso Python ausente o incompleto');
    expect(execute).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it('propaga un fallo de permisos sin anunciar éxito ni ejecutar Python', async () => {
    const { stat, execute } = completePackage();
    stat.mockImplementation(() => { throw new Error('EACCES'); });
    await expect(loadHook()(context())).rejects.toThrow('EACCES');
    expect(execute).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it('bloquea el empaquetado si pip check falla', async () => {
    const { execute } = completePackage();
    execute.mockImplementationOnce(() => { throw new Error('Dependencias incompatibles'); });
    await expect(loadHook()(context())).rejects.toThrow('Dependencias incompatibles');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('bloquea el empaquetado si falta una dependencia de documentos', async () => {
    const { execute } = completePackage();
    execute.mockReturnValueOnce('ok').mockImplementationOnce(() => { throw new Error('No module named docx'); });
    await expect(loadHook()(context())).rejects.toThrow('No module named docx');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('no acepta un stdout que sólo contiene la marca de éxito como subcadena', async () => {
    const { execute } = completePackage();
    execute.mockReturnValueOnce('ok').mockReturnValueOnce('python-bundle-ok pero incompleto');
    await expect(loadHook()(context())).rejects.toThrow('no superó la comprobación');
    expect(console.log).not.toHaveBeenCalled();
  });
});
