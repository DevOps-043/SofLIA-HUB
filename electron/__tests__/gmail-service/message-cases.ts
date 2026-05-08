import { expect, it } from 'vitest';
import {
  mockGetGoogleAuth,
  mockLabelsCreate,
  mockMessagesList,
  mockMessagesModify,
  mockMessagesTrash,
} from './setup';
import type { GmailServiceTestContext } from './types';

export function registerGmailMessageTests(ctx: GmailServiceTestContext) {
  it('GML-003: getMessages returns messages with nextPageToken', async () => {
    const result = await ctx.getService().getMessages({ maxResults: 10 });
    expect(result.success).toBe(true);
    expect(result.messages?.length).toBeGreaterThan(0);
    expect(result.nextPageToken).toBe('page-2');
    expect(mockMessagesList).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'me', maxResults: 10 }),
    );
  });

  it('GML-004: trashMessage calls Gmail trash API', async () => {
    const result = await ctx.getService().trashMessage('msg-to-trash');
    expect(result.success).toBe(true);
    expect(mockMessagesTrash).toHaveBeenCalledWith({ userId: 'me', id: 'msg-to-trash' });
  });

  it('GML-008: getLabels returns list of Gmail labels', async () => {
    const result = await ctx.getService().getLabels();
    expect(result.success).toBe(true);
    expect(result.labels).toEqual([
      { id: 'INBOX', name: 'INBOX' },
      { id: 'lbl-1', name: 'Work' },
      { id: 'lbl-2', name: 'Personal' },
    ]);
  });

  it('GML-009: getMessages returns error when Google auth is null', async () => {
    mockGetGoogleAuth.mockResolvedValue(null);
    const result = await ctx.getService().getMessages();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Google no conectado');
  });

  it('GML-011: modifyLabels maps label names and creates missing labels', async () => {
    const result = await ctx.getService().modifyLabels('msg-1', ['Newsletter', 'Work'], ['INBOX', 'Missing']);

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
}
