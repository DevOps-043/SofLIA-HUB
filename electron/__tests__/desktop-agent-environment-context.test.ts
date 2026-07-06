import { describe, expect, it } from 'vitest';
import {
  buildEnvironmentContextPack,
  formatEnvironmentContextForPrompt,
  type EnvironmentContextDeps,
} from '../desktop-agent/environment-context';

const MONITORES = [
  { id: '1', boundsDip: { x: 0, y: 0, width: 2560, height: 1440 }, scaleFactor: 1, primario: true },
  { id: '2', boundsDip: { x: -1707, y: 200, width: 1707, height: 960 }, scaleFactor: 1.5, primario: false },
];

function buildDeps(overrides: Partial<EnvironmentContextDeps> = {}): EnvironmentContextDeps {
  return {
    listWindows: async () => [{ title: 'SofLIA Hub', process: 'electron', pid: 100 }],
    getActiveWindow: async () => ({ title: 'Visual Studio Code', process: 'Code' }),
    getMonitors: () => MONITORES,
    getInstalledApps: async () => [
      { nombre: 'Google Chrome', ruta: 'C:/x/chrome.lnk' },
      { nombre: 'Spotify', ruta: 'C:/x/spotify.lnk' },
    ],
    timeoutMs: 200,
    ...overrides,
  };
}

describe('EnvironmentContextPack', () => {
  it('EC-001: construye el pack completo con todas las fuentes', async () => {
    const pack = await buildEnvironmentContextPack(buildDeps());
    expect(pack.ventanasAbiertas).toHaveLength(1);
    expect(pack.ventanaActiva?.process).toBe('Code');
    expect(pack.monitores).toHaveLength(2);
    expect(pack.appsInstaladas.map((app) => app.nombre)).toContain('Spotify');
    expect(pack.generadoEn).toBeGreaterThan(0);
  });

  it('EC-002: una fuente que excede el timeout degrada a pack parcial sin bloquear', async () => {
    const pack = await buildEnvironmentContextPack(buildDeps({
      listWindows: () => new Promise(() => {}), // nunca resuelve
      timeoutMs: 50,
    }));
    expect(pack.ventanasAbiertas).toEqual([]);
    expect(pack.appsInstaladas.length).toBeGreaterThan(0);
  });

  it('EC-003: una fuente que lanza error degrada a pack parcial', async () => {
    const pack = await buildEnvironmentContextPack(buildDeps({
      getInstalledApps: async () => { throw new Error('registro inaccesible'); },
      getMonitors: () => { throw new Error('sin pantalla'); },
    }));
    expect(pack.appsInstaladas).toEqual([]);
    expect(pack.monitores).toEqual([]);
    expect(pack.ventanaActiva?.title).toBe('Visual Studio Code');
  });

  it('EC-004: el formato de prompt incluye monitores, ventana activa y apps', async () => {
    const pack = await buildEnvironmentContextPack(buildDeps());
    const texto = formatEnvironmentContextForPrompt(pack);
    expect(texto).toContain('CONTEXTO DEL EQUIPO:');
    expect(texto).toContain('Monitores (2)');
    expect(texto).toContain('escala 1.5x');
    expect(texto).toContain('Ventana activa: "Visual Studio Code"');
    expect(texto).toContain('open_application');
    expect(texto).toContain('Google Chrome');
  });

  it('EC-005: un pack vacio produce una advertencia en lugar de una seccion vacia', () => {
    const texto = formatEnvironmentContextForPrompt({
      ventanasAbiertas: [],
      ventanaActiva: null,
      monitores: [],
      appsInstaladas: [],
      generadoEn: Date.now(),
    });
    expect(texto).toContain('No se pudo obtener informacion del entorno');
  });
});
