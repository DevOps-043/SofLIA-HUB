import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PythonPrivacyStore, PrivacyPersistenceError } from '../python/privacy-store';
vi.mock('node:crypto', async original => ({ ...await original<typeof import('node:crypto')>(), randomUUID: () => 'colision-ficticia' }));
let root: string; let file: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-privacy-store-')); file = path.join(root, 'privacy.json'); });
afterEach(() => { vi.restoreAllMocks(); expect(path.relative(os.tmpdir(), root).startsWith('..')).toBe(false); fs.rmSync(root, { recursive: true, force: true }); });
describe('Publicación de política documental de máquina', () => {
  it('sólo una ausencia inicial admite opt-in desactivado', () => { expect(new PythonPrivacyStore(() => file).get()).toEqual({ redactDocuments: false }); });
  it('un archivo desaparecido después de lstat no desactiva la protección', () => {
    fs.writeFileSync(file, '{"redactDocuments":true}');
    vi.spyOn(fs, 'openSync').mockImplementation(() => { throw Object.assign(new Error('desapareció'), { code: 'ENOENT' }); });
    expect(() => new PythonPrivacyStore(() => file).get()).toThrow();
  });
  it.each(['{', '{}', '{"redactDocuments":"false"}', '{"redactDocuments":true,"owner":"A"}', ' '.repeat(1025)])('rechaza configuración inválida sin inventar false: %#', text => {
    fs.writeFileSync(file, text); expect(() => new PythonPrivacyStore(() => file).get()).toThrow();
  });
  it('publica tras rename y puede releerse sin claves adicionales', () => {
    const changed = vi.fn(); const store = new PythonPrivacyStore(() => file, changed); const old = store.capture();
    expect(store.set({ redactDocuments: true })).toEqual({ redactDocuments: true }); expect(changed).toHaveBeenCalledOnce(); expect(() => old.assertCurrent()).toThrow('PRIVACY_CHANGED');
    expect(new PythonPrivacyStore(() => file).get()).toEqual({ redactDocuments: true }); expect(fs.readdirSync(root)).toEqual(['privacy.json']);
  });
  it('A/B/A de política no vuelve a validar la lectura anterior', () => {
    const store = new PythonPrivacyStore(() => file); const old = store.capture(); store.set({ redactDocuments: true }); store.set({ redactDocuments: false }); expect(() => old.assertCurrent()).toThrow();
  });
  it('una colisión de staging no elimina el archivo que no creó', () => {
    const other = path.join(root, '.privacy-colision-ficticia.tmp'); fs.writeFileSync(other, 'no-es-del-store');
    const store = new PythonPrivacyStore(() => file); expect(() => store.set({ redactDocuments: true })).toThrow(PrivacyPersistenceError); expect(fs.readFileSync(other, 'utf8')).toBe('no-es-del-store');
    expect(store.get()).toEqual({ redactDocuments: false });
  });
  it('un rename que confirma en disco pero pierde acuse no conserva política vieja en memoria', () => {
    const store = new PythonPrivacyStore(() => file); const old = store.capture(); const rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => { rename(from, to); throw new Error('acuse ficticio perdido'); });
    try { store.set({ redactDocuments: true }); throw new Error('faltó el fallo esperado'); }
    catch (error) { expect(error).toBeInstanceOf(PrivacyPersistenceError); expect((error as PrivacyPersistenceError).uncertain).toBe(true); }
    expect(() => old.assertCurrent()).toThrow(); expect(store.get()).toEqual({ redactDocuments: true });
  });
  it('no evalúa getters ni acepta campos de aprobación', () => {
    const store = new PythonPrivacyStore(() => file); const getter = vi.fn(() => true);
    expect(() => store.set(Object.defineProperty({}, 'redactDocuments', { get: getter }))).toThrow(); expect(getter).not.toHaveBeenCalled();
    expect(() => store.set({ redactDocuments: true, approved: true })).toThrow();
  });
});
