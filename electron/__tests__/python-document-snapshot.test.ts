import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapshotSelectedDocument } from '../python/document-snapshot';
import { PYTHON_TOOLS_MAX_FILE_BYTES } from '../../src/shared/python-tools';
let root: string; let file: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-document-qa-')); file = path.join(root, 'ficticio.pdf'); await fs.writeFile(file, '%PDF-1.7\ntexto ficticio'); });
afterEach(async () => { vi.restoreAllMocks(); expect(path.relative(os.tmpdir(), root).startsWith('..')).toBe(false); await fs.rm(root, { recursive: true, force: true }); });
describe('Snapshot documental privado', () => {
  it('entrega bytes estables y borra sólo la copia propia', async () => {
    const result = await snapshotSelectedDocument(file, root, () => {});
    expect(await fs.readFile(result.path)).toEqual(await fs.readFile(file)); expect(path.basename(result.path)).toBe('document.pdf');
    await result.remove(); expect(await fs.readdir(root)).toEqual(['ficticio.pdf']);
  });
  it.each(['firma', 'extension', 'directorio', 'cuota'])('rechaza %s sin dejar copias', async mode => {
    if (mode === 'firma') await fs.writeFile(file, 'no es un PDF');
    if (mode === 'extension') { file = path.join(root, 'ficticio.txt'); await fs.writeFile(file, 'texto'); }
    if (mode === 'directorio') { file = path.join(root, 'carpeta.pdf'); await fs.mkdir(file); }
    if (mode === 'cuota') await fs.truncate(file, PYTHON_TOOLS_MAX_FILE_BYTES + 1);
    await expect(snapshotSelectedDocument(file, root, () => {})).rejects.toThrow();
    expect((await fs.readdir(root)).some(name => name.startsWith('soflia-document-'))).toBe(false);
  });
  it('cambiar el contexto durante la copia elimina el archivo parcial', async () => {
    let checks = 0;
    await expect(snapshotSelectedDocument(file, root, () => { if (++checks === 8) throw new Error('TOOLS_CANCELLED'); })).rejects.toThrow('TOOLS_CANCELLED');
    expect(await fs.readdir(root)).toEqual(['ficticio.pdf']);
  });
  it('un fallo al cerrar el origen no pierde la limpieza de la copia', async () => {
    const open = fs.open.bind(fs); let failed = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const handle = await open(...args);
      if (args[0] === file) { const close = handle.close.bind(handle); handle.close = async () => { await close(); if (!failed) { failed = true; throw new Error('cierre ficticio'); } }; }
      return handle;
    });
    await expect(snapshotSelectedDocument(file, root, () => {})).rejects.toThrow('cierre ficticio'); expect(await fs.readdir(root)).toEqual(['ficticio.pdf']);
  });
});
