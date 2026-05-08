import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import { executeToolDirect } from './context';

describe('Filesystem metadata operations', () => {
  it('CU-032: get_file_info returns metadata', async () => {
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => false,
      size: 2048,
      birthtime: new Date('2025-01-01'),
      mtime: new Date('2025-06-01'),
      atime: new Date('2025-06-15'),
    } as any);
    const result = await executeToolDirect('get_file_info', { path: '/tmp/info.txt' });
    expect(result.success).toBe(true);
    expect(result.sizeBytes).toBe(2048);
    expect(result.isDirectory).toBe(false);
    expect(result.created).toBeDefined();
    expect(result.modified).toBeDefined();
    expect(result.accessed).toBeDefined();
  });

  it('CU-033: get_file_info returns error for nonexistent', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('get_file_info', { path: '/tmp/nope' });
    expect(result.success).toBe(false);
  });
});