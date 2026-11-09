import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openProjectUploadFiles, ProjectUploadFile } from '../project-hub/upload-files';
import { PROJECT_UPLOAD_MAX_BYTES } from '../../src/shared/project-hub-files';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-upload-files-test-')); });
afterEach(async () => {
  const resolved = await fs.realpath(root); expect(path.dirname(resolved)).toBe(await fs.realpath(os.tmpdir()));
  expect(path.basename(resolved)).toMatch(/^soflia-upload-files-test-/); await fs.rm(resolved, { recursive: true, force: true });
});
const guard = () => {};
const create = async (name: string, bytes: string | Buffer) => { const file = path.join(root, name); await fs.writeFile(file, bytes); return file; };
describe('Bytes de archivo elegidos nativamente', () => {
  it.each([['prueba.txt', 'Texto íntegro á'], ['prueba.md', '# Texto'], ['prueba.pdf', '%PDF-1.7\nFicticio'], ['prueba.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 1])]])('hash y bytes reales acotados de %s', async (name, content) => {
    const file = await ProjectUploadFile.open(await create(name, content), guard);
    try {
      expect(file.declaration.sha256).toBe(createHash('sha256').update(content).digest('hex'));
      expect(await file.bytes(guard)).toEqual(Buffer.from(content));
    } finally { await file.close(); }
  });
  it.each([['vacío.txt', ''], ['programa.exe', 'binario'], ['falso.pdf', 'no-es-pdf'], ['binario.txt', Buffer.from([0, 1])], ['utf8.txt', Buffer.from([0xff])]])('rechaza tipo/firma/bytes inválidos: %s', async (name, bytes) => {
    await expect(ProjectUploadFile.open(await create(name, bytes), guard)).rejects.toThrow();
  });
  it('rechaza exceso de tamaño y directorio antes de leer bytes', async () => {
    const file = await create('grande.txt', ''); const handle = await fs.open(file, 'w'); await handle.truncate(PROJECT_UPLOAD_MAX_BYTES + 1); await handle.close();
    await expect(ProjectUploadFile.open(file, guard)).rejects.toThrow(); await expect(ProjectUploadFile.open(root, guard)).rejects.toThrow();
  });
  it('rechaza lote excesivo/duplicado/vacío sin recortar', async () => {
    const file = await create('prueba.txt', 'Texto');
    for (const selected of [[], [file, file], Array(11).fill(file)]) await expect(openProjectUploadFiles(selected, guard)).rejects.toThrow();
  });
  it('detecta modificación del mismo tamaño después de la aprobación', async () => {
    const selected = await create('prueba.txt', 'original'); const file = await ProjectUploadFile.open(selected, guard);
    try { await fs.writeFile(selected, 'alterado'); await expect(file.bytes(guard)).rejects.toThrow(); }
    finally { await file.close(); }
  });
  it('un rename no cambia los bytes del handle elegido por otros de la ruta', async () => {
    const selected = await create('prueba.txt', 'original'); const file = await ProjectUploadFile.open(selected, guard);
    try { await fs.rename(selected, path.join(root, 'anterior.txt')); await fs.writeFile(selected, 'otro'); expect((await file.bytes(guard)).toString()).toBe('original'); }
    finally { await file.close(); }
  });
  it('cancelar durante lectura cierra el handle al fallar la preparación', async () => {
    const selected = await create('prueba.txt', 'texto'); let checks = 0;
    await expect(ProjectUploadFile.open(selected, () => { if (++checks >= 6) throw new Error('cancelado-ficticio'); })).rejects.toThrow();
    await fs.rename(selected, path.join(root, 'liberado.txt'));
  });
});
