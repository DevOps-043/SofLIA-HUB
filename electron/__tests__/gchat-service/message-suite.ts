import { describe, expect, it } from 'vitest';
import { createGChatService, mockMessagesList } from './fixture';

describe('GChatService - lectura de mensajes', () => {
  it('GCH-003: getMessages returns paginated messages from a space', async () => {
    const result = await createGChatService().getMessages('spaces/AAA', 10);

    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(2);
    expect(result.messages![0].text).toBe('Buenos dias');
    expect(result.messages![0].sender.displayName).toBe('Bob');
    expect(result.messages![0].sender.email).toBeUndefined();
    expect(result.messages![1].text).toBe('Hola equipo');
    expect(result.messages![1].sender.email).toBe('alice@test.com');
    expect(mockMessagesList).toHaveBeenCalledWith({ parent: 'spaces/AAA', pageSize: 1000 });
  });

  it('GCH-006: getMessages falls back to formatted text, sender name, and attachment preview', async () => {
    mockMessagesList.mockResolvedValueOnce({
      data: {
        messages: [
          {
            name: 'spaces/AAA/messages/m-attachment',
            sender: { name: 'users/u7', displayName: '', type: 'HUMAN' },
            createTime: '2024-01-15T11:00:00Z',
            attachment: [{ contentName: 'briefing.pdf' }],
            thread: { name: 'spaces/AAA/threads/t7' },
          },
          {
            name: 'spaces/AAA/messages/m-formatted',
            sender: { name: 'users/u8', displayName: '' },
            createTime: '2024-01-15T11:05:00Z',
            formattedText: '*Hola* equipo',
            thread: { name: 'spaces/AAA/threads/t7' },
          },
        ],
      },
    } as any);

    const result = await createGChatService().getMessages('spaces/AAA', 5);

    expect(result.success).toBe(true);
    expect(result.messages![0]).toMatchObject({
      name: 'spaces/AAA/messages/m-formatted',
      sender: { name: 'users/u8', displayName: 'users/u8', email: undefined },
      text: '*Hola* equipo',
      threadName: 'spaces/AAA/threads/t7',
      urls: [],
    });
    expect(result.messages![1].text).toBe('[Mensaje con adjunto: briefing.pdf]');
    expect(result.messages![1].sender.displayName).toBe('users/u7');
  });
});
