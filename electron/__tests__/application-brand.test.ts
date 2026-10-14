import path from 'node:path';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApplicationBrand } from '../main/application-brand';

describe('identidad de Soflia Hub y compatibilidad del perfil', () => {
  const stages: string[] = [];
  afterEach(() => { for (const stage of stages.splice(0)) rmSync(stage, { recursive: true, force: true }); });

  it.each([true, false])('conserva datos y sesiones con isPackaged=%s', isPackaged => {
    const stage = mkdtempSync(path.join(tmpdir(), 'soflia-brand-test-'));
    stages.push(stage);
    const appData = path.join(stage, 'app-data');
    const development = path.join(stage, 'perfil-desarrollo');
    const calls: string[] = [];
    const app = {
      isPackaged,
      getPath: vi.fn((name: string) => name === 'appData' ? appData : development),
      setPath: vi.fn((name: string, value: string) => {
        expect(existsSync(value)).toBe(true);
        calls.push(`${name}:${value}`);
      }),
      setName: vi.fn((name: string) => { calls.push(`nombre:${name}`); }),
    };
    configureApplicationBrand(app);
    const profile = isPackaged ? path.join(appData, 'Pulse Hub') : development;
    expect(calls).toEqual([`userData:${profile}`, `sessionData:${profile}`, 'nombre:Soflia Hub']);
    expect(app.setName).toHaveBeenCalledWith('Soflia Hub');
  });

  it('no modifica los archivos de un perfil empaquetado existente', () => {
    const stage = mkdtempSync(path.join(tmpdir(), 'soflia-brand-test-'));
    stages.push(stage);
    const profile = path.join(stage, 'Pulse Hub');
    mkdirSync(profile);
    const preferences = path.join(profile, 'ui-preferences.json');
    writeFileSync(preferences, '{"theme":"dark"}');
    configureApplicationBrand({ isPackaged: true, getPath: () => stage, setPath: vi.fn(), setName: vi.fn() });
    expect(readFileSync(preferences, 'utf8')).toBe('{"theme":"dark"}');
  });
});
