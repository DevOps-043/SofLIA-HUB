import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import { executeToolDirect } from './context';

describe('Filesystem read/write operations', () => {
  it('CU-001: read_file returns content for existing file', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 100 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('hello world');
    const result = await executeToolDirect('read_file', { path: '/tmp/test.txt' });
    expect(result.success).toBe(true);
    expect(result.content).toBe('hello world');
  });

  it('CU-002: read_file rejects files >1MB', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 2 * 1024 * 1024 } as any);
    const result = await executeToolDirect('read_file', { path: '/tmp/big.bin' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/demasiado grande/i);
  });

  it('CU-003: read_file uses UTF-8 encoding', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 50 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('contenido en espanol');
    const result = await executeToolDirect('read_file', { path: '/tmp/espanol.txt' });
    expect(result.success).toBe(true);
    expect(fs.readFile).toHaveBeenCalledWith(expect.any(String), 'utf-8');
  });

  it('CU-004: read_file returns error for nonexistent file', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT: no such file'));
    const result = await executeToolDirect('read_file', { path: '/tmp/nope.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ENOENT');
  });

  it('CU-005: read_file handles empty path gracefully', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('read_file', { path: '' });
    expect(result.success).toBe(false);
  });

  it('CU-006: read_file handles paths with special characters', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 10 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('data');
    const result = await executeToolDirect('read_file', { path: '/tmp/file with spaces & (parens).txt' });
    expect(result.success).toBe(true);
  });

  it('CU-007: read_file rejects directory paths', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, size: 4096 } as any);
    const result = await executeToolDirect('read_file', { path: '/tmp/somedir' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/directorio/i);
  });

  // ── write_file ───────────────────────────────────────────────────────────

  it('CU-008: write_file creates a new file', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('write_file', { path: '/tmp/new.txt', content: 'hello' });
    expect(result.success).toBe(true);
    expect(fs.writeFile).toHaveBeenCalledWith('/tmp/new.txt', 'hello', 'utf-8');
  });

  it('CU-009: write_file overwrites existing file', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('write_file', { path: '/tmp/existing.txt', content: 'overwritten' });
    expect(result.success).toBe(true);
  });

  it('CU-010: write_file creates parent directories', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    await executeToolDirect('write_file', { path: '/tmp/deep/nested/file.txt', content: 'data' });
    expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('CU-011: write_file handles empty content', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('write_file', { path: '/tmp/empty.txt', content: '' });
    expect(result.success).toBe(true);
  });

  it('CU-012: write_file handles Unicode content', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('write_file', { path: '/tmp/unicode.txt', content: 'cafe\u0301 \u00f1 \u00fc \u2603' });
    expect(result.success).toBe(true);
  });

});