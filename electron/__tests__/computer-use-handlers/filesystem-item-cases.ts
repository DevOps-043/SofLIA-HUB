import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import path from 'node:path';
import { shell } from 'electron';
import { executeToolDirect } from './context';

describe('Filesystem item operations', () => {
  it('CU-022: move_item moves a file', async () => {
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    const result = await executeToolDirect('move_item', { source_path: '/tmp/a.txt', destination_path: '/tmp/b.txt' });
    expect(result.success).toBe(true);
    expect(result.from).toBe('/tmp/a.txt');
    expect(result.to).toBe('/tmp/b.txt');
  });

  it('CU-023: move_item moves a directory', async () => {
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    const result = await executeToolDirect('move_item', { source_path: '/tmp/dir1', destination_path: '/tmp/dir2' });
    expect(result.success).toBe(true);
  });

  it('CU-024: move_item creates parent when ENOENT', async () => {
    vi.mocked(fs.rename)
      .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      .mockResolvedValueOnce(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    const result = await executeToolDirect('move_item', { source_path: '/tmp/a.txt', destination_path: '/tmp/deep/b.txt' });
    expect(result.success).toBe(true);
    expect(fs.mkdir).toHaveBeenCalled();
  });

  it('CU-025: move_item returns error on general failure', async () => {
    vi.mocked(fs.rename).mockRejectedValue(new Error('EPERM'));
    const result = await executeToolDirect('move_item', { source_path: '/tmp/a', destination_path: '/tmp/b' });
    expect(result.success).toBe(false);
  });

  it('mueve el archivo sin sobrescribir y conserva ambas rutas si el origen cambia', async () => {
    const source = { dev: 1, ino: 2, size: 12, mtimeMs: 3, isFile: () => true } as Stats;
    vi.mocked(fs.lstat).mockResolvedValue(source);
    vi.mocked(fs.realpath).mockImplementation(async value => String(value));
    vi.mocked(fs.link).mockResolvedValue(undefined);
    const args = { source_path: '/qa/origen', destination_path: '/qa/destino', no_overwrite: true };
    await expect(executeToolDirect('move_item', args)).resolves.toMatchObject({ success: true });
    expect(fs.link).toHaveBeenCalledWith(path.join('/qa', 'origen'), path.join('/qa', 'destino'));
    expect(fs.unlink).toHaveBeenCalledOnce();
    vi.mocked(fs.unlink).mockClear();
    vi.mocked(fs.lstat).mockResolvedValueOnce(source).mockResolvedValueOnce({ ...source, ino: 4 });
    await expect(executeToolDirect('move_item', args)).resolves.toMatchObject({ success: false });
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('un destino ocupado no se sobrescribe ni elimina el origen', async () => {
    const source = { isFile: () => true } as Stats;
    vi.mocked(fs.lstat).mockResolvedValue(source);
    vi.mocked(fs.realpath).mockImplementation(async value => String(value));
    vi.mocked(fs.link).mockRejectedValueOnce(Object.assign(new Error('Destino ocupado'), { code: 'EEXIST' }));
    await expect(executeToolDirect('move_item', { source_path: '/qa/a', destination_path: '/qa/b', no_overwrite: true })).resolves.toMatchObject({ success: false, code: 'DESTINATION_EXISTS' });
    expect(fs.rename).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  // ── copy_item ────────────────────────────────────────────────────────────

  it('CU-026: copy_item copies a file', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.copyFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('copy_item', { source_path: '/tmp/a.txt', destination_path: '/tmp/b.txt' });
    expect(result.success).toBe(true);
  });

  it('CU-027: copy_item copies directory recursively', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.cp).mockResolvedValue(undefined);
    const result = await executeToolDirect('copy_item', { source_path: '/tmp/dir1', destination_path: '/tmp/dir2' });
    expect(result.success).toBe(true);
    expect(fs.cp).toHaveBeenCalledWith('/tmp/dir1', '/tmp/dir2', { recursive: true });
  });

  it('CU-028: copy_item returns error when source nonexistent', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('copy_item', { source_path: '/tmp/nope', destination_path: '/tmp/dest' });
    expect(result.success).toBe(false);
  });

  // ── delete_item ──────────────────────────────────────────────────────────

  it('CU-029: delete_item sends file to trash', async () => {
    vi.mocked(shell.openPath).mockResolvedValue('');
    const result = await executeToolDirect('delete_item', { path: '/tmp/trash-me.txt' });
    expect(result.success).toBe(true);
    expect(shell.trashItem).toHaveBeenCalledWith('/tmp/trash-me.txt');
  });

  it('CU-030: delete_item handles directory', async () => {
    const result = await executeToolDirect('delete_item', { path: '/tmp/trash-dir' });
    expect(result.success).toBe(true);
  });

  it('CU-031: delete_item returns error for nonexistent', async () => {
    vi.mocked(shell.trashItem).mockRejectedValue(new Error('File not found'));
    const result = await executeToolDirect('delete_item', { path: '/tmp/nope' });
    expect(result.success).toBe(false);
  });

});
