import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import { executeToolDirect } from './context';

describe('Filesystem directory operations', () => {
  it('CU-013: list_directory lists existing directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'file.txt', isDirectory: () => false },
      { name: 'subdir', isDirectory: () => true },
    ] as any);
    vi.mocked(fs.stat).mockResolvedValue({
      size: 1024, mtime: new Date(), birthtime: new Date(), isDirectory: () => false,
    } as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp/testdir' });
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('CU-014: list_directory handles empty directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([] as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp/empty' });
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it('CU-015: list_directory returns error for nonexistent', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('list_directory', { path: '/tmp/nope' });
    expect(result.success).toBe(false);
  });

  it('CU-016: list_directory distinguishes files and dirs', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'file.txt', isDirectory: () => false },
      { name: 'folder', isDirectory: () => true },
    ] as any);
    vi.mocked(fs.stat).mockResolvedValue({
      size: 100, mtime: new Date(), birthtime: new Date(), isDirectory: () => false,
    } as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp' });
    expect(result.success).toBe(true);
    const file = result.items.find((i: any) => i.name === 'file.txt');
    const dir = result.items.find((i: any) => i.name === 'folder');
    expect(file?.isDirectory).toBe(false);
    expect(dir?.isDirectory).toBe(true);
  });

  it('CU-017: list_directory filters hidden files by default', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: '.hidden', isDirectory: () => false },
      { name: 'visible.txt', isDirectory: () => false },
    ] as any);
    vi.mocked(fs.stat).mockResolvedValue({
      size: 10, mtime: new Date(), birthtime: new Date(), isDirectory: () => false,
    } as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp' });
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('visible.txt');
  });

  it('CU-018: list_directory shows hidden when show_hidden=true', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: '.hidden', isDirectory: () => false },
      { name: 'visible.txt', isDirectory: () => false },
    ] as any);
    vi.mocked(fs.stat).mockResolvedValue({
      size: 10, mtime: new Date(), birthtime: new Date(), isDirectory: () => false,
    } as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp', show_hidden: true });
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  // ── create_directory ─────────────────────────────────────────────────────

  it('CU-019: create_directory creates simple directory', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    const result = await executeToolDirect('create_directory', { path: '/tmp/newdir' });
    expect(result.success).toBe(true);
    expect(fs.mkdir).toHaveBeenCalledWith('/tmp/newdir', { recursive: true });
  });

  it('CU-020: create_directory creates recursive path', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    const result = await executeToolDirect('create_directory', { path: '/tmp/a/b/c' });
    expect(result.success).toBe(true);
  });

  it('CU-021: create_directory handles already exists (EEXIST)', async () => {
    const eexist = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    vi.mocked(fs.mkdir).mockRejectedValue(eexist);
    const result = await executeToolDirect('create_directory', { path: '/tmp/existing' });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/ya existe/i);
  });

});