import fs from 'node:fs';
import fsAsync from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOOKMARK_IMPORT_REVIEW_TTL_MS, BrowserBookmarkStore } from '../integrated-browser/bookmark-store';

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks(); vi.useRealTimers();
  roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
});

function store() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-bookmarks-'));
  roots.push(root);
  return new BrowserBookmarkStore(path.join(root, 'bookmarks.json'));
}

describe('BrowserBookmarkStore', () => {
  async function damagedFixture() {
    const bookmarks = store(); const destination = path.join(roots[roots.length - 1], 'bookmarks.json');
    const first = await bookmarks.save({ url: 'https://example.com/primero', title: 'Primero' });
    await bookmarks.save({ url: 'https://example.com/segundo', title: 'Segundo' });
    const backup = fs.readFileSync(`${destination}.bak`, 'utf8');
    fs.writeFileSync(destination, 'principal dañado');
    return { bookmarks, destination, backup, first };
  }

  it('recupera sólo después del commit, preservando principal dañado y respaldo exactos', async () => {
    const f = await damagedFixture(); const prepared = await f.bookmarks.prepareRecovery();
    expect(prepared.count).toBe(1); expect(fs.readFileSync(f.destination, 'utf8')).toBe('principal dañado');
    await expect(f.bookmarks.list()).rejects.toThrow();
    expect(await prepared.commit(() => undefined)).toBe(1); expect(await f.bookmarks.list()).toEqual([f.first]);
    expect(fs.readFileSync(`${f.destination}.bak`, 'utf8')).toBe(f.backup);
    const archive = fs.readdirSync(path.dirname(f.destination)).find((file) => file.includes('.corrupt-'))!;
    expect(fs.readFileSync(path.join(path.dirname(f.destination), archive), 'utf8')).toBe('principal dañado');
    await expect(prepared.commit(() => undefined)).rejects.toThrow('ya se utilizó');
  });

  it('no inicializa vacío un principal ausente que conserva respaldo recuperable', async () => {
    const f = await damagedFixture(); fs.unlinkSync(f.destination);
    await expect(f.bookmarks.list()).rejects.toThrow();
    await expect(f.bookmarks.save({ title: 'Nuevo', url: 'https://example.com/nuevo' })).rejects.toThrow();
    await (await f.bookmarks.prepareRecovery()).commit(() => undefined);
    expect(await f.bookmarks.list()).toEqual([f.first]);
  });

  it('no retrocede una biblioteca válida ni una versión futura', async () => {
    const f = await damagedFixture(); fs.writeFileSync(f.destination, f.backup);
    await expect(f.bookmarks.prepareRecovery()).rejects.toThrow('actual es válida');
    const future = JSON.stringify({ version: 99, bookmarks: [] }); fs.writeFileSync(f.destination, future);
    await expect(f.bookmarks.prepareRecovery()).rejects.toThrow('versión');
    expect(fs.readFileSync(f.destination, 'utf8')).toBe(future); expect(fs.readFileSync(`${f.destination}.bak`, 'utf8')).toBe(f.backup);
  });

  it.each(['principal', 'respaldo'] as const)('rechaza cambios en %s posteriores a la revisión', async (target) => {
    const f = await damagedFixture(); const prepared = await f.bookmarks.prepareRecovery();
    fs.writeFileSync(target === 'principal' ? f.destination : `${f.destination}.bak`, 'cambió');
    await expect(prepared.commit(() => undefined)).rejects.toThrow('cambiaron');
    expect(fs.readdirSync(path.dirname(f.destination)).some((file) => file.includes('.corrupt-'))).toBe(false);
  });

  it('rechaza respaldo dañado, fechas inválidas y errores de acceso sin mover archivos', async () => {
    const f = await damagedFixture(); fs.writeFileSync(`${f.destination}.bak`, '{');
    await expect(f.bookmarks.prepareRecovery()).rejects.toThrow();
    const malformed = JSON.parse(f.backup); malformed.bookmarks[0].createdAt = 'sin fecha'; fs.writeFileSync(`${f.destination}.bak`, JSON.stringify(malformed));
    await expect(f.bookmarks.prepareRecovery()).rejects.toThrow();
    const open = vi.spyOn(fsAsync, 'open').mockRejectedValueOnce(Object.assign(new Error('C:/privado'), { code: 'EACCES' }));
    await expect(f.bookmarks.prepareRecovery()).rejects.toThrow(/^No se pudo leer el archivo de marcadores/); open.mockRestore();
    expect(fs.readFileSync(f.destination, 'utf8')).toBe('principal dañado');
  });

  it('vencimiento, perfil cambiado y guardas revocadas no autorizan recuperación', async () => {
    const f = await damagedFixture(); let destination = f.destination; const scoped = new BrowserBookmarkStore(() => destination);
    const moved = await scoped.prepareRecovery(); destination += '.otro';
    await expect(moved.commit(() => undefined)).rejects.toThrow('perfil cambió');
    const revoked = await f.bookmarks.prepareRecovery();
    await expect(revoked.commit(() => { throw new Error('Control revocado'); })).rejects.toThrow('Control revocado');
    const expired = await f.bookmarks.prepareRecovery(); vi.spyOn(Date, 'now').mockReturnValue(Date.now() + BOOKMARK_IMPORT_REVIEW_TTL_MS);
    await expect(expired.commit(() => undefined)).rejects.toThrow('venció');
    expect(fs.readFileSync(f.destination, 'utf8')).toBe('principal dañado');
  });

  it('un fallo de reemplazo conserva ambas copias y no deja temporales de recuperación', async () => {
    const f = await damagedFixture(); const prepared = await f.bookmarks.prepareRecovery();
    vi.spyOn(fsAsync, 'rename').mockRejectedValueOnce(new Error('Fallo de disco'));
    await expect(prepared.commit(() => undefined)).rejects.toThrow('Fallo de disco');
    expect(fs.readFileSync(f.destination, 'utf8')).toBe('principal dañado'); expect(fs.readFileSync(`${f.destination}.bak`, 'utf8')).toBe(f.backup);
    expect(fs.readdirSync(path.dirname(f.destination)).some((file) => file.endsWith('.tmp'))).toBe(false);
    const retry = await f.bookmarks.prepareRecovery();
    vi.spyOn(fsAsync, 'rename').mockRejectedValueOnce(new Error('Segundo fallo de disco'));
    await expect(retry.commit(() => undefined)).rejects.toThrow('Segundo fallo de disco');
    expect(fs.readdirSync(path.dirname(f.destination)).filter((file) => file.includes('.corrupt-'))).toHaveLength(1);
  });

  it('prepara conteos sin escribir y no expone el contenido del archivo en el resumen', async () => {
    const bookmarks = store();
    await bookmarks.save({ url: 'https://example.com/existe', title: 'Existente' });
    const prepared = await bookmarks.prepareImportHtml(`
      <a href="https://example.com/existe">Cambio privado</a>
      <a href="https://example.com/nuevo?token=privado">Nuevo privado</a>
      <a href="https://example.com/nuevo?token=privado">Repetido</a>
      <a href="file:///privado">Inválido</a><a data-href="https://no.example">Sin href</a>`);
    expect(prepared.summary).toEqual({ total: 5, newCount: 1, duplicateCount: 1, conflictCount: 1, invalidCount: 2 });
    expect(JSON.stringify(prepared.summary)).not.toMatch(/privado|example/);
    expect(Object.isFrozen(prepared.summary)).toBe(true);
    expect(await bookmarks.list()).toEqual([expect.objectContaining({ title: 'Existente' })]);
  });

  it('actualiza sólo metadata aprobada, conserva identidad y toma la primera repetición', async () => {
    const bookmarks = store();
    const original = await bookmarks.save({ url: 'https://example.com/', title: 'Anterior', folderId: 'Viejo', tags: ['viejo'] });
    const prepared = await bookmarks.prepareImportHtml('<DL><H3>Trabajo</H3><DL><a href="https://example.com/" tags="nuevo">Primero</a><a href="https://example.com/">Segundo</a><a href="https://nuevo.example">Nuevo</a></DL></DL>');
    expect(await prepared.commit('update')).toEqual({ imported: 1, updated: 1, skipped: 1 });
    expect((await bookmarks.list())[0]).toMatchObject({ id: original.id, position: original.position, createdAt: original.createdAt, title: 'Primero', folderId: 'Trabajo', tags: ['nuevo'] });
    await expect(prepared.commit('update')).rejects.toThrow('ya se utilizó');
  });

  it('importar sólo nuevos no altera los conflictos existentes', async () => {
    const bookmarks = store();
    const original = await bookmarks.save({ url: 'https://example.com/', title: 'Anterior' });
    const prepared = await bookmarks.prepareImportHtml('<a href="https://example.com/">Cambio</a><a href="https://nuevo.example/">Nuevo</a>');
    expect(await prepared.commit('skip')).toEqual({ imported: 1, updated: 0, skipped: 1 });
    expect((await bookmarks.list())[0]).toEqual(original);
  });

  it('una edición posterior invalida la revisión en vez de sobrescribirla', async () => {
    const bookmarks = store();
    const original = await bookmarks.save({ url: 'https://example.com/', title: 'Anterior' });
    const prepared = await bookmarks.prepareImportHtml('<a href="https://example.com/">Importado</a>');
    await bookmarks.save({ ...original, title: 'Edición posterior' });
    await expect(prepared.commit('update')).rejects.toThrow('cambiaron');
    expect((await bookmarks.list())[0].title).toBe('Edición posterior');
  });

  it('dos instancias no confirman a la vez contra el mismo estado anterior', async () => {
    const bookmarks = store();
    const second = new BrowserBookmarkStore(path.join(roots[roots.length - 1], 'bookmarks.json'));
    const [a, b] = await Promise.all([
      bookmarks.prepareImportHtml('<a href="https://a.example">A</a>'),
      second.prepareImportHtml('<a href="https://b.example">B</a>'),
    ]);
    const results = await Promise.allSettled([a.commit('skip'), b.commit('skip')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await bookmarks.list()).toHaveLength(1);
  });

  it('rechaza perfil cambiado, confirmación vencida y modo no permitido', async () => {
    const bookmarks = store();
    const root = roots[roots.length - 1];
    let destination = path.join(root, 'a.json');
    const scoped = new BrowserBookmarkStore(() => destination);
    const prepared = await scoped.prepareImportHtml('<a href="https://a.example">A</a>');
    destination = path.join(root, 'b.json');
    await expect(prepared.commit('skip')).rejects.toThrow('perfil cambió');
    expect(fs.existsSync(path.join(root, 'a.json'))).toBe(false);
    expect(fs.existsSync(destination)).toBe(false);
    const timed = await bookmarks.prepareImportHtml('<a href="https://b.example">B</a>');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + BOOKMARK_IMPORT_REVIEW_TTL_MS);
    await expect(timed.commit('skip')).rejects.toThrow('venció');
    await expect(timed.commit('replace-all' as never)).rejects.toThrow('no es válida');
    expect(await bookmarks.list()).toHaveLength(0);
  });

  it('un fallo de commit conserva el principal y limpia temporales', async () => {
    const bookmarks = store();
    const original = await bookmarks.save({ url: 'https://example.com/', title: 'Anterior' });
    const destination = path.join(roots[roots.length - 1], 'bookmarks.json');
    const prepared = await bookmarks.prepareImportHtml('<a href="https://example.com/">Cambio</a>');
    const rename = fsAsync.rename;
    vi.spyOn(fsAsync, 'rename').mockImplementation(async (source, target) => {
      if (target === destination) throw Object.assign(new Error('Fallo controlado'), { code: 'EACCES' });
      return rename(source, target);
    });
    await expect(prepared.commit('update')).rejects.toThrow('Fallo controlado');
    expect((await bookmarks.list())[0]).toEqual(original);
    expect(JSON.parse(fs.readFileSync(`${destination}.bak`, 'utf8')).bookmarks[0]).toEqual(original);
    expect(fs.readdirSync(roots[roots.length - 1]).some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it('una invalidación durante la escritura temporal impide reemplazar el principal', async () => {
    const bookmarks = store();
    const original = await bookmarks.save({ url: 'https://example.com/', title: 'Anterior' });
    const root = roots[roots.length - 1];
    const prepared = await bookmarks.prepareImportHtml('<a href="https://example.com/">Cambio</a>');
    await expect(prepared.commit('update', () => {
      if (fs.readdirSync(root).some((name) => name.endsWith('.tmp'))) throw new Error('Contexto cancelado');
    })).rejects.toThrow('Contexto cancelado');
    expect((await bookmarks.list())[0]).toEqual(original);
    expect(fs.readdirSync(root).some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it('detecta cuota antes de confirmar y cuenta enlaces sin href como inválidos', async () => {
    const bookmarks = store();
    await expect(bookmarks.prepareImportHtml('x'.repeat(5 * 1024 * 1024 + 1))).rejects.toThrow('5 MB');
    await bookmarks.importHtml(Array.from({ length: 5000 }, (_, i) => `<a href="https://example.com/${i}">${i}</a>`).join(''));
    await expect(bookmarks.prepareImportHtml('<a href="https://nuevo.example">Otro</a>')).rejects.toThrow('límite');
    const duplicate = await bookmarks.prepareImportHtml('<a href="https://example.com/0">0</a><a>Falta URL</a>');
    expect(duplicate.summary).toMatchObject({ duplicateCount: 1, invalidCount: 1, newCount: 0 });
  });

  it('no interpreta texto dentro de otro atributo como href', async () => {
    const bookmarks = store();
    const prepared = await bookmarks.prepareImportHtml(`<a title="texto href='https://falso.example'">Sin URL</a><a HREF='https://real.example' title="válido">Real</a>`);
    expect(prepared.summary).toMatchObject({ newCount: 1, invalidCount: 1 });
    await prepared.commit('skip');
    expect((await bookmarks.list()).map((bookmark) => bookmark.url)).toEqual(['https://real.example/']);
  });
  it('edita y mueve marcadores con posiciones densas sin duplicar el registro', async () => {
    const bookmarks = store();
    const first = await bookmarks.save({ title: 'Uno', url: 'https://example.com/uno' });
    const second = await bookmarks.save({ title: 'Dos', url: 'https://example.com/dos' });
    await bookmarks.save({ ...second, title: 'Dos editado', position: 0 });
    expect((await bookmarks.list()).map(({ id, title, position }) => ({ id, title, position }))).toEqual([
      { id: second.id, title: 'Dos editado', position: 0 }, { id: first.id, title: 'Uno', position: 1 },
    ]);
    await expect(bookmarks.save({ ...first, position: -1 })).rejects.toThrow('orden');
    await expect(bookmarks.save({ ...first, folderId: 'x'.repeat(101) })).rejects.toThrow('100');
    expect(await bookmarks.list()).toHaveLength(2);
  });

  it('conserva carpetas anidadas y etiquetas en el viaje HTML de ida y vuelta', async () => {
    const source = store();
    await source.save({ url: 'https://example.com/uno', title: 'Uno', folderId: 'Trabajo/Clientes', tags: ['equipo'] });
    await source.save({ url: 'https://example.com/dos', title: 'Dos', folderId: 'Personal' });
    const target = store();
    expect(await target.importHtml(await source.exportHtml())).toEqual({ imported: 2, skipped: 0 });
    expect((await target.list('clientes'))[0]).toMatchObject({ title: 'Uno', folderId: 'Trabajo/Clientes', tags: ['equipo'] });
    expect((await target.list('personal'))[0]).toMatchObject({ title: 'Dos', folderId: 'Personal' });
  });

  it('no informa éxito de migración si el destino no puede escribirse', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-bookmark-failure-'));
    roots.push(root);
    const blocked = path.join(root, 'archivo');
    fs.writeFileSync(blocked, 'no es un directorio');
    const bookmarks = new BrowserBookmarkStore(path.join(blocked, 'bookmarks.json'));
    await expect(bookmarks.migrateLegacy([{ url: 'https://example.com', title: 'Ejemplo' }])).rejects.toThrow();
  });

  it('captura el perfil antes de esperar escrituras concurrentes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-bookmark-scope-'));
    roots.push(root);
    let destination = path.join(root, 'a.json');
    const bookmarks = new BrowserBookmarkStore(() => destination);
    const a = bookmarks.save({ url: 'https://a.example', title: 'A' });
    destination = path.join(root, 'b.json');
    const b = bookmarks.save({ url: 'https://b.example', title: 'B' });
    await Promise.all([a, b]);
    expect((await bookmarks.list()).map((item) => item.title)).toEqual(['B']);
    destination = path.join(root, 'a.json');
    expect((await bookmarks.list()).map((item) => item.title)).toEqual(['A']);
  });

  it('deduplica URL, organiza etiquetas y permite búsqueda', async () => {
    const bookmarks = store();
    const first = await bookmarks.save({ url: 'https://example.com/report', title: ' Reporte\ntrimestral ', folderId: 'trabajo', tags: ['finanzas', 'finanzas'] });
    const updated = await bookmarks.save({ url: 'https://example.com/report', title: 'Reporte final', tags: ['cierre'] });
    expect(updated.id).toBe(first.id);
    expect(await bookmarks.list('cierre')).toEqual([expect.objectContaining({ title: 'Reporte final', tags: ['cierre'] })]);
  });

  it('migra entradas válidas una sola vez y rechaza protocolos locales', async () => {
    const bookmarks = store();
    expect(await bookmarks.migrateLegacy([
      { url: 'https://example.com/', title: 'Ejemplo' },
      { url: 'https://example.com/', title: 'Duplicado' },
      { url: 'file:///secreto', title: 'Local' },
    ])).toEqual({ imported: 1, skipped: 2 });
    expect(await bookmarks.list()).toHaveLength(1);
  });

  it('importa y exporta HTML de navegadores sin aceptar esquemas peligrosos', async () => {
    const bookmarks = store();
    const result = await bookmarks.importHtml(`<!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DL><p>
        <DT><A HREF="https://example.com/a?x=1&amp;y=2" TAGS="lectura, equipo">Ejemplo &amp; reporte</A>
        <DT><A HREF="javascript:alert(1)">Peligroso</A>
      </DL><p>`);
    expect(result).toEqual({ imported: 1, skipped: 1 });
    const html = await bookmarks.exportHtml();
    expect(html).toContain('HREF="https://example.com/a?x=1&amp;y=2"');
    expect(html).toContain('TAGS="lectura,equipo"');
    expect(html).not.toContain('javascript:');
  });

  it('rechaza archivos HTML que superan la cuota', async () => {
    await expect(store().importHtml('x'.repeat(5 * 1024 * 1024 + 1))).rejects.toThrow('5 MB');
  });
});
