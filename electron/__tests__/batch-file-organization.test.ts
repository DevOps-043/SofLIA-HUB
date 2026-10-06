import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let root: string;
vi.mock('../computer-use/batch-file-ops/constants', async importOriginal => ({
  ...await importOriginal<object>(), MANIFEST_DIR: path.join(root, 'manifiestos'),
}));

describe('organización por extensión entre carpetas', () => {
  beforeAll(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-organizacion-')); });
  afterAll(async () => {
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('soflia-organizacion-')) throw new Error('Ruta temporal fuera del ámbito');
    await fs.rm(root, { recursive: true, force: true });
  });
  it('mueve dos fuentes, filtra documentos, conserva homónimos y deshace ambos lotes', async () => {
    const { batchMoveFiles } = await import('../computer-use/batch-file-ops/batch-move-files');
    const { undoLastFileOperation } = await import('../computer-use/batch-file-ops/undo-last-file-operation');
    const desktop = path.join(root, 'escritorio'), downloads = path.join(root, 'descargas'), dest = path.join(root, 'documentos');
    await fs.mkdir(desktop); await fs.mkdir(downloads); await fs.mkdir(path.join(dest, 'PDF'), { recursive: true });
    await fs.writeFile(path.join(desktop, 'informe.pdf'), 'escritorio');
    await fs.writeFile(path.join(downloads, 'informe.pdf'), 'descargas');
    await fs.writeFile(path.join(downloads, 'tabla.docx'), 'documento');
    await fs.writeFile(path.join(downloads, 'programa.exe'), 'conservar');
    await fs.writeFile(path.join(dest, 'PDF', 'informe.pdf'), 'existente');
    const results = [];
    for (const source of [desktop, downloads]) results.push(await batchMoveFiles({ source_directory: source, destination_directory: dest, extensions: ['pdf', 'docx'], group_by_extension: true }));
    expect(results.map(result => result.movedCount)).toEqual([1, 2]);
    expect(results.every(result => result.errorCount === 0 && result.operationId)).toBe(true);
    const pdfs = await fs.readdir(path.join(dest, 'PDF'));
    expect(pdfs).toHaveLength(3);
    expect(await fs.readFile(path.join(dest, 'PDF', 'informe.pdf'), 'utf8')).toBe('existente');
    expect(await fs.readFile(path.join(downloads, 'programa.exe'), 'utf8')).toBe('conservar');
    for (const result of results.reverse()) {
      const undone = await undoLastFileOperation({ operation_id: result.operationId });
      expect(undone.restoredCount).toBe(result.movedCount);
      expect(undone.errorCount).toBe(0);
    }
    expect(await fs.readFile(path.join(desktop, 'informe.pdf'), 'utf8')).toBe('escritorio');
    expect(await fs.readFile(path.join(downloads, 'informe.pdf'), 'utf8')).toBe('descargas');
  });
  it('sin opción conserva destino plano y devuelve error para origen inexistente', async () => {
    const { batchMoveFiles } = await import('../computer-use/batch-file-ops/batch-move-files');
    const source = path.join(root, 'plano'), dest = path.join(root, 'destino-plano');
    await fs.mkdir(source); await fs.writeFile(path.join(source, 'a.txt'), 'texto');
    const result = await batchMoveFiles({ source_directory: source, destination_directory: dest });
    expect(result.movedCount).toBe(1);
    expect(await fs.readFile(path.join(dest, 'a.txt'), 'utf8')).toBe('texto');
    expect((await batchMoveFiles({ source_directory: path.join(root, 'no-existe'), destination_directory: dest })).success).toBe(false);
  });

  it('resuelve colisiones repetidas incluso con reloj fijo sin esconder permisos', async () => {
    const { resolveCollision } = await import('../computer-use/batch-file-ops/file-utils');
    const target = path.join(root, 'duplicado.pdf');
    await fs.writeFile(target, 'original');
    await fs.writeFile(path.join(root, 'duplicado_1.pdf'), 'anterior');
    const now = vi.spyOn(Date, 'now').mockReturnValue(1);
    expect(await resolveCollision(target)).toBe(path.join(root, 'duplicado_2.pdf'));
    now.mockRestore();
    const access = vi.spyOn(fs, 'access').mockRejectedValueOnce(Object.assign(new Error('denegado'), { code: 'EACCES' }));
    await expect(resolveCollision(target)).rejects.toThrow('denegado');
    access.mockRestore();
  });
});
