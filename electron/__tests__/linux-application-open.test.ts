import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

vi.mock('../background-process-service', () => ({ backgroundProcessService: {} }));
const { resolveApplicationTarget } = await import('../computer-use/app-resolver/resolver');
const { launchPathNonBlocking } = await import('../computer-use/app-resolver/launcher');

let root: string;
beforeEach(async () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-app-test-'));
  await fs.mkdir(path.join(root, 'applications'));
  vi.stubEnv('XDG_DATA_HOME', root);
  vi.stubEnv('XDG_DATA_DIRS', root);
  vi.stubEnv('PATH', root);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.rm(root, { recursive: true, force: true });
});

describe('apertura de aplicaciones Linux', () => {
  it('resuelve un nombre instalado por su entrada desktop sin interpretar Exec', async () => {
    const target = path.join(root, 'applications', 'prueba.desktop');
    await fs.writeFile(target, '[Desktop Entry]\nType=Application\nName=App de Prueba\nExec=/ruta/con argumentos %u\n');
    expect(await resolveApplicationTarget('App de Prueba')).toMatchObject({ path: target, source: 'linux-desktop' });
  });
  it('ignora las entradas ocultas y los nombres parciales', async () => {
    await fs.writeFile(path.join(root, 'applications', 'prueba.desktop'), '[Desktop Entry]\nType=Application\nName=Prueba especial\nHidden=true\n');
    expect(await resolveApplicationTarget('Prueba especial')).toBeNull();
    expect(await resolveApplicationTarget('Prueba')).toBeNull();
  });
  // Estos casos requieren permisos POSIX y ejecución real de /bin/sh.
  // Simular process.platform no convierte el host Windows en Linux.
  it.skipIf(process.platform !== 'linux')('resuelve sólo archivos ejecutables de PATH, sin ejecutar el nombre como shell', async () => {
    const target = path.join(root, 'app-prueba');
    await fs.writeFile(target, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    expect(await resolveApplicationTarget('app-prueba')).toMatchObject({ path: target, source: 'linux-path' });
    expect(await resolveApplicationTarget('app-prueba; touch marcador')).toBeNull();
    await fs.chmod(target, 0o644);
    expect(await resolveApplicationTarget('app-prueba')).toBeNull();
  });
  it.skipIf(process.platform !== 'linux')('lanza el ejecutable real en vez de tratarlo como documento', async () => {
    const marker = path.join(root, 'lanzado');
    const target = path.join(root, 'app con espacios');
    await fs.writeFile(target, `#!/bin/sh\nprintf abierto > '${marker}'\n`, { mode: 0o755 });
    expect(await launchPathNonBlocking(target)).toEqual({ success: true });
    expect(await fs.readFile(marker, 'utf8')).toBe('abierto');
  });
  it.skipIf(process.platform !== 'linux')('propaga fallo temprano y ejecutable inexistente', async () => {
    const target = path.join(root, 'app-fallida');
    await fs.writeFile(target, '#!/bin/sh\nexit 7\n', { mode: 0o755 });
    expect(await launchPathNonBlocking(target)).toMatchObject({ success: false, error: expect.stringContaining('código 7') });
    expect(await launchPathNonBlocking(path.join(root, 'no-existe'))).toMatchObject({ success: false });
  });
  it('la ausencia de GIO no convierte una entrada desktop en éxito', async () => {
    const target = path.join(root, 'applications', 'prueba.desktop');
    await fs.writeFile(target, '[Desktop Entry]\nType=Application\nName=Prueba\nExec=/app\n');
    // El PATH aislado no contiene GIO.
    expect(await launchPathNonBlocking(target)).toMatchObject({ success: false, error: expect.stringContaining('gio') });
  });
});
