import { mockTransporter, mockTrashItem } from './computer-use-handlers.mocks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, shell } from 'electron';
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

describe('Email operations', () => {
  it('CU-085: send_email sends successfully', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: 'smtp.gmail.com', port: 587, user: 'test@gmail.com', password: 'pass', defaultFrom: 'test@gmail.com',
    }));
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-456' });
    const result = await executeToolDirect('send_email', {
      to: 'dest@gmail.com', subject: 'Test', body: 'Hello',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-456');
  });

  it('CU-086: send_email returns error without email config', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('send_email', { to: 'x@y.com', subject: 'S', body: 'B' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no configurado/i);
  });

  it('CU-087: send_email supports attachments', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: 'smtp.gmail.com', port: 587, user: 'u@gmail.com', password: 'p', defaultFrom: 'u@gmail.com',
    }));
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 100 } as any);
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-att' });
    const result = await executeToolDirect('send_email', {
      to: 'x@y.com', subject: 'S', body: 'B', attachment_paths: ['/tmp/file.pdf'],
    });
    expect(result.success).toBe(true);
    expect(result.attachmentsCount).toBe(1);
  });

  it('CU-088: send_email supports HTML body', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: 'smtp.gmail.com', port: 587, user: 'u@gmail.com', password: 'p', defaultFrom: 'u@gmail.com',
    }));
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-html' });
    const result = await executeToolDirect('send_email', {
      to: 'x@y.com', subject: 'HTML', body: '<h1>Hello</h1>', is_html: true,
    });
    expect(result.success).toBe(true);
    expect(mockTransporter.sendMail.mock.calls[0]?.[0]?.html).toBe('<h1>Hello</h1>');
    expect(mockTransporter.sendMail.mock.calls[0]?.[0]?.text).toBeUndefined();
  });

  it('CU-089: send_email handles SMTP timeout/error', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: 'smtp.gmail.com', port: 587, user: 'u@gmail.com', password: 'p', defaultFrom: 'u@gmail.com',
    }));
    mockTransporter.sendMail.mockRejectedValue(new Error('Connection timed out'));
    const result = await executeToolDirect('send_email', { to: 'x@y.com', subject: 'S', body: 'B' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection timed out');
  });

  it('CU-090: configure_email rejects unknown provider', async () => {
    const result = await executeToolDirect('configure_email', { email: 'user@unknownprovider.xyz', password: 'long-password' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/SMTP/i);
  });

});
