import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const requireScript = createRequire(import.meta.url);
const supportPath = resolve('scripts/python-runtime-support.cjs');
const childProcess = requireScript('node:child_process') as typeof import('node:child_process');
const filesystem = requireScript('node:fs') as typeof import('node:fs');

function loadSupport() {
  delete requireScript.cache[supportPath];
  return requireScript(supportPath);
}

afterEach(() => {
  vi.restoreAllMocks();
  delete requireScript.cache[supportPath];
});

describe('fuente e integridad del runtime Python privado', () => {
  it.each([
    ['win32', 'x64', 'x86_64-pc-windows-msvc'],
    ['darwin', 'x64', 'x86_64-apple-darwin'],
    ['darwin', 'arm64', 'aarch64-apple-darwin'],
    ['linux', 'x64', 'x86_64-unknown-linux-gnu'],
    ['linux', 'arm64', 'aarch64-unknown-linux-gnu'],
  ])('fija fuente oficial y SHA256 para %s/%s', (platform, arch, target) => {
    const { archiveSpec, PYTHON_VERSION, RELEASE } = loadSupport();
    const spec = archiveSpec(platform, arch);
    expect(spec.url).toBe(`https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE}/cpython-${PYTHON_VERSION}+${RELEASE}-${target}-install_only_stripped.tar.gz`);
    expect(spec.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([['win32', 'arm64'], ['linux', 'ia32'], ['desconocido', 'x64']])('rechaza plataforma no fijada %s/%s', (platform, arch) => {
    expect(() => loadSupport().archiveSpec(platform, arch)).toThrow('Plataforma Python no soportada');
  });

  it('exige una huella explícita incluso si el espejo usa HTTPS', () => {
    expect(() => loadSupport().archiveSpec('win32', 'x64', { PYTHON_RUNTIME_URL: 'https://example.test/python.tar.gz' })).toThrow('requiere SHA256 explícito');
  });

  it.each(['http://example.test/python.tar.gz', 'file:///python.tar.gz', 'https://usuario:clave@example.test/python.tar.gz'])('rechaza fuente insegura %s', url => {
    expect(() => loadSupport().archiveSpec('win32', 'x64', { PYTHON_RUNTIME_URL: url, PYTHON_RUNTIME_SHA256: 'a'.repeat(64) })).toThrow('HTTPS sin credenciales');
  });

  it.each(['abc', 'g'.repeat(64), `${'a'.repeat(64)} `])('rechaza huella malformada %s', sha256 => {
    expect(() => loadSupport().archiveSpec('win32', 'x64', { PYTHON_RUNTIME_SHA256: sha256 })).toThrow('SHA256 Python inválido');
  });

  it('normaliza la huella explícita de un espejo autorizado', () => {
    expect(loadSupport().archiveSpec('win32', 'x64', {
      PYTHON_RUNTIME_URL: 'https://example.test/python.tar.gz', PYTHON_RUNTIME_SHA256: 'A'.repeat(64),
    })).toEqual({ url: 'https://example.test/python.tar.gz', sha256: 'a'.repeat(64) });
  });

  it('calcula SHA256 sobre los bytes del archivo', () => {
    const support = loadSupport();
    const read = vi.spyOn(filesystem, 'readFileSync').mockReturnValue(Buffer.from('abc'));
    expect(support.sha256File('archivo-de-prueba')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(read).toHaveBeenCalledWith('archivo-de-prueba');
  });
});

describe('aislamiento de ejecución y comprobación del runtime', () => {
  it.each([
    ['win32', ['python.exe']], ['linux', ['bin', 'python3']], ['darwin', ['bin', 'python3']],
  ])('resuelve el ejecutable privado para %s', (platform, segments) => {
    expect(loadSupport().pythonExecutable('runtime', platform)).toBe(join('runtime', ...segments));
  });

  it('no propaga credenciales, configuración pip, hooks Python ni bibliotecas externas', () => {
    const source = {
      SystemRoot: 'Windows', PATH: 'binarios', HOME: 'usuario', TEMP: 'temporal',
      PYTHONPATH: 'externo', PYTHONHOME: 'externo', PIP_INDEX_URL: 'https://usuario:clave@example.test',
      PIP_CONFIG_FILE: 'externo', LD_LIBRARY_PATH: 'externo', VITE_SECRET: 'secreto', GH_TOKEN: 'secreto',
      NODE_OPTIONS: '--require externo', ELECTRON_RUN_AS_NODE: '1',
    };
    const { runtimeEnvironment } = loadSupport();
    expect(runtimeEnvironment('runtime', 'win32', source)).toEqual({ SystemRoot: 'Windows', PATH: 'binarios', HOME: 'usuario', TEMP: 'temporal' });
    expect(runtimeEnvironment('runtime', 'linux', source)).toEqual({ SystemRoot: 'Windows', PATH: 'binarios', HOME: 'usuario', TEMP: 'temporal', LD_LIBRARY_PATH: join('runtime', 'lib') });
    expect(source.LD_LIBRARY_PATH).toBe('externo');
  });

  it('ejecuta pip check e imports de voz y documentos sin shell, con aislamiento y timeout', () => {
    const execute = vi.spyOn(childProcess, 'execFileSync').mockReturnValue('python-bundle-ok\n');
    const support = loadSupport();
    support.validateRuntime('runtime', 'win32');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0]).toEqual([
      join('runtime', 'python.exe'), ['-I', '-m', 'pip', '--isolated', 'check'],
      expect.objectContaining({ encoding: 'utf8', windowsHide: true, timeout: 120000 }),
    ]);
    const command = execute.mock.calls[1][1] as string[];
    expect(command.slice(0, 2)).toEqual(['-I', '-c']);
    for (const dependency of ['vosk', 'sounddevice', 'faster_whisper', 'sherpa_onnx', 'pdfplumber', 'openpyxl', 'pptx', 'docx']) {
      expect(command[2]).toContain(dependency);
    }
    expect(command[2]).toContain(`sys.version_info[:3] == (${support.PYTHON_VERSION.split('.').join(', ')})`);
    expect(execute.mock.calls[1][2]).not.toHaveProperty('shell');
    expect(execute.mock.calls[1][2]?.env).not.toHaveProperty('VITE_GEMINI_API_KEY');
  });

  it('detiene la validación si pip informa dependencias incompatibles', () => {
    const failure = new Error('pip check falló');
    const execute = vi.spyOn(childProcess, 'execFileSync').mockImplementation(() => { throw failure; });
    expect(() => loadSupport().validateRuntime('runtime', 'win32')).toThrow(failure);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('propaga un import fallido y no anuncia éxito', () => {
    const execute = vi.spyOn(childProcess, 'execFileSync').mockReturnValueOnce('ok').mockImplementationOnce(() => { throw new Error('ImportError'); });
    expect(() => loadSupport().validateRuntime('runtime', 'win32')).toThrow('ImportError');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it.each(['', 'python-bundle-ok resultado-extra', 'aviso\npython-bundle-ok'])('no acepta una señal de éxito parcial: %s', output => {
    vi.spyOn(childProcess, 'execFileSync').mockReturnValueOnce('ok').mockReturnValueOnce(output);
    expect(() => loadSupport().validateRuntime('runtime', 'win32')).toThrow('no superó la comprobación');
  });
});

describe('identidad y promoción recuperable del runtime', () => {
  function currentLock() {
    const { archiveSpec, PYTHON_VERSION, RELEASE } = loadSupport();
    const spec = archiveSpec('win32', 'x64');
    return { spec, lock: { schema: 2, pythonVersion: PYTHON_VERSION, release: RELEASE, platform: 'win32', arch: 'x64', archiveUrl: spec.url, archiveSha256: spec.sha256, requirementsSha256: 'requisitos' } };
  }

  it('reutiliza sólo un lock actual con la fuente y ambos requisitos iguales', () => {
    const { spec, lock } = currentLock();
    expect(loadSupport().isCurrentLock(lock, spec, 'requisitos', 'win32', 'x64')).toBe(true);
  });

  it.each(['schema', 'pythonVersion', 'release', 'platform', 'arch', 'archiveUrl', 'archiveSha256', 'requirementsSha256'])('invalida la caché si cambia %s', field => {
    const { spec, lock } = currentLock();
    expect(loadSupport().isCurrentLock({ ...lock, [field]: 'obsoleto' }, spec, 'requisitos', 'win32', 'x64')).toBe(false);
  });

  it.each([null, undefined, {}, { schema: 1 }])('rechaza un lock ausente o anterior: %j', lock => {
    const { spec } = currentLock();
    expect(loadSupport().isCurrentLock(lock, spec, 'requisitos', 'win32', 'x64')).toBe(false);
  });

  function promotionIo(existing: string[], symbolic = false) {
    const entries = new Set(existing);
    return {
      entries,
      existsSync: vi.fn((file: string) => entries.has(file)),
      lstatSync: vi.fn(() => ({ isSymbolicLink: () => symbolic })),
      renameSync: vi.fn((from: string, to: string) => {
        if (!entries.has(from)) throw new Error('Origen ausente');
        entries.delete(from);
        entries.add(to);
      }),
    };
  }

  it('promociona una instalación nueva sin inventar respaldo', () => {
    const io = promotionIo(['preparado']);
    expect(loadSupport().promoteRuntime('preparado', 'activo', 'anterior', io)).toBeNull();
    expect([...io.entries]).toEqual(['activo']);
    expect(io.renameSync).toHaveBeenCalledExactlyOnceWith('preparado', 'activo');
  });

  it('conserva el runtime anterior al reemplazarlo por el validado', () => {
    const io = promotionIo(['preparado', 'activo']);
    expect(loadSupport().promoteRuntime('preparado', 'activo', 'anterior', io)).toBe('anterior');
    expect([...io.entries].sort()).toEqual(['activo', 'anterior']);
    expect(io.renameSync.mock.calls).toEqual([['activo', 'anterior'], ['preparado', 'activo']]);
  });

  it('restaura el runtime anterior si falla la promoción', () => {
    const io = promotionIo(['activo']);
    expect(() => loadSupport().promoteRuntime('preparado', 'activo', 'anterior', io)).toThrow('Origen ausente');
    expect([...io.entries]).toEqual(['activo']);
    expect(io.renameSync.mock.calls).toEqual([['activo', 'anterior'], ['preparado', 'activo'], ['anterior', 'activo']]);
  });

  it('rechaza un destino enlazado antes de mover archivos', () => {
    const io = promotionIo(['preparado', 'activo'], true);
    expect(() => loadSupport().promoteRuntime('preparado', 'activo', 'anterior', io)).toThrow('no puede ser un enlace');
    expect(io.renameSync).not.toHaveBeenCalled();
  });

  it('no sobrescribe un respaldo existente', () => {
    const io = promotionIo(['preparado', 'activo', 'anterior']);
    expect(() => loadSupport().promoteRuntime('preparado', 'activo', 'anterior', io)).toThrow('respaldo del runtime ya existe');
    expect(io.renameSync).not.toHaveBeenCalled();
  });
});
