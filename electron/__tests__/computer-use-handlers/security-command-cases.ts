import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { executeToolDirect } from './context';

describe('Security command edge cases', () => {
  it('CU-091: all handlers return {success, error?} on success', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 10 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('content');
    const result = await executeToolDirect('read_file', { path: '/tmp/test.txt' });
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  it('CU-092: handler exception does not crash process', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('Unexpected crash'));
    const result = await executeToolDirect('get_file_info', { path: '/tmp/bad' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('CU-093: unknown tool returns {success: false}', async () => {
    const result = await executeToolDirect('nonexistent_tool', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/desconocida/i);
  });

  it('CU-094: blocked command with mixed case', async () => {
    const result = await executeToolDirect('execute_command', { command: 'ShUtDoWn /s /t 0' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('CU-095: blocked command with leading/trailing whitespace', async () => {
    const result = await executeToolDirect('execute_command', { command: '  format C:  ' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('CU-096: blocked rd /s /q c:\\ command', async () => {
    const result = await executeToolDirect('execute_command', { command: 'rd /s /q c:\\' });
    expect(result.success).toBe(false);
  });

  it('CU-097: blocked del /f /s /q c:\\ command', async () => {
    const result = await executeToolDirect('execute_command', { command: 'del /f /s /q c:\\windows' });
    expect(result.success).toBe(false);
  });

  it('CU-098: command exec returns exit code on error', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      const error = Object.assign(new Error('exit code 1'), { code: 1 });
      cb(error, '', 'error output');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'false' });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBeDefined();
  });

  it('CU-099: command exec uses powershell on win32', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    vi.mocked(exec).mockImplementation((_cmd: any, opts: any, cb: any) => {
      expect(opts.shell).toBe('powershell.exe');
      cb(null, '', '');
      return {} as any;
    });
    await executeToolDirect('execute_command', { command: 'Get-Date' });
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
  });
});
