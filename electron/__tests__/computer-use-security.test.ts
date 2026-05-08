import './computer-use-handlers.mocks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, shell } from 'electron';
import { backgroundProcessService } from '../background-process-service';

let executeToolDirect: (toolName: string, args: Record<string, any>) => Promise<any>;

beforeEach(async () => {
  vi.clearAllMocks();
  (ipcMain as any)._clearHandlers();
  executeToolDirect = (await import('../computer-use-handlers')).executeToolDirect;
});

describe('Computer Use security hardening', () => {
  it('CU-SEC-001: open_url rejects non-web protocols', async () => {
    const result = await executeToolDirect('open_url', { url: 'file:///C:/Windows/System32/calc.exe' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/protocolo/i);
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('CU-SEC-002: open_url normalizes host-only URLs to HTTPS', async () => {
    const result = await executeToolDirect('open_url', { url: 'example.com/path' });

    expect(result.success).toBe(true);
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/path');
  });

  it('CU-SEC-003: run_background_command blocks unsafe payloads before spawning', async () => {
    const result = await executeToolDirect('run_background_command', {
      command: 'powershell -EncodedCommand SQBFAFgA',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/seguridad|ofuscado/i);
    expect(backgroundProcessService.startBackgroundCommand).not.toHaveBeenCalled();
  });
});
