import { describe, expect, it } from 'vitest';
import {
  createGChatService,
  mockFindDirectMessage,
  mockMembersList,
  mockMessagesList,
  mockSpacesList,
} from './fixture';

describe('GChatService - resolucion de DM', () => {
  it('GCH-007: resolves a DM by email alias and exposes detected URLs', async () => {
    mockMessagesList.mockResolvedValueOnce({
      data: {
        messages: [{
          name: 'spaces/DM123/messages/m-link',
          sender: { name: 'users/ernesto', displayName: 'Ernesto Hernandez Martinez', email: 'ernesto.hernandez@pulsehub.mx' },
          createTime: '2026-03-21T15:28:00Z',
          text: 'Checa esto https://www.linkedin.com/posts/example_open-source-agents-12345 y luego vemos',
          thread: { name: 'spaces/DM123/threads/t99' },
        }],
      },
    } as any);

    const result = await createGChatService().getMessages('ernesto.hernandez@pulsehub.mx', 5);

    expect(result.success).toBe(true);
    expect(mockFindDirectMessage).toHaveBeenCalledWith({ name: 'users/ernesto.hernandez@pulsehub.mx' });
    expect(result.resolvedSpace).toMatchObject({ name: 'spaces/DM123', type: 'DIRECT_MESSAGE' });
    expect(result.urls).toEqual(['https://www.linkedin.com/posts/example_open-source-agents-12345']);
  });

  it('GCH-008: resolves a DM by partial participant hint from recent history', async () => {
    mockSpacesList.mockResolvedValueOnce({ data: { spaces: [{ name: 'spaces/DM-ERNESTO', displayName: '', type: 'ROOM', spaceType: 'DIRECT_MESSAGE', lastActiveTime: '2026-03-21T23:36:19.223071Z' }] } } as any);
    mockFindDirectMessage.mockRejectedValueOnce(new Error('not found'));
    mockMembersList.mockRejectedValueOnce(new Error('insufficient scope'));
    mockMessagesList
      .mockResolvedValueOnce({ data: { messages: [
        { name: 'spaces/DM-ERNESTO/messages/m-old', sender: { name: 'users/u1', type: 'HUMAN' }, createTime: '2026-02-01T10:00:00Z', text: 'Hola Ernesto, te comparto el contexto' },
        { name: 'spaces/DM-ERNESTO/messages/m-new', sender: { name: 'users/u1', type: 'HUMAN' }, createTime: '2026-03-21T23:31:07Z', text: 'Hola, estas disponible?' },
      ] } } as any)
      .mockResolvedValueOnce({ data: { messages: [{ name: 'spaces/DM-ERNESTO/messages/m-new', sender: { name: 'users/u1', type: 'HUMAN' }, createTime: '2026-03-21T23:31:07Z', text: 'Hola, estas disponible?' }] } } as any);

    const result = await createGChatService().getMessages('Ernesto', 5);

    expect(result.success).toBe(true);
    expect(result.resolvedSpace?.name).toBe('spaces/DM-ERNESTO');
    expect(result.messages?.[0].text).toBe('Hola, estas disponible?');
  });

  it('GCH-009: resolves a DM by email found in recent Google Chat notifications', async () => {
    mockSpacesList.mockResolvedValueOnce({ data: { spaces: [{ name: 'spaces/BOT-DRIVE', displayName: 'Google Drive', type: 'DM', spaceType: 'DIRECT_MESSAGE', singleUserBotDm: true }] } } as any);
    mockFindDirectMessage.mockImplementation(async ({ name }: any) => {
      if (name === 'users/ernesto.hernandez@pulsehub.mx') return { data: { name: 'spaces/DM-ERNESTO', spaceType: 'DIRECT_MESSAGE', type: 'ROOM', displayName: 'Ernesto Hernandez Martinez' } };
      throw new Error('not found');
    });
    mockMembersList.mockResolvedValue({ data: { memberships: [{ member: { name: 'users/contact', type: 'HUMAN' } }] } } as any);
    mockMessagesList.mockImplementation(async ({ parent }: any) => parent === 'spaces/DM-ERNESTO'
      ? { data: { messages: [{ name: 'spaces/DM-ERNESTO/messages/m-new', sender: { name: 'users/contact', type: 'HUMAN' }, createTime: '2026-03-21T23:31:07Z', text: 'Hola, estas disponible?' }] } }
      : { data: { messages: [{ name: 'spaces/BOT-DRIVE/messages/m-notif', sender: { name: 'users/bot', type: 'BOT' }, createTime: '2026-03-20T04:15:09.502607Z', text: 'Ernesto Hernandez Martinez (ernesto.hernandez@pulsehub.mx) compartio La reunion se inicio contigo' }] } });

    const result = await createGChatService().getMessages('Ernesto', 5);

    expect(result.success).toBe(true);
    expect(result.resolvedSpace?.name).toBe('spaces/DM-ERNESTO');
    expect(mockFindDirectMessage).toHaveBeenCalledWith({ name: 'users/ernesto.hernandez@pulsehub.mx' });
  });
});
