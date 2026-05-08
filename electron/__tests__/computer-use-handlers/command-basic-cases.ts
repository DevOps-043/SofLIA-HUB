import { describe, it, expect, vi } from 'vitest';
import { exec } from 'node:child_process';
import { executeToolDirect } from './context';

describe('Command execution basics', () => {
  it('CU-034: execute_command runs simple echo', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, 'hello', '');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'echo hello' });
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('hello');
  });

  it('CU-035: execute_command captures stderr', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, '', 'warning message');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'some-cmd' });
    expect(result.success).toBe(true);
    expect(result.stderr).toBe('warning message');
  });

  it('CU-036: execute_command uses 30s timeout', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, opts: any, cb: any) => {
      expect(opts.timeout).toBe(30_000);
      cb(null, '', '');
      return {} as any;
    });
    await executeToolDirect('execute_command', { command: 'test' });
  });

  // ── BLOCKED_COMMANDS: test all 15 blocked patterns ───────────────────────
  it('CU-052: allows safe commands like dir', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, 'output', '');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'dir' });
    expect(result.success).toBe(true);
  });

  it('CU-053: allows npm list', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, 'npm list output', '');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'npm list' });
    expect(result.success).toBe(true);
  });

  it('CU-054: allows git status', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, 'On branch main', '');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'git status' });
    expect(result.success).toBe(true);
  });

  it('CU-055: case insensitive blocking (FORMAT C:)', async () => {
    const result = await executeToolDirect('execute_command', { command: 'FORMAT C:' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('CU-056: blocks command with blocked pattern embedded', async () => {
    const result = await executeToolDirect('execute_command', { command: 'echo test && shutdown /s' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('CU-057: blocks pipe to blocked command', async () => {
    const result = await executeToolDirect('execute_command', { command: 'echo y | format d:' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });
});
