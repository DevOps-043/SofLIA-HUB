import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { safeStorage } from 'electron';
import { BrowserPrivacyStore } from '../integrated-browser/privacy-store';
import { BrowserSitePermissionStore } from '../integrated-browser/site-permissions';

const roots: string[] = [];
const origin = 'https://recuperacion.example';
beforeEach(() => { vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true); });
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});
async function location() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-policy-recovery-cache-')); roots.push(root);
  return path.join(root, 'policy.json');
}

describe('publicación restrictiva de caché tras recuperación', () => {
  it.each(['precargada', 'fallida'] as const)('privacidad %s conserva nivel estricto sin una segunda lectura de disco', async mode => {
    const file = await location(); let store = new BrowserPrivacyStore(file);
    await store.set({ origin, level: 'off', exceptionCategories: ['advertising'] });
    await store.set({ origin, level: 'strict', exceptionCategories: [] });
    await fs.writeFile(file, '{ daño');
    if (mode === 'fallida') {
      store = new BrowserPrivacyStore(file);
      await expect(store.get(origin)).rejects.toThrow();
    }
    const review = await store.prepareRecovery(() => {}); await review.commit();
    expect(store.peek(origin)).toMatchObject({ level: 'strict', exceptionCategories: [] });
    vi.spyOn(fs, 'lstat').mockRejectedValue(new Error('Disco no disponible después de publicar'));
    await expect(store.hydrate()).resolves.toBeUndefined();
    await expect(store.get(origin)).resolves.toMatchObject({ level: 'strict', exceptionCategories: [] });
    expect(fs.lstat).not.toHaveBeenCalled();
  });

  it('permisos síncronos conservan denegaciones y no conceden presentación antes de warmUp', async () => {
    const file = await location(); const store = new BrowserSitePermissionStore(file);
    await store.set(origin, 'fullscreen', 'denied');
    await store.set(origin, 'camera', 'granted');
    await store.set(origin, 'fullscreen', 'ask');
    await fs.writeFile(file, '{ daño');
    const review = await store.prepareRecovery(() => {}); await review.commit();
    expect(store.resolveSync(origin, 'fullscreen')).toBe('denied');
    expect(store.resolveSync(origin, 'pointer-lock')).toBe('ask');
    expect(store.resolveSync(origin, 'camera')).toBe('ask');
    vi.spyOn(fs, 'lstat').mockRejectedValue(new Error('Disco no disponible después de publicar'));
    await expect(store.warmUp()).resolves.toBeUndefined();
    await expect(store.resolve(origin, 'fullscreen')).resolves.toBe('denied');
    expect(fs.lstat).not.toHaveBeenCalled();
  });

  it('un commit rechazado no publica la proyección en memoria', async () => {
    const file = await location(); const store = new BrowserPrivacyStore(file);
    await store.set({ origin, level: 'off', exceptionCategories: [] });
    await store.set({ origin, level: 'balanced', exceptionCategories: [] });
    await fs.writeFile(file, '{ daño');
    let current = true;
    const review = await store.prepareRecovery(() => { if (!current) throw new Error('Contexto inválido'); });
    current = false;
    await expect(review.commit()).rejects.toThrow();
    expect(store.peek(origin).level).toBe('balanced');
  });

  it('una lectura fallida anterior al commit no retira la caché de permisos recuperada', async () => {
    const file = await location(); const store = new BrowserSitePermissionStore(file);
    await store.set(origin, 'camera', 'granted');
    await store.set(origin, 'camera', 'denied');
    await fs.writeFile(file, '{ daño');
    const review = await store.prepareRecovery(() => {}); store.invalidateCache();
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(fs, 'lstat').mockImplementationOnce(async () => {
      await blocked; throw Object.assign(new Error('Lectura anterior no disponible'), { code: 'EACCES' });
    });
    const staleRead = store.warmUp();
    const outcome = staleRead.then(() => 'resuelta', () => 'descartada');
    await review.commit();
    release(); expect(await outcome).toBe('descartada');
    expect(store.resolveSync(origin, 'camera')).toBe('ask');
    expect(store.resolveSync(origin, 'fullscreen')).toBe('ask');
    await store.set(origin, 'camera', 'denied');
    expect(store.resolveSync(origin, 'camera')).toBe('denied');
  });
});
