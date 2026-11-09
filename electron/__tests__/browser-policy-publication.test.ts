import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { BrowserPrivacyStore } from '../integrated-browser/privacy-store';
import { policyBackupPath } from '../integrated-browser/policy-file-recovery';

const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
const onPlatform = (value: string) => Object.defineProperty(process, 'platform', { ...platform, value });
const denied = (code = 'EPERM') => Object.assign(new Error('Fallo propio de publicación'), { code });
let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-policy-publication-')); vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true); });
afterEach(async () => { vi.restoreAllMocks(); Object.defineProperty(process, 'platform', platform); await fs.rm(root, { recursive: true, force: true }); });
async function fixture() {
  const file = path.join(root, 'privacy.json'), store = new BrowserPrivacyStore(file), origin = 'https://fixture.example';
  await store.set({ origin, level: 'off', exceptionCategories: ['advertising'] });
  await store.set({ origin, level: 'balanced', exceptionCategories: [] });
  return { file, backup: policyBackupPath(file), store, origin, publish: () => store.set({ origin, level: 'strict', exceptionCategories: [] }) };
}

describe('publicación Windows condicionada de políticas', () => {
  it.each([
    ['principal', 'EPERM'], ['principal', 'EBUSY'], ['respaldo', 'EPERM'], ['respaldo', 'EBUSY'],
  ] as const)('reintenta %s ante %s transitorio sin perder principal/copia', async (target, code) => {
    const f = await fixture(), before = await fs.readFile(f.file); onPlatform('win32');
    const destination = target === 'principal' ? f.file : f.backup;
    const rename = fs.rename; let attempts = 0;
    vi.spyOn(fs, 'rename').mockImplementation(async (source, file) => {
      if (String(file) === destination && ++attempts === 1) throw denied(code);
      return rename(source, file);
    });
    await f.publish(); expect(attempts).toBe(2); expect((await f.store.get(f.origin)).level).toBe('strict');
    const envelope = JSON.parse(safeStorage.decryptString(await fs.readFile(f.backup)));
    expect(Buffer.from(envelope.data, 'base64')).toEqual(before);
    expect((await fs.readdir(root)).some(name => name.endsWith('.tmp'))).toBe(false);
  });

  it('agota cinco intentos conservando principal, caché y limpieza de temporales', async () => {
    const f = await fixture(), before = await fs.readFile(f.file); onPlatform('win32');
    const rename = fs.rename; let attempts = 0;
    vi.spyOn(fs, 'rename').mockImplementation(async (source, destination) => {
      if (String(destination) === f.file) { attempts++; throw denied(); }
      return rename(source, destination);
    });
    await expect(f.publish()).rejects.toMatchObject({ code: 'EPERM' }); expect(attempts).toBe(5);
    expect(await fs.readFile(f.file)).toEqual(before); expect((await f.store.get(f.origin)).level).toBe('balanced');
    expect((await fs.readdir(root)).some(name => name.endsWith('.tmp'))).toBe(false);
  });

  it.each([['darwin', 'EPERM'], ['win32', 'EACCES'], ['win32', 'EIO'], ['win32', 'EEXIST']] as const)(
    'no reintenta plataforma/error no elegible: %s %s', async (host, code) => {
      const f = await fixture(), before = await fs.readFile(f.file); onPlatform(host);
      const rename = fs.rename; let attempts = 0;
      vi.spyOn(fs, 'rename').mockImplementation(async (source, destination) => {
        if (String(destination) === f.file) { attempts++; throw denied(code); }
        return rename(source, destination);
      });
      await expect(f.publish()).rejects.toMatchObject({ code }); expect(attempts).toBe(1);
      expect(await fs.readFile(f.file)).toEqual(before);
    });

  it.each(['principal', 'respaldo'] as const)('un cambio ajeno en %s impide reintentar sobre él', async target => {
    const f = await fixture(), before = await fs.readFile(f.file); onPlatform('win32');
    const destination = target === 'principal' ? f.file : f.backup, rename = fs.rename; let attempts = 0;
    vi.spyOn(fs, 'rename').mockImplementation(async (source, file) => {
      if (String(file) === destination) { attempts++; await fs.writeFile(destination, 'cambio ajeno'); throw denied(); }
      return rename(source, file);
    });
    await expect(f.publish()).rejects.toThrow(); expect(attempts).toBe(1);
    expect(await fs.readFile(destination, 'utf8')).toBe('cambio ajeno');
    if (target === 'respaldo') expect(await fs.readFile(f.file)).toEqual(before);
  });

  it.each(['contexto', 'plazo'] as const)('una recuperación no reintenta con %s revocado', async cause => {
    let elapsed = 0n; vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => elapsed);
    const f = await fixture(); await fs.writeFile(f.file, '{ daño'); const before = await fs.readFile(f.file);
    let current = true; const review = await f.store.prepareRecovery(() => { if (!current) throw new Error('Contexto revocado'); });
    onPlatform('win32'); const rename = fs.rename; let attempts = 0;
    vi.spyOn(fs, 'rename').mockImplementation(async (source, destination) => {
      if (String(destination) === f.file) {
        attempts++; if (cause === 'contexto') current = false; else elapsed = 300_001_000_000n;
        throw denied();
      }
      return rename(source, destination);
    });
    await expect(review.commit()).rejects.toThrow(); expect(attempts).toBe(1);
    expect(await fs.readFile(f.file)).toEqual(before);
    expect((await fs.readdir(root)).some(name => name.endsWith('.tmp') || name.includes('.damaged-'))).toBe(false);
  });

  it('un destino creado al publicar por link exclusivo se conserva sin reintento', async () => {
    const file = path.join(root, 'new.json'), store = new BrowserPrivacyStore(file); onPlatform('win32');
    const link = vi.spyOn(fs, 'link').mockImplementation(async (_source, destination) => {
      await fs.writeFile(destination, 'archivo ajeno'); throw denied('EEXIST');
    });
    await expect(store.set({ origin: 'https://fixture.example', level: 'strict', exceptionCategories: [] })).rejects.toMatchObject({ code: 'EEXIST' });
    expect(link).toHaveBeenCalledOnce(); expect(await fs.readFile(file, 'utf8')).toBe('archivo ajeno');
  });

  it('fallar la creación exclusiva del temporal no elimina el archivo que lo ocupaba', async () => {
    const f = await fixture(), before = await fs.readFile(f.file), open = fs.open;
    let foreign = '';
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      if (args[1] === 'wx' && String(args[0]).endsWith('.tmp')) {
        foreign = String(args[0]); await fs.writeFile(foreign, 'temporal ajeno', { flag: 'wx' }); throw denied('EEXIST');
      }
      return open(...args);
    });
    await expect(f.publish()).rejects.toMatchObject({ code: 'EEXIST' });
    expect(foreign).not.toBe(''); expect(await fs.readFile(foreign, 'utf8')).toBe('temporal ajeno');
    expect(await fs.readFile(f.file)).toEqual(before);
  });

  it('un fallo de limpieza previo a publicar no sustituye el error de la operación', async () => {
    const f = await fixture(), before = await fs.readFile(f.file), rename = fs.rename, unlink = fs.unlink;
    vi.spyOn(fs, 'rename').mockImplementation(async (source, destination) => {
      if (String(destination) === f.file) throw denied('EIO');
      return rename(source, destination);
    });
    vi.spyOn(fs, 'unlink').mockImplementation(async file => {
      const own = String(file);
      if (own.startsWith(f.file + '.') && !own.startsWith(f.backup + '.') && own.endsWith('.tmp')) throw denied('EACCES');
      return unlink(file);
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(f.publish()).rejects.toMatchObject({ code: 'EIO' });
    expect(await fs.readFile(f.file)).toEqual(before); expect(warning).toHaveBeenCalledOnce();
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/privacy\.json|browser-policy-publication-|Fallo propio/);
    expect((await fs.readdir(root)).filter(name => name.endsWith('.tmp'))).toHaveLength(1);
  });
});
