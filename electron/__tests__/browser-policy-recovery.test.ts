import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { safeStorage } from 'electron';
import { BrowserSitePermissionStore } from '../integrated-browser/site-permissions';
import { BrowserPrivacyStore } from '../integrated-browser/privacy-store';
import { BrowserAgentPolicyStore } from '../integrated-browser/agent-policy-store';
import { policyBackupPath } from '../integrated-browser/policy-file-recovery';
import { validatePolicyRecoveryRequest } from '../../src/shared/browser-policy-recovery';
const roots: string[] = [];
beforeEach(() => { vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true); });
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });
async function fixture(kind: 'permissions' | 'privacy' | 'agent' = 'permissions') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-policy-recovery-')); roots.push(root);
  const file = path.join(root, `${kind}.json`); const origin = 'https://privado.example';
  const permission = new BrowserSitePermissionStore(file); const privacy = new BrowserPrivacyStore(file); const agent = new BrowserAgentPolicyStore(file);
  const store = kind === 'permissions' ? permission : kind === 'privacy' ? privacy : agent;
  const change = async () => {
    if (kind === 'permissions') await permission.set(origin, 'camera', 'denied');
    if (kind === 'privacy') await privacy.set({ origin, level: 'balanced', exceptionCategories: [] });
    if (kind === 'agent') await agent.set({ origin, mode: 'strict', decision: 'block' });
  };
  if (kind === 'permissions') await permission.set(origin, 'camera', 'granted');
  if (kind === 'privacy') await privacy.set({ origin, level: 'off', exceptionCategories: ['advertising'] });
  if (kind === 'agent') await agent.set({ origin, mode: 'balanced', decision: 'allow-always' });
  await change(); return { root, file, store, change, origin, permission, privacy, agent };
}
describe('recuperación restrictiva de ajustes', () => {
  it.each(['permissions', 'privacy', 'agent'] as const)('recupera %s sin concesiones, preserva respaldo y cifra el principal dañado', async kind => {
    const f = await fixture(kind); const backup = await fs.readFile(policyBackupPath(f.file));
    expect(backup.toString()).not.toContain(f.origin); expect(safeStorage.encryptString).toHaveBeenCalled();
    const damaged = '{ daño de prueba'; await fs.writeFile(f.file, damaged);
    const review = await f.store.prepareRecovery(() => {});
    expect(review.count).toBe(1); expect(await fs.readFile(f.file, 'utf8')).toBe(damaged);
    await review.commit(); await expect(review.commit()).rejects.toThrow();
    expect(await fs.readFile(policyBackupPath(f.file))).toEqual(backup);
    const files = (await fs.readdir(f.root)).filter(name => name.includes('.damaged-'));
    expect(files).toHaveLength(1);
    const envelope = JSON.parse(safeStorage.decryptString(await fs.readFile(path.join(f.root, files[0]))));
    expect(Buffer.from(envelope.data, 'base64').toString()).toBe(damaged);
    if (kind === 'permissions') {
      expect(await f.permission.resolve(f.origin, 'camera')).toBe('ask');
      expect(await f.permission.resolve(f.origin, 'fullscreen')).toBe('ask');
    }
    if (kind === 'privacy') expect(await f.privacy.get(f.origin)).toMatchObject({ level: 'strict', exceptionCategories: [], blocked: {} });
    if (kind === 'agent') expect(await f.agent.evaluate(f.origin, 'observe-dom')).toBe('ask');
  });
  it('un principal ausente con copia no se convierte en almacén vacío al guardar', async () => {
    const f = await fixture(); await fs.unlink(f.file);
    await expect(f.change()).rejects.toThrow();
    const review = await f.store.prepareRecovery(() => {}); await review.commit();
    expect(await f.permission.resolve(f.origin, 'camera')).toBe('ask');
    expect((await fs.readdir(f.root)).some(name => name.includes('damaged'))).toBe(false);
  });
  it.each(['válido', 'futuro', 'acceso', 'cuota', 'respaldo ajeno'] as const)('rechaza %s sin sobrescribir', async mode => {
    const f = await fixture();
    if (mode === 'futuro') await fs.writeFile(f.file, JSON.stringify({ version: 2, origins: {} }));
    if (mode === 'cuota') await fs.writeFile(f.file, Buffer.alloc(8 * 1024 * 1024 + 1));
    if (mode === 'respaldo ajeno') { const other = await fixture(); await fs.copyFile(policyBackupPath(other.file), policyBackupPath(f.file)); await fs.writeFile(f.file, '{ daño'); }
    const before = await fs.readFile(f.file);
    if (mode === 'acceso') vi.spyOn(fs, 'lstat').mockRejectedValueOnce(Object.assign(new Error('ruta privada'), { code: 'EACCES' }));
    await expect(f.store.prepareRecovery(() => {})).rejects.toThrow();
    expect((await fs.readFile(f.file)).equals(before)).toBe(true);
  });
  it.each(['contexto', 'plazo', 'principal', 'respaldo', 'rename'] as const)('rechaza commit obsoleto/fallido por %s y conserva los archivos', async mode => {
    const f = await fixture(); await fs.writeFile(f.file, '{ daño'); let current = true;
    const review = await f.store.prepareRecovery(() => { if (!current) throw new Error('Contexto inválido'); });
    if (mode === 'contexto') current = false;
    if (mode === 'plazo') vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300_001);
    if (mode === 'principal') await fs.writeFile(f.file, '{ otro daño');
    if (mode === 'respaldo') await fs.appendFile(policyBackupPath(f.file), 'alterado');
    if (mode === 'rename') vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('No se pudo publicar'));
    const before = await fs.readFile(f.file);
    await expect(review.commit()).rejects.toThrow(); expect(await fs.readFile(f.file)).toEqual(before);
    expect((await fs.readdir(f.root)).filter(name => name.includes('.tmp') || name.includes('.damaged-'))).toEqual([]);
  });
  it('revisiones concurrentes no reemplazan un estado recién recuperado', async () => {
    const f = await fixture(); await fs.writeFile(f.file, '{ daño');
    const [a, b] = await Promise.all([f.store.prepareRecovery(() => {}), f.store.prepareRecovery(() => {})]);
    const results = await Promise.allSettled([a.commit(), b.commit()]);
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(item => item.status === 'rejected')).toHaveLength(1);
  });
  it('fallar al respaldar o no disponer de cifrado impide perder el principal', async () => {
    const f = await fixture(); const before = await fs.readFile(f.file);
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('respaldo no publicable'));
    await expect(f.change()).rejects.toThrow(); expect(await fs.readFile(f.file)).toEqual(before);
    vi.spyOn(safeStorage, 'isEncryptionAvailable').mockReturnValue(false);
    await expect(f.change()).rejects.toThrow(); expect(await fs.readFile(f.file)).toEqual(before);
    expect((await fs.readdir(f.root)).filter(name => name.endsWith('.tmp'))).toEqual([]);
  });
  it('restablecer permisos elimina copias antiguas y no ofrece recuperarlas después', async () => {
    const f = await fixture(); await fs.writeFile(f.file, '{ daño'); await (await f.store.prepareRecovery(() => {})).commit();
    await f.permission.reset(f.origin);
    expect(await fs.readdir(f.root)).toEqual([path.basename(f.file)]);
    await fs.unlink(f.file); await expect(f.store.prepareRecovery(() => {})).rejects.toThrow();
  });
  it('el contrato IPC no acepta paths, confirmación, claves o un store no autorizado', () => {
    const input = { store: 'privacy', profileRevision: 1 };
    expect(validatePolicyRecoveryRequest(input)).toEqual(input);
    for (const bad of [{ ...input, path: 'x' }, { ...input, approved: true }, { ...input, store: 'sync' }, { ...input, profileRevision: -1 }, { ...input, store: '__proto__' }, { ...input, store: ['privacy'] }, { ...input, store: ['permissions'] }]) expect(() => validatePolicyRecoveryRequest(bad)).toThrow();
  });
  it.each(['permissions', 'privacy', 'agent'] as const)('flush de %s espera la publicación de una recuperación en curso', async kind => {
    const f = await fixture(kind); await fs.writeFile(f.file, '{ daño');
    const review = await f.store.prepareRecovery(() => {});
    const rename = fs.rename.bind(fs); let release!: () => void;
    vi.spyOn(fs, 'rename').mockImplementationOnce(async (source, target) => {
      await new Promise<void>(resolve => { release = resolve; }); await rename(source, target);
    });
    const commit = review.commit(); let flushed = false;
    try {
      await vi.waitFor(() => expect(release).toBeTypeOf('function'));
      const flush = f.store.flush().then(() => { flushed = true; });
      await new Promise(resolve => setImmediate(resolve)); expect(flushed).toBe(false);
      release(); await commit; await flush; expect(flushed).toBe(true);
    } finally { release?.(); await commit; }
  });
  it('las políticas administradas recuperadas siguen bloqueadas y no editables', async () => {
    const f = await fixture('agent'); const stored = JSON.parse(await fs.readFile(f.file, 'utf8'));
    stored.policies[0].managed = true; stored.policies[0].decision = 'allow-always';
    await fs.writeFile(f.file, JSON.stringify(stored));
    await f.agent.set({ origin: 'https://otro.example', mode: 'strict', decision: 'ask' });
    await fs.writeFile(f.file, '{ daño'); await (await f.agent.prepareRecovery(() => {})).commit();
    expect(await f.agent.get(f.origin)).toMatchObject({ managed: true, mode: 'strict', decision: 'block' });
    await expect(f.agent.set({ origin: f.origin, mode: 'balanced', decision: 'allow-always' })).rejects.toThrow('administrada');
  });
  it('la cuota de cinco copias dañadas preserva el principal y no borra evidencia anterior', async () => {
    const f = await fixture();
    for (let index = 0; index < 5; index++) {
      await fs.writeFile(f.file, `{ daño ${index}`); await (await f.store.prepareRecovery(() => {})).commit();
    }
    const before = await fs.readdir(f.root); await fs.writeFile(f.file, '{ sexto daño');
    await expect((await f.store.prepareRecovery(() => {})).commit()).rejects.toThrow();
    expect(await fs.readFile(f.file, 'utf8')).toBe('{ sexto daño'); expect(await fs.readdir(f.root)).toEqual(before);
  });
  it('no presenta falso fallo ni borra el original protegido si falla limpiar un temporal ya publicado', async () => {
    const f = await fixture(); await fs.writeFile(f.file, '{ daño');
    const unlink = fs.unlink.bind(fs); let failOnce = true;
    vi.spyOn(fs, 'unlink').mockImplementation(async target => {
      if (failOnce && String(target).endsWith('.tmp')) { failOnce = false; throw new Error('No se pudo limpiar'); }
      await unlink(target);
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await (await f.store.prepareRecovery(() => {})).commit();
    expect(await f.permission.resolve(f.origin, 'camera')).toBe('ask');
    expect((await fs.readdir(f.root)).filter(name => name.endsWith('.bin') && name.includes('.damaged-'))).toHaveLength(1);
    expect(warning).toHaveBeenCalledWith(expect.not.stringContaining(f.root));
  });
});
