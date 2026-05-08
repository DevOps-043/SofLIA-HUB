import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGmailService } from './setup';
import {
  mockGetGoogleAuth,
  mockLabelsCreate,
  mockMessagesList,
  mockMessagesModify,
  mockMessagesTrash,
  resetGmailMocks,
} from './mocks';
import type { GmailService } from '../../gmail-service';

describe('GmailService messages and labels', () => {
  let service: GmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetGmailMocks();
    service = createGmailService();
  });

  it('GML-003: getMessages returns messages with nextPageToken', async () => {
    const result = await service.getMessages({ maxResults: 10 });

    expect(result.success).toBe(true);
    expect(result.messages!.length).toBeGreaterThan(0);
    expect(result.nextPageToken).toBe('page-2');
    expect(mockMessagesList).toHaveBeenCalledWith(expect.objectContaining({ userId: 'me', maxResults: 10 }));
  });

  it('GML-004: trashMessage calls Gmail trash API', async () => {
    const result = await service.trashMessage('msg-to-trash');

    expect(result.success).toBe(true);
    expect(mockMessagesTrash).toHaveBeenCalledWith({ userId: 'me', id: 'msg-to-trash' });
  });

  it('GML-008: getLabels returns Gmail labels', async () => {
    const result = await service.getLabels();

    expect(result.success).toBe(true);
    expect(result.labels).toHaveLength(3);
    expect(result.labels![0]).toEqual({ id: 'INBOX', name: 'INBOX' });
    expect(result.labels![1]).toEqual({ id: 'lbl-1', name: 'Work' });
  });

  it('GML-009: getMessages returns error when Google is not connected', async () => {
    mockGetGoogleAuth.mockResolvedValue(null);

    const result = await service.getMessages();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Google no conectado');
  });

  it('GML-011: modifyLabels maps names to IDs and creates missing labels', async () => {
    const result = await service.modifyLabels('msg-1', ['Newsletter', 'Work'], ['INBOX', 'Missing']);

    expect(result.success).toBe(true);
    expect(mockLabelsCreate).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'me',
      requestBody: expect.objectContaining({ name: 'Newsletter' }),
    }));
    expect(mockMessagesModify).toHaveBeenCalledWith({
      userId: 'me',
      id: 'msg-1',
      requestBody: { addLabelIds: ['lbl-new', 'lbl-1'], removeLabelIds: ['INBOX'] },
    });
  });
});
