import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import { BrowserSemanticMemory, type SemanticContext, type SemanticEmbedder } from '../integrated-browser/semantic-memory';
import { BrowserSemanticMemoryStore, normalizeSemanticVector, semanticSource } from '../integrated-browser/semantic-memory-store';
import { validateBrowserSemanticRequest, type BrowserSemanticSource } from '../../src/shared/browser-semantic-memory';
import { semanticRecoveryPath } from '../integrated-browser/semantic-memory-recovery';

const vector = (index = 0) => Array.from({ length: 768 }, (_, i) => Number(i === index));
const source = (id = '1', source: 'history' | 'bookmark' = 'history'): BrowserSemanticSource => ({ id, source, title: 'Astronomía', url: 'https://example.com/cielo?token=privado#secreto' });
const request = (action: 'status' | 'enable' | 'disable' | 'rebuild' | 'cancel') => ({ action, profileRevision: 1 });
let directory: string; let file: string; let store: BrowserSemanticMemoryStore; let memory: BrowserSemanticMemory;
let context: SemanticContext; let entries: BrowserSemanticSource[]; let embed: ReturnType<typeof vi.fn<SemanticEmbedder>>;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-semantic-')); file = path.join(directory, 'memory.sqlite');
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
  store = new BrowserSemanticMemoryStore(); vi.spyOn(store, 'path').mockReturnValue(file);
  entries = [source(), source('2', 'bookmark')];
  context = { guard: vi.fn(), sources: vi.fn(async () => entries), confirm: vi.fn(async () => true) };
  embed = vi.fn(async (texts: string[]) => texts.map(() => vector())); memory = new BrowserSemanticMemory(store, embed);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); fs.rmSync(directory, { recursive: true, force: true }); });

describe('memoria semántica opt-in', () => {
  it('no consulta fuentes ni proveedor sin consentimiento, y cancelar no activa', async () => {
    expect(await memory.run(request('status'), context)).toMatchObject({ status: { enabled: false, count: 0 } });
    await expect(memory.run(request('rebuild'), context)).rejects.toThrow('consentimiento');
    vi.mocked(context.confirm).mockResolvedValueOnce(false);
    expect(await memory.run(request('enable'), context)).toMatchObject({ canceled: true });
    expect(embed).not.toHaveBeenCalled(); expect(context.sources).not.toHaveBeenCalled();
  });
  it('reconstruye y busca vectores con fuentes, sin parámetros, valores ni contenido', async () => {
    await memory.run(request('enable'), context);
    expect(embed).not.toHaveBeenCalled();
    expect(await memory.run(request('rebuild'), context)).toMatchObject({ status: { count: 2 } });
    expect(embed.mock.calls[0][0]).toEqual(['Astronomía\nhttps://example.com/cielo', 'Astronomía\nhttps://example.com/cielo']);
    const result = await memory.run({ action: 'search', query: 'estrellas', profileRevision: 1 }, context);
    expect(result.results).toHaveLength(2); expect(result.results?.[0]).toMatchObject({ source: 'history', url: 'https://example.com/cielo', score: 1 });
    expect(result.results?.[0]).not.toHaveProperty('vector'); expect(JSON.stringify(result)).not.toContain('privado');
    expect(new BrowserSemanticMemoryStore().read(file).entries).toHaveLength(2);
    expect(safeStorage.encryptString).toHaveBeenCalled(); // Doble de SO: no acredita DPAPI nativo.
  });
  it('elimina del índice fuentes borradas o editadas durante la consulta', async () => {
    await memory.run(request('enable'), context); await memory.run(request('rebuild'), context);
    embed.mockImplementationOnce(async () => { entries = [{ ...source(), title: 'Nuevo título' }]; return [vector()]; });
    expect((await memory.run({ action: 'search', query: 'cielo', profileRevision: 1 }, context)).results).toEqual([]);
    expect(store.read(file).entries).toEqual([]);
  });
  it('cuotas, duplicados, esquemas y vectores inválidos se rechazan o acotan', async () => {
    entries = [...Array.from({ length: 250 }, (_, i) => source(String(i))), ...Array.from({ length: 250 }, (_, i) => source(String(i), 'bookmark'))];
    await memory.run(request('enable'), context); await memory.run(request('rebuild'), context);
    expect(store.read(file).entries).toHaveLength(400); expect(embed).toHaveBeenCalledTimes(13);
    expect(semanticSource({ ...source(), url: 'https://user:password@example.com/' })).toBeNull();
    expect(semanticSource({ ...source(), url: 'file:///privado' })).toBeNull();
    expect(() => normalizeSemanticVector([1])).toThrow(); expect(() => normalizeSemanticVector(Array(768).fill(0))).toThrow();
    expect(() => normalizeSemanticVector(Array(768).fill(Infinity))).toThrow();
  });
  it.each([null, {}, { action: 'status', profileRevision: -1 }, { action: 'enable', profileRevision: 1, approved: true }, { action: 'search', profileRevision: 1, query: ' ' }, { action: 'search', profileRevision: 1, query: 'x'.repeat(501) }])('rechaza el contrato inválido %# antes de E/S', raw => {
    expect(() => validateBrowserSemanticRequest(raw)).toThrow(); expect(fs.existsSync(file)).toBe(false);
  });
  it('fallo parcial y cambio de contexto conservan el índice previo', async () => {
    await memory.run(request('enable'), context); await memory.run(request('rebuild'), context); const before = store.read(file);
    embed.mockRejectedValueOnce(new Error('clave privada proveedor'));
    await expect(memory.run(request('rebuild'), context)).rejects.toThrow(); expect(store.read(file)).toEqual(before);
    embed.mockImplementationOnce(async () => { vi.mocked(context.guard).mockImplementation(() => { throw new Error('Perfil cambiado'); }); return [vector(), vector()]; });
    await expect(memory.run(request('rebuild'), context)).rejects.toThrow('Perfil'); expect(store.read(file)).toEqual(before);
  });
  it('cancelación libera la exclusión aunque el proveedor tarde y descarta su respuesta', async () => {
    await memory.run(request('enable'), context);
    let resolve!: (value: number[][]) => void;
    embed.mockImplementationOnce(() => new Promise<number[][]>(done => { resolve = done; }));
    const task = memory.run(request('rebuild'), context); const rejected = expect(task).rejects.toThrow('cancelada');
    await vi.waitFor(() => expect(embed).toHaveBeenCalled());
    await expect(memory.run(request('rebuild'), context)).rejects.toThrow('pendiente');
    await memory.run(request('cancel'), context); await rejected;
    resolve([vector(), vector()]); await Promise.resolve();
    expect(store.read(file).entries).toEqual([]); expect((await memory.run(request('status'), context)).status?.busy).toBe(false);
  });
  it('retención y borrado con HITL eliminan sólo el índice', async () => {
    await memory.run(request('enable'), context); await memory.run(request('rebuild'), context);
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 31 * 86_400_000);
    expect((await memory.run(request('status'), context)).status).toMatchObject({ enabled: true, count: 0, indexedAt: null });
    await memory.run(request('disable'), context);
    expect(context.confirm).toHaveBeenLastCalledWith('disable'); expect(entries).toHaveLength(2);
    expect(store.read(file)).toEqual({ enabled: false, entries: [], indexedAt: null });
  });
  it('una confirmación vencida no activa memoria aunque el reloj salte al despertar', async () => {
    const initial = Date.now(); vi.useFakeTimers(); vi.setSystemTime(initial);
    vi.mocked(context.confirm).mockImplementationOnce(async () => { vi.setSystemTime(initial + 120001); return true; });
    await expect(memory.run(request('enable'), context)).rejects.toThrow('vencida');
    expect(store.read(file).enabled).toBe(false); expect(embed).not.toHaveBeenCalled();
  });
  it('falla cerrado ante otro perfil, corrupción, versión futura o SO sin cifrado', async () => {
    await memory.run(request('enable'), context);
    const other = path.join(directory, 'other.sqlite'); fs.copyFileSync(file, other);
    expect(() => store.read(other)).toThrow('cifrada');
    const db = new DatabaseSync(file); db.exec('PRAGMA user_version=2'); db.close(); const bytes = fs.readFileSync(file);
    expect(() => store.read(file)).toThrow('cifrada'); expect(fs.readFileSync(file)).toEqual(bytes);
    fs.writeFileSync(other, 'corrupto'); expect(() => store.read(other)).toThrow('cifrada');
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false); expect(() => store.read(file)).toThrow('cifrada');
  });
  it('no migra una base desconocida ni cambia sus bytes al rechazarla', () => {
    const db = new DatabaseSync(file); db.exec('CREATE TABLE unrelated (id INTEGER)'); db.close();
    const bytes = fs.readFileSync(file);
    expect(() => store.read(file)).toThrow('cifrada'); expect(fs.readFileSync(file)).toEqual(bytes);
  });
  it('recupera corrupción SQLite sin fuentes ni activación y conserva el original cifrado', async () => {
    await memory.run(request('enable'), context); await memory.run(request('rebuild'), context);
    const backup = fs.readFileSync(semanticRecoveryPath(file));
    expect(backup.includes(Buffer.from('Astronomía'))).toBe(false);
    fs.writeFileSync(file, 'índice roto'); const review = memory.prepareRecovery(context.guard);
    expect(fs.readFileSync(file, 'utf8')).toBe('índice roto');
    embed.mockClear(); vi.mocked(context.sources).mockClear();
    await review.commit(); expect(store.read(file)).toEqual({ enabled: false, indexedAt: null, entries: [] });
    expect(embed).not.toHaveBeenCalled(); expect(context.sources).not.toHaveBeenCalled();
    const damaged = fs.readdirSync(directory).find(name => name.startsWith('memory.sqlite.damaged-'))!;
    expect(JSON.parse(safeStorage.decryptString(fs.readFileSync(path.join(directory, damaged)))).data).toBe(Buffer.from('índice roto').toString('base64'));
    await expect(review.commit()).rejects.toThrow();
    await memory.run(request('enable'), context);
    expect(fs.readdirSync(directory).some(name => name.includes('.damaged-'))).toBe(false);
    expect(fs.readFileSync(semanticRecoveryPath(file))).toEqual(backup);
  });
  it('principal ausente con respaldo exige recuperación explícita', async () => {
    await memory.run(request('enable'), context); fs.unlinkSync(file);
    expect(() => store.read(file)).toThrow(); expect(fs.existsSync(file)).toBe(false);
    expect(() => store.write(file, { enabled: true, entries: [], indexedAt: null }, context.guard)).toThrow();
    await memory.prepareRecovery(context.guard).commit(); expect(store.read(file).enabled).toBe(false);
  });
  it.each(['sano', 'futuro', 'ajeno', 'otra tabla', 'sin copia', 'WAL', 'cuota'])('no restablece índice %s', async mode => {
    await memory.run(request('enable'), context);
    if (mode === 'futuro') { const db = new DatabaseSync(file); db.exec('PRAGMA user_version=2'); db.close(); }
    if (mode === 'ajeno') { const db = new DatabaseSync(file); db.prepare('UPDATE snapshot SET payload=?').run(safeStorage.encryptString(JSON.stringify({ scope: 'otro', snapshot: { enabled: true, entries: [], indexedAt: null } }))); db.close(); }
    if (mode === 'otra tabla') { const db = new DatabaseSync(file); db.exec('CREATE TABLE ajena(id INTEGER)'); db.close(); }
    if (mode === 'sin copia') { fs.unlinkSync(semanticRecoveryPath(file)); fs.writeFileSync(file, 'roto'); }
    if (mode === 'WAL') { fs.writeFileSync(file, 'roto'); fs.writeFileSync(`${file}-wal`, 'pendiente'); }
    if (mode === 'cuota') fs.writeFileSync(file, Buffer.alloc(16 * 1024 * 1024 + 1));
    const before = fs.readFileSync(file);
    expect(() => memory.prepareRecovery(context.guard)).toThrow(); expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect(fs.readdirSync(directory).some(name => name.includes('.damaged-'))).toBe(false);
  });
  it.each(['principal', 'copia', 'contexto', 'vencido', 'rename'])('no publica una recuperación con %s cambiado', async mode => {
    await memory.run(request('enable'), context); fs.writeFileSync(file, 'roto');
    const review = memory.prepareRecovery(context.guard);
    if (mode === 'principal') fs.writeFileSync(file, 'cambió');
    if (mode === 'copia') fs.writeFileSync(semanticRecoveryPath(file), 'otra copia');
    if (mode === 'contexto') vi.mocked(context.guard).mockImplementation(() => { throw new Error('otro perfil'); });
    if (mode === 'vencido') { vi.useFakeTimers(); vi.setSystemTime(Date.now() + 300001); }
    if (mode === 'rename') vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('disco'); });
    const before = fs.readFileSync(file); await expect(review.commit()).rejects.toThrow();
    expect(fs.readFileSync(file)).toEqual(before);
    expect(fs.readdirSync(directory).some(name => name.includes('.damaged-'))).toBe(false);
  });
  it('payload dañado requiere recuperación; escribir no encubre el daño', async () => {
    await memory.run(request('enable'), context);
    const db = new DatabaseSync(file); db.prepare('UPDATE snapshot SET payload=?').run(Buffer.from('dañado')); db.close();
    const before = fs.readFileSync(file);
    expect(() => store.write(file, { enabled: true, entries: [], indexedAt: null }, context.guard)).toThrow(); expect(fs.readFileSync(file)).toEqual(before);
    await memory.prepareRecovery(context.guard).commit(); expect(store.read(file).enabled).toBe(false);
  });
  it('respaldo de otro archivo no se acepta aunque use el mismo usuario del SO', async () => {
    await memory.run(request('enable'), context);
    const other = path.join(directory, 'other.sqlite'); store.write(other, { enabled: true, entries: [], indexedAt: null }, context.guard);
    fs.copyFileSync(semanticRecoveryPath(other), semanticRecoveryPath(file)); fs.writeFileSync(file, 'roto');
    expect(() => memory.prepareRecovery(context.guard)).toThrow(); expect(fs.readFileSync(file, 'utf8')).toBe('roto');
  });
  it('dos revisiones no publican dos recuperaciones del mismo daño', async () => {
    await memory.run(request('enable'), context); fs.writeFileSync(file, 'roto');
    const first = memory.prepareRecovery(context.guard); const second = memory.prepareRecovery(context.guard);
    await first.commit(); await expect(second.commit()).rejects.toThrow();
    expect(fs.readdirSync(directory).filter(name => name.includes('.damaged-'))).toHaveLength(1);
  });
  it.each(['cifrado', 'acceso'])('recuperación rechaza fallo de %s sin crear otra base', async mode => {
    await memory.run(request('enable'), context); fs.writeFileSync(file, 'roto');
    if (mode === 'cifrado') vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    else vi.spyOn(fs, 'lstatSync').mockImplementation(() => { throw Object.assign(new Error('privado'), { code: 'EACCES' }); });
    expect(() => memory.prepareRecovery(context.guard)).toThrow(); expect(fs.readFileSync(file, 'utf8')).toBe('roto');
  });
  it('fallar la limpieza tras publicar no informa que falló recuperar', async () => {
    await memory.run(request('enable'), context); fs.writeFileSync(file, 'roto');
    const review = memory.prepareRecovery(context.guard); const unlink = fs.unlinkSync;
    vi.spyOn(fs, 'unlinkSync').mockImplementation(target => {
      if (String(target).endsWith('.tmp') && fs.readFileSync(file).subarray(0, 6).toString() === 'SQLite') throw new Error('ocupado');
      unlink(target);
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await review.commit(); expect(store.read(file).enabled).toBe(false); expect(warning).toHaveBeenCalledOnce();
  });
});
