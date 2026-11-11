import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishRecoveryFile } from '../integrated-browser/recovery-file-publication';

let root: string; let file: string;
const denied = (code = 'EIO') => Object.assign(new Error('Fallo ficticio con contenido privado'), { code });
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-publication-')); file = path.join(root, 'store.bin'); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
const stages = () => fs.readdirSync(root).filter(name => name.endsWith('.tmp'));

describe('publicación síncrona de recuperación', () => {
  it.each([false, true])('publica bytes completos y retira el temporal; exclusiva=%s', exclusive => {
    if (!exclusive) fs.writeFileSync(file, 'anterior');
    const data = Buffer.from([0, 255, 1, 2, 0]);
    publishRecoveryFile(file, data, () => {}, exclusive);
    expect(fs.readFileSync(file)).toEqual(data); expect(stages()).toEqual([]);
  });

  it('sincroniza y cierra antes de revisar la guarda y reemplazar', () => {
    const events: string[] = [], open = fs.openSync, sync = fs.fsyncSync, close = fs.closeSync, rename = fs.renameSync;
    let descriptor = -1;
    vi.spyOn(fs, 'openSync').mockImplementation((target, flags, mode) => {
      const fd = open(target, flags, mode); if (flags === 'wx') { expect(mode).toBe(0o600); descriptor = fd; events.push('create'); } return fd;
    });
    vi.spyOn(fs, 'fsyncSync').mockImplementation(fd => { sync(fd); if (fd === descriptor) events.push('sync'); });
    vi.spyOn(fs, 'closeSync').mockImplementation(fd => { close(fd); if (fd === descriptor) events.push('close'); });
    vi.spyOn(fs, 'renameSync').mockImplementation((source, target) => { events.push('publish'); rename(source, target); });
    publishRecoveryFile(file, Buffer.from('completo'), () => { events.push('guard'); });
    expect(events).toEqual(['guard', 'create', 'sync', 'close', 'guard', 'publish']);
    expect(fs.readFileSync(file, 'utf8')).toBe('completo');
  });

  it('un destino exclusivo existente conserva sus bytes', () => {
    fs.writeFileSync(file, 'ajeno');
    expect(() => publishRecoveryFile(file, Buffer.from('nuevo'), () => {}, true)).toThrow();
    expect(fs.readFileSync(file, 'utf8')).toBe('ajeno'); expect(stages()).toEqual([]);
  });

  it('un temporal ocupado no se elimina si falla su creación exclusiva', () => {
    const open = fs.openSync; let foreign = '';
    vi.spyOn(fs, 'openSync').mockImplementation((target, flags, mode) => {
      if (flags === 'wx') {
        foreign = String(target); const fd = open(target, flags, mode);
        try { fs.writeFileSync(fd, 'temporal ajeno'); } finally { fs.closeSync(fd); }
        throw denied('EEXIST');
      }
      return open(target, flags, mode);
    });
    expect(() => publishRecoveryFile(file, Buffer.from('nuevo'), () => {})).toThrow();
    expect(fs.readFileSync(foreign, 'utf8')).toBe('temporal ajeno'); expect(fs.existsSync(file)).toBe(false);
  });

  it.each(['antes', 'después'] as const)('la guarda rechazada %s de preparar conserva el principal', when => {
    fs.writeFileSync(file, 'anterior'); const failure = denied(); let calls = 0;
    expect(() => publishRecoveryFile(file, Buffer.from('nuevo'), () => {
      if (++calls === (when === 'antes' ? 1 : 2)) throw failure;
    })).toThrow(failure);
    expect(fs.readFileSync(file, 'utf8')).toBe('anterior'); expect(stages()).toEqual([]);
  });

  it.each(['write', 'sync', 'close', 'rename', 'link'] as const)('fallar %s conserva causa, principal y limpieza', stage => {
    fs.writeFileSync(file, 'anterior'); const failure = denied(), close = fs.closeSync;
    if (stage === 'write') vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw failure; });
    if (stage === 'sync') vi.spyOn(fs, 'fsyncSync').mockImplementation(() => { throw failure; });
    if (stage === 'close') vi.spyOn(fs, 'closeSync').mockImplementation(fd => { close(fd); throw failure; });
    if (stage === 'rename') vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw failure; });
    if (stage === 'link') vi.spyOn(fs, 'linkSync').mockImplementation(() => { throw failure; });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => publishRecoveryFile(file, Buffer.from('nuevo'), () => {}, stage === 'link')).toThrow(failure);
    vi.restoreAllMocks(); expect(fs.readFileSync(file, 'utf8')).toBe('anterior'); expect(stages()).toEqual([]);
  });

  it.each(['write', 'sync'] as const)('el fallo de %s prevalece sobre cierre y limpieza fallidos', stage => {
    fs.writeFileSync(file, 'anterior'); const primary = denied(), secondary = denied('EACCES'), close = fs.closeSync;
    if (stage === 'write') vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw primary; });
    else vi.spyOn(fs, 'fsyncSync').mockImplementation(() => { throw primary; });
    const closing = vi.spyOn(fs, 'closeSync').mockImplementation(fd => { close(fd); throw secondary; });
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw secondary; });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => publishRecoveryFile(file, Buffer.from('nuevo'), () => {})).toThrow(primary);
    expect(closing).toHaveBeenCalledOnce(); expect(warning).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/Fallo ficticio|contenido privado|recovery-publication-/);
    vi.restoreAllMocks(); expect(fs.readFileSync(file, 'utf8')).toBe('anterior'); expect(stages()).toHaveLength(1);
  });

  it('el fallo de publicación conserva identidad si la limpieza también falla', () => {
    fs.writeFileSync(file, 'anterior'); const primary = denied();
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw primary; });
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw denied('EACCES'); });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => publishRecoveryFile(file, Buffer.from('nuevo'), () => {})).toThrow(primary);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('no publicado'));
    expect(fs.readFileSync(file, 'utf8')).toBe('anterior'); expect(stages()).toHaveLength(1);
  });

  it('el éxito exclusivo no cambia si falla limpiar su enlace temporal', () => {
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw denied('EACCES'); });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => publishRecoveryFile(file, Buffer.from('nuevo'), () => {}, true)).not.toThrow();
    expect(fs.readFileSync(file, 'utf8')).toBe('nuevo'); expect(stages()).toHaveLength(1);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Archivo publicado'));
  });

  it('conserva identidad aunque los errores primario y secundario tengan el mismo mensaje', () => {
    const primary = denied(), secondary = denied('EACCES'), close = fs.closeSync;
    vi.spyOn(fs, 'fsyncSync').mockImplementation(() => { throw primary; });
    vi.spyOn(fs, 'closeSync').mockImplementation(fd => { close(fd); throw secondary; });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let caught: unknown;
    try { publishRecoveryFile(file, Buffer.from('nuevo'), () => {}); } catch (error) { caught = error; }
    expect(caught).toBe(primary); expect(stages()).toEqual([]); expect(fs.existsSync(file)).toBe(false);
  });
});
