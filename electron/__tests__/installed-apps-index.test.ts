import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
}));

vi.mock('node:fs', () => ({
  default: { existsSync: fsMocks.existsSync, readFileSync: fsMocks.readFileSync },
  existsSync: fsMocks.existsSync,
  readFileSync: fsMocks.readFileSync,
}));

import { findInstalledApp, resetInstalledAppsIndexCache } from '../desktop-agent/installed-apps-index';

const TTL = 60_000;

function armPersistedIndex(apps: Array<{ nombre: string; ruta: string }>): void {
  fsMocks.existsSync.mockReturnValue(true);
  fsMocks.readFileSync.mockReturnValue(JSON.stringify({ version: 2, generadoEn: Date.now(), apps }));
}

describe('Indice de apps instaladas: busqueda por nombre', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInstalledAppsIndexCache();
  });

  it('IA-001: encuentra coincidencia exacta normalizada (acentos y mayusculas)', async () => {
    armPersistedIndex([
      { nombre: 'Minecraft Launcher', ruta: 'C:/ProgramData/.../Minecraft Launcher.lnk' },
      { nombre: 'Google Chrome', ruta: 'C:/.../chrome.lnk' },
    ]);
    const app = await findInstalledApp('minecraft launcher', TTL);
    expect(app?.ruta).toContain('Minecraft Launcher.lnk');
  });

  it('IA-002: coincidencia parcial unica resuelve; ambigua devuelve null', async () => {
    armPersistedIndex([
      { nombre: 'Minecraft Launcher', ruta: 'C:/a.lnk' },
      { nombre: 'Visual Studio Code', ruta: 'C:/b.lnk' },
      { nombre: 'Visual Studio 2022', ruta: 'C:/c.lnk' },
    ]);
    expect((await findInstalledApp('minecraft', TTL))?.nombre).toBe('Minecraft Launcher');
    // "visual studio" matchea dos entradas: ambiguo, decide el resolver en vivo.
    expect(await findInstalledApp('visual studio', TTL)).toBeNull();
  });

  it('IA-003: nombre vacio o sin coincidencias devuelve null', async () => {
    armPersistedIndex([{ nombre: 'Spotify', ruta: 'C:/s.lnk' }]);
    expect(await findInstalledApp('', TTL)).toBeNull();
    expect(await findInstalledApp('AppInexistente', TTL)).toBeNull();
  });
});
