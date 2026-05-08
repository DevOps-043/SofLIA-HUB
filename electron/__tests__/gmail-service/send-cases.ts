import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGmailService } from './setup';
import { mockMessagesSend, resetGmailMocks } from './mocks';
import type { GmailService } from '../../gmail-service';

function decodeFirstSentMessage() {
  const firstCall = mockMessagesSend.mock.calls[0];
  if (!firstCall) throw new Error('Expected Gmail send call to exist');
  return Buffer.from(firstCall[0].requestBody.raw, 'base64url').toString('utf-8');
}

describe('GmailService sendEmail', () => {
  let service: GmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetGmailMocks();
    service = createGmailService();
  });

  it('GML-001: builds MIME message and sends via Gmail API', async () => {
    const result = await service.sendEmail({ to: ['dest@test.com'], subject: 'Hola', body: 'Contenido del correo' });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-sent-1');
    expect(mockMessagesSend).toHaveBeenCalledTimes(1);
    const decoded = decodeFirstSentMessage();
    expect(decoded).toContain('To: dest@test.com');
    expect(decoded).toContain('Subject: Hola');
    expect(decoded).toContain('Contenido del correo');
  });

  it('GML-002: rejects invalid email formats', async () => {
    const result = await service.sendEmail({ to: ['not-an-email'], subject: 'Test', body: 'Body' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('validacion de seguridad fallida');
    expect(mockMessagesSend).not.toHaveBeenCalled();
  });

  it('GML-005: creates multipart MIME for attachments', async () => {
    const result = await service.sendEmail({
      to: ['dest@test.com'],
      subject: 'Con adjunto',
      body: 'Revisa el archivo',
      attachmentPaths: ['/tmp/test-file.pdf'],
    });

    expect(result.success).toBe(true);
    const decoded = decodeFirstSentMessage();
    expect(decoded).toContain('Content-Type: multipart/mixed');
    expect(decoded).toContain('boundary=');
  });

  it('GML-006: uses text/html content type for HTML body', async () => {
    const result = await service.sendEmail({
      to: ['dest@test.com'],
      subject: 'HTML email',
      body: '<h1>Hola</h1>',
      isHtml: true,
    });

    expect(result.success).toBe(true);
    const decoded = decodeFirstSentMessage();
    expect(decoded).toContain('Content-Type: text/html');
    expect(decoded).toContain('<h1>Hola</h1>');
  });

  it('GML-007: rejects emails containing newline characters', async () => {
    const result = await service.sendEmail({ to: ['valid@test.com\r\nBcc: evil@hacker.com'], subject: 'Injection', body: 'body' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('validacion de seguridad fallida');
  });

  it('GML-008: rejects subject header injection', async () => {
    const result = await service.sendEmail({
      to: ['valid@test.com'],
      subject: 'Hola\r\nBcc: evil@hacker.com',
      body: 'body',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('header injection');
    expect(mockMessagesSend).not.toHaveBeenCalled();
  });

  it('GML-010: includes CC and BCC headers', async () => {
    const result = await service.sendEmail({
      to: ['main@test.com'],
      cc: ['cc@test.com'],
      bcc: ['bcc@test.com'],
      subject: 'CC test',
      body: 'Con copia',
    });

    expect(result.success).toBe(true);
    const decoded = decodeFirstSentMessage();
    expect(decoded).toContain('Cc: cc@test.com');
    expect(decoded).toContain('Bcc: bcc@test.com');
  });
});
