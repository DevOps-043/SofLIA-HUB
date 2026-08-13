import { describe, it, expect, vi } from 'vitest';
import { clipboard } from 'electron';
import { executeToolDirect } from './context';

describe('Clipboard and system info', () => {
  it('CU-058: clipboard_read returns clipboard text', async () => {
    vi.mocked(clipboard.readText).mockResolvedValue('clipboard content');
    const result = await executeToolDirect('clipboard_read', {});
    expect(result.success).toBe(true);
    expect(result.content).toBe('clipboard content');
  });

  it('CU-059: clipboard_write writes text to clipboard', async () => {
    const result = await executeToolDirect('clipboard_write', { text: 'hello' });
    expect(result.success).toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('CU-060: clipboard_read handles empty clipboard', async () => {
    vi.mocked(clipboard.readText).mockResolvedValue('');
    const result = await executeToolDirect('clipboard_read', {});
    expect(result.success).toBe(true);
    expect(result.content).toBe('');
  });

  it('CU-061: clipboard_write handles long text', async () => {
    const longText = 'x'.repeat(100_000);
    const result = await executeToolDirect('clipboard_write', { text: longText });
    expect(result.success).toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledWith(longText);
  });

  it('CU-062: get_system_info returns CPU info', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.cpu).toBeDefined();
    expect(result.cpu.cores).toBeGreaterThan(0);
  });

  it('CU-063: get_system_info returns memory info', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.memory).toBeDefined();
    expect(result.memory.total).toBeDefined();
    expect(result.memory.free).toBeDefined();
  });

  it('CU-064: get_system_info returns OS info', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.platform).toBeDefined();
    expect(result.release).toBeDefined();
    expect(result.arch).toBeDefined();
  });

  it('CU-065: get_system_info returns disk paths', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.homeDir).toBeDefined();
    expect(result.tempDir).toBeDefined();
  });

  it('CU-066: get_system_info returns uptime', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.uptime).toBeDefined();
  });
});
