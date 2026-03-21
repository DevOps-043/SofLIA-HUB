/**
 * GmailService Tests — GML-001 to GML-010
 * Tests Gmail API integration: send, validate, read, trash, attachments,
 * HTML body, header stripping, labels, organization preview, apply plan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock googleapis ────────────────────────────────────────────────
const mockMessagesSend = vi.fn(async () => ({ data: { id: 'msg-sent-1' } }));
const mockMessagesList = vi.fn(async () => ({
  data: {
    messages: [{ id: 'msg-1' }, { id: 'msg-2' }],
    nextPageToken: 'page-2',
    resultSizeEstimate: 2,
  },
}));
const mockMessagesGet = vi.fn(async (args: any) => ({
  data: {
    id: args.id || 'msg-1',
    threadId: 'thread-1',
    snippet: 'Hello world',
    labelIds: ['INBOX', 'UNREAD'],
    internalDate: '1700000000000',
    payload: {
      headers: [
        { name: 'From', value: 'sender@test.com' },
        { name: 'To', value: 'me@test.com' },
        { name: 'Subject', value: 'Test Subject' },
        { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 +0000' },
      ],
      mimeType: 'text/plain',
      body: { data: Buffer.from('Hello body').toString('base64url') },
    },
  },
}));
const mockMessagesTrash = vi.fn(async () => ({}));
const mockMessagesModify = vi.fn(async () => ({}));
const mockMessagesBatchModify = vi.fn(async () => ({}));
const mockLabelsList = vi.fn(async () => ({
  data: {
    labels: [
      { id: 'INBOX', name: 'INBOX' },
      { id: 'lbl-1', name: 'Work' },
      { id: 'lbl-2', name: 'Personal' },
    ],
  },
}));
const mockLabelsCreate = vi.fn(async (args: any) => ({
  data: { id: 'lbl-new', name: args.requestBody?.name || 'New Label' },
}));
const mockLabelsDelete = vi.fn(async () => ({}));

vi.mock('googleapis', () => ({
  google: {
    gmail: vi.fn(() => ({
      users: {
        messages: {
          send: mockMessagesSend,
          list: mockMessagesList,
          get: mockMessagesGet,
          modify: mockMessagesModify,
          batchModify: mockMessagesBatchModify,
          trash: mockMessagesTrash,
        },
        labels: {
          list: mockLabelsList,
          create: mockLabelsCreate,
          delete: mockLabelsDelete,
        },
      },
    })),
  },
}));

// ─── Mock node:fs/promises ──────────────────────────────────────────
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(async () => Buffer.from('file-content')),
    writeFile: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    readdir: vi.fn(async () => []),
    access: vi.fn(async () => {}),
  },
}));

// ─── Mock CalendarService dependency ────────────────────────────────
const mockGetGoogleAuth = vi.fn(async () => ({ type: 'authorized_user' }));
const mockCalendarService = {
  getGoogleAuth: mockGetGoogleAuth,
} as any;

// ─── Import after mocks ────────────────────────────────────────────
import { GmailService } from '../gmail-service';

describe('GmailService', () => {
  let service: GmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGoogleAuth.mockResolvedValue({ type: 'authorized_user' });
    service = new GmailService(mockCalendarService);
  });

  // GML-001: Send email with valid params and MIME encoding
  it('GML-001: sendEmail builds MIME message and sends via Gmail API', async () => {
    const result = await service.sendEmail({
      to: ['dest@test.com'],
      subject: 'Hola',
      body: 'Contenido del correo',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-sent-1');
    expect(mockMessagesSend).toHaveBeenCalledTimes(1);

    // Verify the raw message contains base64url encoded MIME
    const sendCall = mockMessagesSend.mock.calls[0][0];
    expect(sendCall.userId).toBe('me');
    expect(sendCall.requestBody.raw).toBeDefined();

    // Decode and verify headers
    const decoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString('utf-8');
    expect(decoded).toContain('To: dest@test.com');
    expect(decoded).toContain('Subject: Hola');
    expect(decoded).toContain('Contenido del correo');
  });

  // GML-002: Email format validation rejects invalid addresses
  it('GML-002: sendEmail rejects email with invalid format', async () => {
    const result = await service.sendEmail({
      to: ['not-an-email'],
      subject: 'Test',
      body: 'Body',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('validacion de seguridad fallida');
    expect(mockMessagesSend).not.toHaveBeenCalled();
  });

  // GML-003: Read messages with pagination
  it('GML-003: getMessages returns messages with nextPageToken', async () => {
    const result = await service.getMessages({ maxResults: 10 });

    expect(result.success).toBe(true);
    expect(result.messages).toBeDefined();
    expect(result.messages!.length).toBeGreaterThan(0);
    expect(result.nextPageToken).toBe('page-2');
    expect(mockMessagesList).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'me', maxResults: 10 }),
    );
  });

  // GML-004: Trash message by ID
  it('GML-004: trashMessage calls Gmail trash API', async () => {
    const result = await service.trashMessage('msg-to-trash');

    expect(result.success).toBe(true);
    expect(mockMessagesTrash).toHaveBeenCalledWith({
      userId: 'me',
      id: 'msg-to-trash',
    });
  });

  // GML-005: Send with attachments
  it('GML-005: sendEmail with attachments creates multipart MIME', async () => {
    const result = await service.sendEmail({
      to: ['dest@test.com'],
      subject: 'Con adjunto',
      body: 'Revisa el archivo',
      attachmentPaths: ['/tmp/test-file.pdf'],
    });

    expect(result.success).toBe(true);
    expect(mockMessagesSend).toHaveBeenCalledTimes(1);

    // Verify multipart boundary is in the raw message
    const sendCall = mockMessagesSend.mock.calls[0][0];
    const decoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString('utf-8');
    expect(decoded).toContain('Content-Type: multipart/mixed');
    expect(decoded).toContain('boundary=');
  });

  // GML-006: HTML body support
  it('GML-006: sendEmail with isHtml uses text/html content type', async () => {
    const result = await service.sendEmail({
      to: ['dest@test.com'],
      subject: 'HTML email',
      body: '<h1>Hola</h1>',
      isHtml: true,
    });

    expect(result.success).toBe(true);
    const sendCall = mockMessagesSend.mock.calls[0][0];
    const decoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString('utf-8');
    expect(decoded).toContain('Content-Type: text/html');
    expect(decoded).toContain('<h1>Hola</h1>');
  });

  // GML-007: Header newline stripping (rejects emails with newlines)
  it('GML-007: sendEmail rejects emails containing newline characters', async () => {
    const result = await service.sendEmail({
      to: ['valid@test.com\r\nBcc: evil@hacker.com'],
      subject: 'Injection',
      body: 'body',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('validacion de seguridad fallida');
  });

  // GML-008: getLabels returns labels
  it('GML-008: getLabels returns list of Gmail labels', async () => {
    const result = await service.getLabels();

    expect(result.success).toBe(true);
    expect(result.labels).toBeDefined();
    expect(result.labels!.length).toBe(3);
    expect(result.labels![0]).toEqual({ id: 'INBOX', name: 'INBOX' });
    expect(result.labels![1]).toEqual({ id: 'lbl-1', name: 'Work' });
  });

  // GML-009: Returns error when Google is not connected
  it('GML-009: getMessages returns error when Google auth is null', async () => {
    mockGetGoogleAuth.mockResolvedValue(null);

    const result = await service.getMessages();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Google no conectado');
  });

  // GML-010: sendEmail with CC and BCC
  it('GML-010: sendEmail includes CC and BCC headers', async () => {
    const result = await service.sendEmail({
      to: ['main@test.com'],
      cc: ['cc@test.com'],
      bcc: ['bcc@test.com'],
      subject: 'CC test',
      body: 'Con copia',
    });

    expect(result.success).toBe(true);
    const sendCall = mockMessagesSend.mock.calls[0][0];
    const decoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString('utf-8');
    expect(decoded).toContain('Cc: cc@test.com');
    expect(decoded).toContain('Bcc: bcc@test.com');
  });
});
