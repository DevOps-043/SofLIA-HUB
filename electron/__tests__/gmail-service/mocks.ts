import { vi } from 'vitest';

export const mockGetGoogleAuth = vi.fn();
export const mockLabelsCreate = vi.fn();
export const mockLabelsDelete = vi.fn();
export const mockLabelsList = vi.fn();
export const mockMessagesBatchModify = vi.fn();
export const mockMessagesGet = vi.fn();
export const mockMessagesList = vi.fn();
export const mockMessagesModify = vi.fn();
export const mockMessagesSend = vi.fn();
export const mockMessagesTrash = vi.fn();

vi.doMock('googleapis', () => ({
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

vi.doMock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(async () => Buffer.from('file-content')),
    writeFile: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    readdir: vi.fn(async () => []),
    access: vi.fn(async () => {}),
  },
}));

export function resetGmailMocks(): void {
  mockGetGoogleAuth.mockReset().mockResolvedValue({ type: 'authorized_user' });
  mockMessagesSend.mockReset().mockResolvedValue({ data: { id: 'msg-sent-1' } });
  mockMessagesList.mockReset().mockResolvedValue({
    data: {
      messages: [{ id: 'msg-1' }, { id: 'msg-2' }],
      nextPageToken: 'page-2',
      resultSizeEstimate: 2,
    },
  });
  mockMessagesGet.mockReset().mockImplementation(async (args: any) => ({
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
  mockMessagesTrash.mockReset().mockResolvedValue({});
  mockMessagesModify.mockReset().mockResolvedValue({});
  mockMessagesBatchModify.mockReset().mockResolvedValue({});
  mockLabelsList.mockReset().mockResolvedValue({
    data: { labels: [{ id: 'INBOX', name: 'INBOX' }, { id: 'lbl-1', name: 'Work' }, { id: 'lbl-2', name: 'Personal' }] },
  });
  mockLabelsCreate.mockReset().mockImplementation(async (args: any) => ({
    data: { id: 'lbl-new', name: args.requestBody?.name || 'New Label' },
  }));
  mockLabelsDelete.mockReset().mockResolvedValue({});
}
