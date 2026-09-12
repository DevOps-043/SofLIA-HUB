import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog } from 'electron';
import { BrowserHistoryImporter, parseHistoryImport, readHistoryImportFile } from '../integrated-browser/history-importer';
import { BrowserHistoryStore } from '../integrated-browser/browser-history-store';

const roots: string[] = [];
const stores: BrowserHistoryStore[] = [];
beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => {
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) await store.flushAndClose();
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

async function fixture(source = [
  { url: 'https://example.com/?token=privado', title: 'Privado', visitedAt: '2026-08-28T12:00:00.000Z' },
  { url: 'https://nuevo.example', title: 'Nuevo', visitedAt: '2026-08-29T12:00:00.000Z' },
]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-history-import-'));
  roots.push(root);
  const file = path.join(root, 'historial.json');
  await fs.writeFile(file, JSON.stringify(source));
  const store = new BrowserHistoryStore(path.join(root, 'destino.sqlite'), null);
  stores.push(store);
  const context = { scopeId: 'a', generation: 1, changing: false, parent: new BrowserWindow() as BrowserWindow | null };
  const importer = new BrowserHistoryImporter(store, () => context);
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [file] });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
  return { root, file, store, context, importer };
}

describe('importación de historial con revisión', () => {
  it('cancelar la revisión no escribe y no expone URLs en el resumen', async () => {
    const f = await fixture();
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    expect(await f.importer.importFromDialog()).toMatchObject({ cancelled: true, imported: 0 });
    expect(JSON.stringify(vi.mocked(dialog.showMessageBox).mock.calls[0])).not.toMatch(/example|privado|historial\.json/);
    expect(await f.store.list()).toHaveLength(0);
  });

  it('importa visitas válidas y deduplica la primera entrada', async () => {
    const f = await fixture([
      { url: 'https://example.com', title: 'Primera', visitedAt: '2026-08-28T12:00:00.000Z' },
      { url: 'https://example.com', title: 'Segunda', visitedAt: '2026-08-28T12:00:00.000Z' },
      { url: 'javascript:alert(1)', title: 'Insegura', visitedAt: '2026-08-28T12:00:00.000Z' },
    ]);
    const result = await f.importer.importFromDialog();
    expect(result).toEqual({ cancelled: false, imported: 1, skipped: 0, duplicates: 1, invalid: 1 });
    expect((await f.store.list())[0]).toMatchObject({ url: 'https://example.com/', title: 'Primera' });
  });

  it('omite una visita existente y mantiene el contexto por perfil', async () => {
    const f = await fixture([{ url: 'https://example.com', title: 'Existente', visitedAt: '2026-08-28T12:00:00.000Z' }]);
    await f.store.importEntries([{ url: 'https://example.com/', title: 'Anterior', visitedAt: '2026-08-28T12:00:00.000Z' }]);
    expect(await f.importer.importFromDialog()).toMatchObject({ imported: 0, skipped: 1 });
    expect((await f.store.list())[0].title).toBe('Anterior');
    vi.mocked(dialog.showMessageBox).mockImplementation(async () => {
      f.context.scopeId = 'b';
      return { response: 0, checkboxChecked: false };
    });
    await expect(f.importer.importFromDialog()).rejects.toThrow('perfil o la ventana cambió');
  });

  it('acepta JSONL y formato de Chromium con microsegundos desde 1601', () => {
    const parsed = parseHistoryImport([
      JSON.stringify({ url: 'https://chrome.example', title: 'Chrome', last_visit_time: '13400000000000000' }),
      '{malformado}',
    ].join('\n'), '.jsonl');
    expect(parsed.summary).toMatchObject({ total: 2, validCount: 1, invalidCount: 1 });
    expect(parsed.entries[0]).toMatchObject({ url: 'https://chrome.example/' });
    expect(() => parseHistoryImport(JSON.stringify({ nope: true }))).not.toThrow();
  });

  it('rechaza archivo inválido, cuota y formato no soportado', async () => {
    const f = await fixture();
    await expect(readHistoryImportFile(path.join(f.root, 'secreto.csv'))).rejects.toThrow('JSON');
    await fs.writeFile(f.file, Buffer.alloc(5 * 1024 * 1024 + 1));
    await expect(readHistoryImportFile(f.file)).rejects.toThrow('5 MB');
    const directory = path.join(f.root, 'directorio.json');
    await fs.mkdir(directory);
    await expect(readHistoryImportFile(directory)).rejects.toThrow('5 MB');
    await expect(f.importer.importFromDialog()).rejects.toThrow('No se pudo leer el historial');
  });

  it('impide dos importaciones simultáneas y libera el guard tras cancelar', async () => {
    const f = await fixture();
    let release!: (result: { canceled: boolean; filePaths: string[] }) => void;
    vi.mocked(dialog.showOpenDialog).mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const first = f.importer.importFromDialog();
    await expect(f.importer.importFromDialog()).rejects.toThrow('Ya hay una importación');
    release({ canceled: true, filePaths: [] });
    await first;
    expect((await f.importer.importFromDialog()).imported).toBe(2);
  });

  it('revierte el lote completo si el contexto queda obsoleto antes del commit', async () => {
    const f = await fixture([{ url: 'https://uno.example', title: 'Uno', visitedAt: '2026-08-28T12:00:00.000Z' }]);
    let checks = 0;
    await expect(f.store.importEntries([{ url: 'https://uno.example', title: 'Uno', visitedAt: '2026-08-28T12:00:00.000Z' }], () => {
      checks++;
      if (checks === 3) throw new Error('contexto obsoleto');
    })).rejects.toThrow('contexto obsoleto');
    expect(await f.store.list()).toHaveLength(0);
  });
});
