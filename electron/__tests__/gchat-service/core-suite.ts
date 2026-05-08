import { describe, expect, it } from 'vitest';
import {
  createGChatService,
  mockMembersList,
  mockMessagesCreate,
  mockReactionsCreate,
} from './fixture';

describe('GChatService - operaciones base', () => {
  it('GCH-001: listSpaces returns all chat spaces with metadata', async () => {
    const result = await createGChatService().listSpaces();

    expect(result.success).toBe(true);
    expect(result.spaces).toHaveLength(2);
    expect(result.spaces![0]).toMatchObject({
      name: 'spaces/AAA',
      displayName: 'General',
      type: 'ROOM',
      spaceThreadingState: 'THREADED_MESSAGES',
    });
    expect(result.spaces![1].type).toBe('DM');
  });

  it('GCH-002: sendMessage sends text to space with optional thread', async () => {
    const result = await createGChatService().sendMessage('spaces/AAA', 'Hola a todos', 'spaces/AAA/threads/t1');

    expect(result.success).toBe(true);
    expect(result.messageName).toBe('spaces/AAA/messages/m-new');
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      parent: 'spaces/AAA',
      requestBody: { text: 'Hola a todos', thread: { name: 'spaces/AAA/threads/t1' } },
    });
  });

  it('GCH-004: addReaction sends unicode emoji reaction to message', async () => {
    const result = await createGChatService().addReaction('spaces/AAA/messages/m1', 'ðŸ‘');

    expect(result.success).toBe(true);
    expect(mockReactionsCreate).toHaveBeenCalledWith({
      parent: 'spaces/AAA/messages/m1',
      requestBody: { emoji: { unicode: 'ðŸ‘' } },
    });
  });

  it('GCH-005: getMembers returns space members with email when available', async () => {
    const result = await createGChatService().getMembers('spaces/AAA');

    expect(result.success).toBe(true);
    expect(result.members).toHaveLength(3);
    expect(result.members![0]).toEqual({ name: 'users/u1', displayName: 'Alice', email: 'alice@test.com' });
    expect(result.members![2].email).toBeUndefined();
    expect(mockMembersList).toHaveBeenCalledWith({ parent: 'spaces/AAA', pageSize: 100 });
  });
});
