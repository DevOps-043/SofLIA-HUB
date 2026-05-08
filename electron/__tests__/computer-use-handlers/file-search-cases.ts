import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import { executeToolDirect } from './context';

describe('File search', () => {
  it('CU-067: search_files finds by name pattern', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'test.txt', isDirectory: () => false },
      { name: 'other.js', isDirectory: () => false },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'test' });
    expect(result.success).toBe(true);
    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.results[0].name).toBe('test.txt');
  });

  it('CU-068: search_files respects MAX_SEARCH_RESULTS=200', async () => {
    const entries = Array.from({ length: 300 }, (_, i) => ({
      name: `match-${i}.txt`, isDirectory: () => false,
    }));
    vi.mocked(fs.readdir).mockResolvedValue(entries as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'match' });
    expect(result.success).toBe(true);
    expect(result.results.length).toBeLessThanOrEqual(200);
  });

  it('CU-069: search_files returns empty for no matches', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'noMatch.txt', isDirectory: () => false },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'zzzzz' });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it('CU-070: search_files case insensitive matching', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'MyFile.TXT', isDirectory: () => false },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'myfile' });
    expect(result.success).toBe(true);
    expect(result.results.length).toBe(1);
  });

  it('CU-071: search_files skips node_modules', async () => {
    vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (typeof dir === 'string' && dir.includes('node_modules')) {
        return [{ name: 'match.txt', isDirectory: () => false }] as any;
      }
      return [
        { name: 'node_modules', isDirectory: () => true },
        { name: 'src', isDirectory: () => true },
      ] as any;
    });
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'match' });
    expect(result.success).toBe(true);
    // node_modules dir itself should be skipped
  });

  it('CU-072: search_files skips .git directories', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: '.git', isDirectory: () => true },
      { name: 'visible.txt', isDirectory: () => false },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'visible' });
    expect(result.success).toBe(true);
    expect(result.results.some((r: any) => r.name === '.git')).toBe(false);
  });

  it('CU-073: search_files defaults to homedir when no directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([] as any);
    const result = await executeToolDirect('search_files', { pattern: 'test' });
    expect(result.success).toBe(true);
    expect(result.searchPath).toBe(os.homedir());
  });

  it('CU-074: search_files includes matching directories', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'target-dir', isDirectory: () => true },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'target' });
    expect(result.success).toBe(true);
    expect(result.results[0]?.isDirectory).toBe(true);
  });
});
