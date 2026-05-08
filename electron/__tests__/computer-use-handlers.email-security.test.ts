import { mockTransporter, mockTrashItem } from './computer-use-handlers.mocks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, safeStorage, shell } from 'electron';
import fs from 'node:fs/promises';

let executeToolDirect: (toolName: string, args: Record<string, any>) => Promise<any>;

beforeEach(async () => {
  vi.clearAllMocks();
  (ipcMain as any)._clearHandlers();
  Object.defineProperty(shell, 'trashItem', {
    value: mockTrashItem,
    configurable: true,
    writable: true,
  });
  mockTrashItem.mockResolvedValue(undefined);
  executeToolDirect = (await import('../computer-use-handlers')).executeToolDirect;
});

describe('Email credential security', () => {
  it('CU-091: configure_email stores SMTP password encrypted', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('configure_email', { email: 'user@gmail.com', password: 'app-password-1234' });

    expect(result.success).toBe(true);
    const savedPayload = String(vi.mocked(fs.writeFile).mock.calls[0]?.[1] || '');
    expect(savedPayload).toContain('passwordEncrypted');
    expect(savedPayload).not.toContain('app-password-1234');
    expect(safeStorage.encryptString).toHaveBeenCalledWith('app-password-1234');
  });

  it('CU-092: send_email reads encrypted SMTP password', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: 'smtp.gmail.com',
      port: 587,
      user: 'u@gmail.com',
      passwordEncrypted: Buffer.from('encrypted:secret-pass').toString('base64'),
      defaultFrom: 'u@gmail.com',
    }));
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-secure' });

    const result = await executeToolDirect('send_email', { to: 'x@y.com', subject: 'S', body: 'B' });

    expect(result.success).toBe(true);
    expect(safeStorage.decryptString).toHaveBeenCalled();
  });

  it('CU-093: send_email rejects header injection before SMTP', async () => {
    const result = await executeToolDirect('send_email', {
      to: 'valid@test.com\r\nBcc: attacker@test.com',
      subject: 'S',
      body: 'B',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalido|inseguro|control/i);
    expect(mockTransporter.sendMail).not.toHaveBeenCalled();
  });
});
