import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserSyncConflictStore } from '../integrated-browser/sync-conflict-store';

const roots: string[] = [];
beforeEach(() => { vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true); });
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });
const current = () => undefined;
const source = () => ({ category: 'bookmarks', baseRevision: 1, remoteRevision: 2,
  base: [{ id: 'b', url: 'https://example.com/', title: 'Base' }],
  local: [{ id: 'b', url: 'https://example.com/', title: 'Título local' }],
  remote: [{ id: 'b', url: 'https://example.com/', title: 'Título remoto' }],
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-sync-conflicts-'));
  roots.push(root);
  const destination = path.join(root, 'profile-a', 'sync-conflicts.json');
  return { root, destination, store: new BrowserSyncConflictStore(destination) };
}

describe('Diario cifrado de conflictos de sync', () => {
  it('persiste revisión y decisiones tras reabrir sin metadata legible', async () => {
    const { store, destination } = await fixture();
    const review = await store.prepare(source(), current);
    const text = await fs.readFile(destination, 'utf8');
    expect(text).not.toContain('Título');
    expect(text).not.toContain('example.com');
    expect(safeStorage.encryptString).toHaveBeenCalled();
    const reopened = new BrowserSyncConflictStore(destination);
    expect(await reopened.list()).toEqual([review]);
    const resolved = await reopened.resolve(review.reviewId, [{ conflictId: review.conflicts[0].id, side: 'remote' }], current);
    expect(resolved.status).toBe('ready');
    expect(await new BrowserSyncConflictStore(destination).list()).toEqual([resolved]);
    expect((await store.prepare(source(), current)).status).toBe('ready');
    await store.acknowledge(review.reviewId, 3, current);
    expect(await reopened.list()).toEqual([]);
  });

  it('no sobrescribe otra revisión pendiente de la misma categoría', async () => {
    const { store, destination } = await fixture();
    await store.prepare(source(), current);
    const before = await fs.readFile(destination, 'utf8');
    await expect(store.prepare({ ...source(), remoteRevision: 3 }, current)).rejects.toThrow('pendiente');
    expect(await fs.readFile(destination, 'utf8')).toBe(before);
  });

  it('retiene todas las categorías y serializa escritores del mismo archivo', async () => {
    const { store, destination } = await fixture();
    const other = new BrowserSyncConflictStore(destination);
    await Promise.all([
      store.prepare(source(), current), other.prepare({ category: 'settings', baseRevision: 0, remoteRevision: 1, base: {}, local: { theme: 'dark' }, remote: { tabLayout: 'vertical' } }, current),
      store.prepare({ category: 'groups', baseRevision: 0, remoteRevision: 1, base: [], local: [{ id: 'g', name: 'Grupo' }], remote: [] }, current),
      other.prepare({ category: 'tabs', baseRevision: 0, remoteRevision: 1, base: [], local: [], remote: [] }, current),
    ]);
    await store.flush();
    expect(await other.list()).toHaveLength(4);
  });

  it('no retira decisiones pendientes ni acepta revisiones de commit inválidas', async () => {
    const { store, destination } = await fixture();
    const review = await store.prepare(source(), current);
    await expect(store.acknowledge(review.reviewId, 3, current)).rejects.toThrow('pendiente');
    await store.resolve(review.reviewId, [{ conflictId: review.conflicts[0].id, side: 'local' }], current);
    const before = await fs.readFile(destination, 'utf8');
    for (const revision of [2, 4, NaN, Infinity, 2.5]) await expect(store.acknowledge(review.reviewId, revision, current)).rejects.toThrow('commit');
    await expect(store.acknowledge('ajeno', 3, current)).rejects.toThrow('disponible');
    expect(await fs.readFile(destination, 'utf8')).toBe(before);
  });

  it('rechaza una decisión obsoleta sin perder el pendiente', async () => {
    const { store, destination } = await fixture();
    const review = await store.prepare(source(), current);
    const before = await fs.readFile(destination, 'utf8');
    await expect(store.resolve('otra-revisión', [], current)).rejects.toThrow('disponible');
    await expect(store.resolve(review.reviewId, [{ conflictId: 'ajeno', side: 'local' }], current)).rejects.toThrow('no pertenece');
    expect(await fs.readFile(destination, 'utf8')).toBe(before);
  });

  it('preserva principal ante fallo de rename y no deja temporales propios', async () => {
    const { store, destination } = await fixture();
    const review = await store.prepare(source(), current);
    const before = await fs.readFile(destination, 'utf8');
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('EACCES ruta privada'));
    await expect(store.resolve(review.reviewId, [{ conflictId: review.conflicts[0].id, side: 'local' }], current)).rejects.toThrow('Se conserva');
    expect(await fs.readFile(destination, 'utf8')).toBe(before);
    expect(await fs.readdir(path.dirname(destination))).toEqual(['sync-conflicts.json']);
  });

  it.each(['corrupto', '{"version":2,"protectedData":"YQ=="}'])('falla cerrado con formato inválido %#', async (bad) => {
    const { store, destination } = await fixture();
    await store.prepare(source(), current);
    await fs.writeFile(destination, bad);
    await expect(store.list()).rejects.toThrow('Se conserva');
    await expect(store.prepare(source(), current)).rejects.toThrow('Se conserva');
    expect(await fs.readFile(destination, 'utf8')).toBe(bad);
  });

  it('detecta copia de ciphertext a otro perfil', async () => {
    const { store, root, destination } = await fixture();
    await store.prepare(source(), current);
    const other = path.join(root, 'profile-b', 'sync-conflicts.json');
    await fs.mkdir(path.dirname(other), { recursive: true });
    await fs.copyFile(destination, other);
    await expect(new BrowserSyncConflictStore(other).list()).rejects.toThrow('Se conserva');
  });

  it('falla cerrado si el almacén del SO no está disponible', async () => {
    const { store, destination } = await fixture();
    vi.spyOn(safeStorage, 'isEncryptionAvailable').mockReturnValue(false);
    await expect(store.prepare(source(), current)).rejects.toThrow('seguro');
    await expect(store.list()).rejects.toThrow('seguro');
    await expect(fs.stat(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('captura destino e input antes de esperar y evita commit con contexto obsoleto', async () => {
    const { destination, root } = await fixture();
    let selected = destination;
    const store = new BrowserSyncConflictStore(() => selected);
    const original = source();
    const pending = store.prepare(original, current);
    original.local[0].title = 'No debe entrar';
    selected = path.join(root, 'profile-b', 'sync-conflicts.json');
    const review = await pending;
    expect(review.conflicts[0].local).toEqual({ present: true, value: 'Título local' });
    expect(await store.list()).toEqual([]);
    selected = destination;
    const before = await fs.readFile(destination, 'utf8');
    let checks = 0;
    const guard = () => { if (++checks >= 3) throw new Error('El contexto de sincronización cambió.'); };
    await expect(store.resolve(review.reviewId, [{ conflictId: review.conflicts[0].id, side: 'remote' }], guard)).rejects.toThrow('contexto');
    expect(await fs.readFile(destination, 'utf8')).toBe(before);
  });

  it('reconcilia un CAS posterior sin reutilizar decisiones antiguas', async () => {
    const { store, destination } = await fixture();
    const review = await store.prepare(source(), current);
    const choice = { conflictId: review.conflicts[0].id, side: 'local' as const };
    await store.resolve(review.reviewId, [choice], current);
    const remote = { category: 'bookmarks' as const, revision: 3, payload: [{ id: 'b', url: 'https://example.com/', title: 'Remoto posterior' }] };
    const rebased = await store.rebase(review.reviewId, remote, current);
    expect(rebased).toMatchObject({ status: 'conflict', baseRevision: 2, remoteRevision: 3 });
    expect(rebased.reviewId).not.toBe(review.reviewId);
    expect(rebased.conflicts[0]).toMatchObject({ local: { present: true, value: 'Título local' }, remote: { present: true, value: 'Remoto posterior' } });
    await expect(store.resolve(rebased.reviewId, [choice], current)).rejects.toThrow('no pertenece');
    await expect(store.resolve(review.reviewId, [], current)).rejects.toThrow('disponible');
    expect(await new BrowserSyncConflictStore(destination).list()).toEqual([rebased]);
  });

  it('no reemplaza revisión sin decisiones ni acepta base remota vieja/otra categoría', async () => {
    const { store, destination } = await fixture();
    const review = await store.prepare(source(), current);
    const remote = { category: 'bookmarks' as const, revision: 3, payload: source().remote };
    await expect(store.rebase(review.reviewId, remote, current)).rejects.toThrow('pendientes');
    await store.resolve(review.reviewId, [{ conflictId: review.conflicts[0].id, side: 'local' }], current);
    const before = await fs.readFile(destination, 'utf8');
    await expect(store.rebase(review.reviewId, { ...remote, revision: 2 }, current)).rejects.toThrow('inválida');
    await expect(store.rebase(review.reviewId, { category: 'settings', revision: 3, payload: {} }, current)).rejects.toThrow('categoría');
    expect(await fs.readFile(destination, 'utf8')).toBe(before);
  });

  it('conserva revisión anterior si falla la escritura de la nueva base', async () => {
    const { store, destination } = await fixture();
    const review = await store.prepare(source(), current);
    await store.resolve(review.reviewId, [{ conflictId: review.conflicts[0].id, side: 'local' }], current);
    const before = await fs.readFile(destination, 'utf8');
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('EACCES'));
    await expect(store.rebase(review.reviewId, { category: 'bookmarks', revision: 3, payload: source().remote }, current)).rejects.toThrow('Se conserva');
    expect(await fs.readFile(destination, 'utf8')).toBe(before);
  });

  it('rechaza un archivo sobredimensionado antes de descifrarlo', async () => {
    const { store, destination } = await fixture();
    await store.prepare(source(), current);
    const file = await fs.open(destination, 'r+');
    try { await file.truncate(40 * 1024 * 1024 + 1); } finally { await file.close(); }
    vi.mocked(safeStorage.decryptString).mockClear();
    await expect(store.list()).rejects.toThrow('Se conserva');
    expect(safeStorage.decryptString).not.toHaveBeenCalled();
  });

  it('no convierte un fallo de descifrado en una lista vacía', async () => {
    const { store, destination } = await fixture();
    await store.prepare(source(), current);
    const before = await fs.readFile(destination, 'utf8');
    vi.spyOn(safeStorage, 'decryptString').mockImplementationOnce(() => { throw new Error('Proveedor privado'); });
    await expect(store.list()).rejects.toThrow('Se conserva');
    expect(await fs.readFile(destination, 'utf8')).toBe(before);
  });
});
