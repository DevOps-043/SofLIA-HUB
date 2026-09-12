import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog } from 'electron';
import { BrowserBookmarkImporter, readBookmarkImportFile } from '../integrated-browser/bookmark-importer';
import { BrowserBookmarkStore } from '../integrated-browser/bookmark-store';

const roots: string[] = [];
beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

async function fixture(html = '<a href="https://example.com/?token=privado">Título privado</a>') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-bookmark-import-'));
  roots.push(root);
  const source = path.join(root, 'marcadores.html');
  await fs.writeFile(source, html);
  const store = new BrowserBookmarkStore(path.join(root, 'destino.json'));
  const context = { scopeId: 'a', generation: 1, changing: false, parent: new BrowserWindow() as BrowserWindow | null };
  const importer = new BrowserBookmarkImporter(store, () => context);
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [source] });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
  return { root, source, store, context, importer };
}

describe('importación de marcadores con revisión', () => {
  it('seleccionar no escribe; cancelar la revisión deja la biblioteca intacta', async () => {
    const f = await fixture();
    vi.mocked(dialog.showMessageBox).mockImplementation(async () => {
      expect(await f.store.list()).toHaveLength(0);
      return { response: 1, checkboxChecked: false };
    });
    expect(await f.importer.importFromDialog()).toMatchObject({ cancelled: true, imported: 0, updated: 0 });
    expect(await f.store.list()).toHaveLength(0);
    const call: unknown[] = vi.mocked(dialog.showMessageBox).mock.calls[0];
    const options = call[call.length - 1];
    expect(options).toMatchObject({ defaultId: 1, cancelId: 1 });
    expect(JSON.stringify(options)).not.toMatch(/privado|example\.com|marcadores\.html/);
  });

  it('no acepta un archivo después de cancelar la selección', async () => {
    const f = await fixture();
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [f.source] });
    expect(await f.importer.importFromDialog()).toMatchObject({ cancelled: true });
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(await f.store.list()).toHaveLength(0);
  });

  it('aplica la resolución explícita y devuelve sólo los conteos al renderer', async () => {
    const f = await fixture('<a href="https://example.com">Cambio</a><a href="https://nuevo.example">Nuevo</a><a href="file:///privado">Inválido</a>');
    await f.store.save({ url: 'https://example.com', title: 'Anterior' });
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 2, checkboxChecked: false });
    const result = await f.importer.importFromDialog();
    expect(result).toEqual({ cancelled: false, imported: 1, updated: 1, skipped: 1, duplicates: 0, invalid: 1 });
    expect(JSON.stringify(result)).not.toMatch(/example|privado|Cambio/);
    expect((await f.store.list())[0].title).toBe('Cambio');
  });

  it('conservar conflictos cuenta esos elementos como omitidos', async () => {
    const f = await fixture('<a href="https://example.com">Cambio</a>');
    const original = await f.store.save({ url: 'https://example.com', title: 'Anterior' });
    expect(await f.importer.importFromDialog()).toEqual({ cancelled: false, imported: 0, updated: 0, skipped: 1, duplicates: 1, invalid: 0 });
    expect((await f.store.list())[0]).toEqual(original);
  });

  it('explica archivos sin entradas importables sin escribir ni pedir actualización', async () => {
    const f = await fixture('<a href="javascript:alert(1)">Inválido</a>');
    expect(await f.importer.importFromDialog()).toMatchObject({ imported: 0, updated: 0, invalid: 1 });
    expect(dialog.showMessageBox).toHaveBeenCalledWith(f.context.parent, expect.objectContaining({ type: 'info' }));
    expect(await f.store.list()).toHaveLength(0);
  });

  it.each(['scope', 'generation', 'window', 'transition'] as const)('invalida la confirmación al cambiar %s', async (change) => {
    const f = await fixture();
    vi.mocked(dialog.showMessageBox).mockImplementation(async () => {
      if (change === 'scope') f.context.scopeId = 'b';
      if (change === 'generation') f.context.generation++;
      if (change === 'window') f.context.parent = null;
      if (change === 'transition') f.context.changing = true;
      return { response: 0, checkboxChecked: false };
    });
    await expect(f.importer.importFromDialog()).rejects.toThrow('perfil o la ventana cambió');
    expect(await f.store.list()).toHaveLength(0);
  });

  it('rechaza antes de leer un archivo si cambia el perfil durante el selector', async () => {
    const f = await fixture();
    vi.mocked(dialog.showOpenDialog).mockImplementation(async () => {
      f.context.generation++;
      return { canceled: false, filePaths: [path.join(f.root, 'inexistente.html')] };
    });
    await expect(f.importer.importFromDialog()).rejects.toThrow('perfil o la ventana cambió');
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('impide otra importación viva y permite reintentar tras cancelar', async () => {
    const f = await fixture();
    let release!: (result: { canceled: boolean; filePaths: string[] }) => void;
    vi.mocked(dialog.showOpenDialog).mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const first = f.importer.importFromDialog();
    await expect(f.importer.importFromDialog()).rejects.toThrow('Ya hay una importación');
    release({ canceled: true, filePaths: [] });
    await first;
    expect((await f.importer.importFromDialog()).imported).toBe(1);
  });

  it('el archivo cambiado tras la vista previa no cambia lo autorizado', async () => {
    const f = await fixture('<a href="https://original.example">Original</a>');
    vi.mocked(dialog.showMessageBox).mockImplementation(async () => {
      await fs.writeFile(f.source, '<a href="https://otro.example">Otro</a>');
      return { response: 0, checkboxChecked: false };
    });
    await f.importer.importFromDialog();
    expect((await f.store.list())[0].url).toBe('https://original.example/');
  });

  it('el fallo de un diálogo libera la importación pendiente', async () => {
    const f = await fixture();
    vi.mocked(dialog.showMessageBox).mockRejectedValueOnce(new Error('Diálogo no disponible'));
    await expect(f.importer.importFromDialog()).rejects.toThrow('No se pudo completar la importación');
    expect(await f.store.list()).toHaveLength(0);
    expect((await f.importer.importFromDialog()).imported).toBe(1);
  });

  it('no filtra rutas ni mensajes arbitrarios del proveedor al fallar el commit', async () => {
    const f = await fixture();
    const write = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('EACCES: C:/privado/token-secreto.json'));
    await expect(f.importer.importFromDialog()).rejects.toThrow(/^No se pudo completar la importación de marcadores\. Vuelve a intentarlo\.$/);
    expect(write).toHaveBeenCalled();
    expect(await f.store.list()).toHaveLength(0);
  });

  it('acota la lectura y sanea fallos de archivo o formato', async () => {
    const f = await fixture();
    expect(await readBookmarkImportFile(f.source)).toContain('Título privado');
    await expect(readBookmarkImportFile(path.join(f.root, 'secreto.csv'))).rejects.toThrow('HTML');
    await expect(readBookmarkImportFile(path.join(f.root, 'secreto.html'))).rejects.toThrow(/^No se pudo leer el archivo de marcadores\./);
    await fs.writeFile(f.source, Buffer.alloc(5 * 1024 * 1024 + 1));
    await expect(readBookmarkImportFile(f.source)).rejects.toThrow('5 MB');
    const directory = path.join(f.root, 'directorio.html');
    await fs.mkdir(directory);
    await expect(readBookmarkImportFile(directory)).rejects.toThrow('5 MB');
  });
});
