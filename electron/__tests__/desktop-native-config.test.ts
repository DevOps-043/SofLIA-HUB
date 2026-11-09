import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import * as configApi from '../desktop-agent-types';
import { attachDesktopAgentLifecycle } from '../desktop-agent/service-lifecycle';
import type { DesktopAgentServiceConstructor } from '../desktop-agent/service-types';
import type { DesktopAgentService } from '../desktop-agent-service';
import { desktopConfigFields, desktopConfigSchema } from '../../src/shared/desktop-input';
let directory: string;
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-desktop-config-test-')); vi.spyOn(app, 'getPath').mockReturnValue(directory); });
afterEach(() => {
  vi.restoreAllMocks();
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('soflia-desktop-config-test-')) throw new Error('Temporal de prueba fuera de alcance');
  fs.rmSync(resolved, { recursive: true, force: true });
});
describe('Publicación de configuración Desktop', () => {
  it('si persistir falla conserva el estado anterior y no emite actualización', () => {
    class Fake { config = { ...configApi.DEFAULT_CONFIG }; emit = vi.fn(); }
    attachDesktopAgentLifecycle(Fake as unknown as DesktopAgentServiceConstructor);
    const service = new Fake() as unknown as DesktopAgentService;
    vi.spyOn(configApi, 'saveConfig').mockImplementationOnce(() => { throw new Error('fallo-ficticio'); });
    expect(() => service.setConfig({ maxSteps: 20 })).toThrow();
    expect(service.getConfig().maxSteps).toBe(configApi.DEFAULT_CONFIG.maxSteps); expect(service.emit).not.toHaveBeenCalled();
  });
  it('schema cubre todos los campos y defaults sin omitir configuración', () => {
    expect(Object.keys(desktopConfigFields).sort()).toEqual(Object.keys(configApi.DEFAULT_CONFIG).sort());
    expect(desktopConfigSchema.parse(configApi.DEFAULT_CONFIG)).toEqual(configApi.DEFAULT_CONFIG);
  });
  it('reemplazo atómico conserva formato, valores y modelo canónico', () => {
    configApi.saveConfig({ ...configApi.DEFAULT_CONFIG, maxSteps: 25 });
    const saved = JSON.parse(fs.readFileSync(path.join(directory, 'desktop-agent-config.json'), 'utf8'));
    expect(saved.maxSteps).toBe(25); expect(configApi.loadConfig().maxSteps).toBe(25);
    expect(fs.readdirSync(directory)).toEqual(['desktop-agent-config.json']);
  });
  it('renombrar fallido conserva archivo anterior y limpia temporal', () => {
    const target = path.join(directory, 'desktop-agent-config.json');
    fs.writeFileSync(target, JSON.stringify({ ...configApi.DEFAULT_CONFIG, maxSteps: 33 }));
    const previous = fs.readFileSync(target, 'utf8'); vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('fallo-ficticio'); });
    expect(() => configApi.saveConfig({ ...configApi.DEFAULT_CONFIG, maxSteps: 20 })).toThrow('No se pudo guardar');
    expect(fs.readFileSync(target, 'utf8')).toBe(previous); expect(fs.readdirSync(directory)).toEqual(['desktop-agent-config.json']);
  });
  it('userData no disponible no guarda en cwd', () => {
    vi.mocked(app.getPath).mockImplementationOnce(() => { throw new Error('no disponible'); });
    const write = vi.spyOn(fs, 'writeFileSync');
    expect(() => configApi.saveConfig(configApi.DEFAULT_CONFIG)).toThrow(); expect(write).not.toHaveBeenCalled();
  });
  it('carga conserva valores válidos, migra captura y descarta límites malformados', () => {
    fs.writeFileSync(path.join(directory, 'desktop-agent-config.json'), JSON.stringify({ maxSteps: -1, defaultActionDelay: 45, focusedCaptureEnabled: false, maxConcurrentAgents: 20, secreto: 'ajeno' }));
    const config = configApi.loadConfig(); expect(config.maxSteps).toBe(configApi.DEFAULT_CONFIG.maxSteps); expect(config.defaultActionDelay).toBe(45);
    expect(config.captureStrategy).toBe('all-monitors'); expect(config.maxConcurrentAgents).toBe(1); expect(config).not.toHaveProperty('secreto');
  });
  it.each([null, [], 'texto'])('configuración guardada no objeto usa defaults %#', value => {
    fs.writeFileSync(path.join(directory, 'desktop-agent-config.json'), JSON.stringify(value));
    expect(configApi.loadConfig()).toEqual(configApi.DEFAULT_CONFIG);
  });
  it('setConfig rechaza campos ajenos antes de persistir/emitir', () => {
    class Fake { config = { ...configApi.DEFAULT_CONFIG }; emit = vi.fn(); }
    attachDesktopAgentLifecycle(Fake as unknown as DesktopAgentServiceConstructor); const service = new Fake() as unknown as DesktopAgentService;
    const save = vi.spyOn(configApi, 'saveConfig');
    expect(() => service.setConfig({ maxSteps: 20, injected: true } as unknown as Partial<typeof configApi.DEFAULT_CONFIG>)).toThrow();
    expect(save).not.toHaveBeenCalled(); expect(service.emit).not.toHaveBeenCalled();
  });
});
