import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as path from 'node:path';

const fsMocks = vi.hoisted(() => ({
  existingDirs: new Set<string>(),
}));

vi.mock('node:fs/promises', () => ({
  stat: async (target: string) => {
    if (fsMocks.existingDirs.has(String(target))) return { isDirectory: () => true };
    throw new Error('ENOENT');
  },
  readdir: async () => [],
}));

import { resolveKeyPaths } from '../path-memory/key-paths';

function existingDirs(dirs: string[]): void {
  fsMocks.existingDirs = new Set(dirs);
}

describe('resolveKeyPaths (multiplataforma)', () => {
  beforeEach(() => { fsMocks.existingDirs = new Set(); });

  it('usa la ruta del SISTEMA OPERATIVO aunque la carpeta este redirigida (Windows + OneDrive)', async () => {
    const home = 'C:\\Users\\fer';
    const redirected = 'C:\\Users\\fer\\OneDrive\\Escritorio';
    existingDirs([redirected]);
    const osPaths: Record<string, string> = { desktop: redirected };

    const paths = await resolveKeyPaths(home, (key) => osPaths[key] ?? null);

    // Antes se buscaba "Desktop" dentro de $HOME y nunca hallaba la carpeta real.
    expect(paths.get('Escritorio')).toBe(redirected);
  });

  it('resuelve rutas de macOS via el sistema operativo', async () => {
    const home = '/Users/fer';
    existingDirs(['/Users/fer/Desktop', '/Users/fer/Documents']);
    const osPaths: Record<string, string> = {
      desktop: '/Users/fer/Desktop',
      documents: '/Users/fer/Documents',
    };

    const paths = await resolveKeyPaths(home, (key) => osPaths[key] ?? null);

    expect(paths.get('Escritorio')).toBe('/Users/fer/Desktop');
    expect(paths.get('Documentos')).toBe('/Users/fer/Documents');
  });

  it('cae al escaneo por nombre cuando el SO no declara la ruta (Linux localizado)', async () => {
    const home = '/home/fer';
    // path.join usa el separador del SO donde corre el test: se construye igual
    // que en produccion para que la asercion valga en cualquier plataforma.
    const localized = path.join(home, 'Escritorio');
    existingDirs([localized]);

    const paths = await resolveKeyPaths(home, () => null);

    // Sin ayuda del SO, encuentra la carpeta localizada por su nombre.
    expect(paths.get('Escritorio')).toBe(localized);
    expect(paths.get('Home')).toBe(home);
  });
});
