import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { safeStorage } from 'electron';
import { BrowserHistoryStore } from '../integrated-browser/browser-history-store';
import { BrowserAgentAuditStore } from '../integrated-browser/agent-audit-store';
import { sqliteBackupPath } from '../integrated-browser/sqlite-store-recovery';
import { failRecoveryPublication } from './helpers/recovery-publication-faults';

let root: string;
const histories: BrowserHistoryStore[] = [];
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-sqlite-recovery-')); vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true); });
afterEach(async () => { vi.restoreAllMocks(); vi.useRealTimers(); await Promise.all(histories.splice(0).map(store => store.flushAndClose())); fs.rmSync(root, { recursive: true, force: true }); });
async function fixture(kind: 'history' | 'audit') {
  const file = path.join(root, `${kind}.sqlite`); const history = new BrowserHistoryStore(file, null); histories.push(history);
  const audit = new BrowserAgentAuditStore(file); const store = kind === 'history' ? history : audit;
  const add = async (host = 'uno.example', at = Date.now()) => {
    if (kind === 'history') await history.record({ url: `https://${host}/`, title: 'Astronomía', visitedAt: new Date(at).toISOString() });
    else audit.record({ traceId: randomUUID(), tabId: 'tab', url: `https://${host}/`, operation: 'dom', result: 'completed' });
  };
  await add();
  return { file, store, history, audit, add, close: () => history.flushAndClose(), count: async () => kind === 'history' ? (await history.list()).length : audit.list().total };
}
describe.each(['history', 'audit'] as const)('recuperación SQLite de %s', kind => {
  it.each(['unlink', 'close'] as const)('preserva el fallo primario cuando también falla %s', async secondary => {
    const f = await fixture(kind); await f.close(); fs.writeFileSync(f.file, 'daño');
    const before = fs.readFileSync(f.file), backup = fs.readFileSync(sqliteBackupPath(f.file));
    const review = await f.store.prepareRecovery(() => {}), fault = failRecoveryPublication(f.file, secondary);
    await expect(review.commit()).rejects.toBe(fault.primary);
    expect(fs.readFileSync(f.file)).toEqual(before); expect(fs.readFileSync(sqliteBackupPath(f.file))).toEqual(backup);
    expect(fault.warning).toHaveBeenCalled();
    expect(JSON.stringify(fault.warning.mock.calls)).not.toContain(JSON.stringify(f.file).slice(1, -1));
    expect(JSON.stringify(fault.warning.mock.calls)).not.toMatch(/Publicación ficticia|Recurso ficticio/);
    expect(fs.readdirSync(root).some(name => name.includes('.damaged-') && name.endsWith('.bin'))).toBe(false);
  });

  it('no elimina una cuarentena ajena cuando falla su publicación exclusiva', async () => {
    const f = await fixture(kind); await f.close(); fs.writeFileSync(f.file, 'daño');
    const before = fs.readFileSync(f.file), backup = fs.readFileSync(sqliteBackupPath(f.file));
    const review = await f.store.prepareRecovery(() => {}), link = fs.linkSync;
    let foreign = '';
    vi.spyOn(fs, 'linkSync').mockImplementation((source, destination) => {
      if (String(destination).includes('.damaged-')) {
        foreign = String(destination); fs.writeFileSync(foreign, 'cuarentena ajena', { flag: 'wx' });
        throw Object.assign(new Error('Destino ocupado'), { code: 'EEXIST' });
      }
      return link(source, destination);
    });
    await expect(review.commit()).rejects.toMatchObject({ code: 'EEXIST' });
    expect(foreign).not.toBe(''); expect(fs.readFileSync(foreign, 'utf8')).toBe('cuarentena ajena');
    expect(fs.readFileSync(f.file)).toEqual(before); expect(fs.readFileSync(sqliteBackupPath(f.file))).toEqual(backup);
    expect(fs.readdirSync(root).some(name => name.endsWith('.tmp'))).toBe(false);
  });

  it('una limpieza de cuarentena denegada no reemplaza el error de publicación', async () => {
    const f = await fixture(kind); await f.close(); fs.writeFileSync(f.file, 'daño');
    const before = fs.readFileSync(f.file), review = await f.store.prepareRecovery(() => {});
    const original = Object.assign(new Error('Publicación interrumpida'), { code: 'EIO' }), unlink = fs.unlinkSync;
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw original; });
    vi.spyOn(fs, 'unlinkSync').mockImplementation(target => {
      if (String(target).includes('.damaged-') && String(target).endsWith('.bin')) throw Object.assign(new Error('Limpieza denegada'), { code: 'EACCES' });
      return unlink(target);
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(review.commit()).rejects.toBe(original); expect(fs.readFileSync(f.file)).toEqual(before);
    const copies = fs.readdirSync(root).filter(name => name.includes('.damaged-') && name.endsWith('.bin'));
    expect(copies).toHaveLength(1);
    expect(JSON.parse(safeStorage.decryptString(fs.readFileSync(path.join(root, copies[0])))).scope).toBe(f.file);
    expect(warning).toHaveBeenCalledOnce(); expect(JSON.stringify(warning.mock.calls)).not.toContain(root);
  });

  it('no recupera con el reloj civil atrasado después del plazo monotónico', async () => {
    let elapsed = 0n; vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => elapsed);
    const f = await fixture(kind); await f.close(); fs.writeFileSync(f.file, 'daño');
    const before = fs.readFileSync(f.file), backup = fs.readFileSync(sqliteBackupPath(f.file));
    const review = await f.store.prepareRecovery(() => {});
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() - 3_600_000); elapsed = 300_001_000_000n;
    await expect(Promise.resolve().then(() => review.commit())).rejects.toThrow();
    expect(fs.readFileSync(f.file)).toEqual(before); expect(fs.readFileSync(sqliteBackupPath(f.file))).toEqual(backup);
    expect(fs.readdirSync(root).some(name => name.includes('.damaged-'))).toBe(false);
  });

  it('revalida el plazo después de una proyección SQLite lenta', async () => {
    let elapsed = 0n; vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => elapsed);
    const f = await fixture(kind); await f.close(); fs.writeFileSync(f.file, 'daño');
    const before = fs.readFileSync(f.file), review = await f.store.prepareRecovery(() => {});
    const exec = DatabaseSync.prototype.exec;
    vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: DatabaseSync, sql: string) {
      const result = exec.call(this, sql); if (sql === 'VACUUM') elapsed = 300_001_000_000n; return result;
    });
    await expect(Promise.resolve().then(() => review.commit())).rejects.toThrow();
    expect(fs.readFileSync(f.file)).toEqual(before);
    expect(fs.readdirSync(root).some(name => name.includes('.damaged-') || name.endsWith('.tmp'))).toBe(false);
  });

  it('respalda una instantánea consistente y recupera sin alterar el original antes del commit', async () => {
    const f = await fixture(kind);
    // Probar la primera generación dentro de sus 30 s; mtime puede tener
    // fracciones de ms y diferir del reloj de pared bajo carga.
    vi.spyOn(Date, 'now').mockReturnValue(Math.ceil(fs.statSync(sqliteBackupPath(f.file)).mtimeMs) + 1000);
    await f.add('dos.example'); await f.close();
    const backup = fs.readFileSync(sqliteBackupPath(f.file));
    expect(JSON.parse(safeStorage.decryptString(backup)).scope).toBe(f.file);
    fs.writeFileSync(f.file, 'dañado'); const review = await f.store.prepareRecovery(() => {});
    expect(review.count).toBe(1); expect(fs.readFileSync(f.file, 'utf8')).toBe('dañado');
    await review.commit(); expect(await f.count()).toBe(1);
    if (kind === 'history') expect(await f.history.list({ query: 'astronomia' })).toHaveLength(1);
    expect(fs.readdirSync(root).filter(name => name.includes('.damaged-'))).toHaveLength(1);
  });
  it('principal ausente exige recuperación; no se crea vacío al consultar', async () => {
    const f = await fixture(kind); await f.close(); fs.unlinkSync(f.file);
    await expect(f.count()).rejects.toThrow(); expect(fs.existsSync(f.file)).toBe(false);
    await (await f.store.prepareRecovery(() => {})).commit(); expect(await f.count()).toBe(1);
  });
  it('borrar elimina visitas/eventos también de copias y cuarentenas antes del siguiente respaldo', async () => {
    const f = await fixture(kind); await f.close(); fs.writeFileSync(f.file, 'dañado');
    await (await f.store.prepareRecovery(() => {})).commit(); await f.store.clear();
    expect(await f.count()).toBe(0); expect(fs.readdirSync(root).some(name => name.includes('.damaged-'))).toBe(false);
    await f.close(); fs.writeFileSync(f.file, 'dañado otra vez');
    const review = await f.store.prepareRecovery(() => {}); expect(review.count).toBe(0); await review.commit(); expect(await f.count()).toBe(0);
  });
  it('fallo al retirar respaldo aborta el borrado antes de cambiar registros', async () => {
    const f = await fixture(kind); const unlink = fs.unlinkSync;
    vi.spyOn(fs, 'unlinkSync').mockImplementation(file => { if (String(file) === sqliteBackupPath(f.file)) throw new Error('ocupado'); unlink(file); });
    await expect(Promise.resolve().then(() => f.store.clear())).rejects.toThrow(); expect(await f.count()).toBe(1);
  });
  it.each(['sano', 'futuro', 'ajeno', 'WAL', 'sin respaldo'])('no reemplaza principal %s', async mode => {
    const f = await fixture(kind); await f.close();
    if (mode === 'futuro') { const db = new DatabaseSync(f.file); db.exec('PRAGMA user_version=2'); db.close(); }
    if (mode === 'ajeno') { const db = new DatabaseSync(f.file); db.exec('CREATE TABLE ajena(id INTEGER)'); db.close(); }
    if (mode === 'WAL') { fs.writeFileSync(f.file, 'dañado'); fs.writeFileSync(f.file + '-wal', 'pendiente'); }
    if (mode === 'sin respaldo') { fs.unlinkSync(sqliteBackupPath(f.file)); fs.writeFileSync(f.file, 'dañado'); }
    const before = fs.readFileSync(f.file);
    await expect(Promise.resolve().then(() => f.store.prepareRecovery(() => {}))).rejects.toThrow(); expect(fs.readFileSync(f.file).equals(before)).toBe(true);
  });
  it.each(['principal', 'respaldo', 'contexto', 'vencimiento', 'publicación'])('rechaza %s cambiado durante confirmación', async mode => {
    const f = await fixture(kind); await f.close(); fs.writeFileSync(f.file, 'dañado');
    const guard = vi.fn(); const review = await f.store.prepareRecovery(guard);
    if (mode === 'principal') fs.writeFileSync(f.file, 'otra generación');
    if (mode === 'respaldo') fs.writeFileSync(sqliteBackupPath(f.file), 'otra copia');
    if (mode === 'contexto') guard.mockImplementation(() => { throw new Error('otro perfil'); });
    if (mode === 'vencimiento') { vi.useFakeTimers(); vi.setSystemTime(Date.now() + 300001); }
    if (mode === 'publicación') vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('disco'); });
    const before = fs.readFileSync(f.file); await expect(review.commit()).rejects.toThrow();
    expect(fs.readFileSync(f.file).equals(before)).toBe(true); expect(fs.readdirSync(root).some(name => name.includes('.damaged-'))).toBe(false);
  });
  it('retención se aplica también al respaldo antiguo después de adelantar el reloj', async () => {
    const f = await fixture(kind); await f.store.setRetention(30); await f.close();
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 31 * 86_400_000); fs.writeFileSync(f.file, 'dañado');
    const review = await f.store.prepareRecovery(() => {}); expect(review.count).toBe(0); await review.commit(); expect(await f.count()).toBe(0);
  });
  it('rotación posterior incluye nuevas entradas y no reutiliza otra ruta', async () => {
    const f = await fixture(kind); fs.utimesSync(sqliteBackupPath(f.file), new Date(0), new Date(0)); await f.add('dos.example'); await f.close();
    fs.writeFileSync(f.file, 'dañado'); const review = await f.store.prepareRecovery(() => {}); expect(review.count).toBe(2);
    const other = path.join(root, `otro-${kind}.sqlite`); fs.copyFileSync(sqliteBackupPath(f.file), sqliteBackupPath(other)); fs.writeFileSync(other, 'dañado');
    const otherStore = kind === 'history' ? new BrowserHistoryStore(other, null) : new BrowserAgentAuditStore(other);
    if (otherStore instanceof BrowserHistoryStore) histories.push(otherStore);
    await expect(Promise.resolve().then(() => otherStore.prepareRecovery(() => {}))).rejects.toThrow();
  });
});
