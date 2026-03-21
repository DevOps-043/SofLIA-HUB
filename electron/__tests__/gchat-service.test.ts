/**
 * GChatService Tests — GCH-001 to GCH-005
 * Tests Google Chat API integration: list spaces, send message,
 * get messages, add reaction, get members.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock googleapis ────────────────────────────────────────────────
const mockSpacesList = vi.fn(async () => ({
  data: {
    spaces: [
      { name: 'spaces/AAA', displayName: 'General', type: 'ROOM', spaceThreadingState: 'THREADED_MESSAGES' },
      { name: 'spaces/BBB', displayName: 'DM with Alice', type: 'DM' },
    ],
  },
}));

const mockMessagesList = vi.fn(async () => ({
  data: {
    messages: [
      {
        name: 'spaces/AAA/messages/m1',
        sender: { name: 'users/u1', displayName: 'Alice', email: 'alice@test.com' },
        createTime: '2024-01-15T10:00:00Z',
        text: 'Hola equipo',
        thread: { name: 'spaces/AAA/threads/t1' },
      },
      {
        name: 'spaces/AAA/messages/m2',
        sender: { name: 'users/u2', displayName: 'Bob' },
        createTime: '2024-01-15T10:05:00Z',
        text: 'Buenos dias',
        thread: { name: 'spaces/AAA/threads/t1' },
      },
    ],
  },
}));

const mockMessagesCreate = vi.fn(async () => ({
  data: { name: 'spaces/AAA/messages/m-new' },
}));

const mockReactionsCreate = vi.fn(async () => ({}));

const mockMembersList = vi.fn(async () => ({
  data: {
    memberships: [
      { member: { name: 'users/u1', displayName: 'Alice', email: 'alice@test.com' } },
      { member: { name: 'users/u2', displayName: 'Bob', email: 'bob@test.com' } },
      { member: { name: 'users/u3', displayName: 'Carlos' } },
    ],
  },
}));

vi.mock('googleapis', () => ({
  google: {
    chat: vi.fn(() => ({
      spaces: {
        list: mockSpacesList,
        messages: {
          list: mockMessagesList,
          create: mockMessagesCreate,
          reactions: {
            create: mockReactionsCreate,
          },
        },
        members: {
          list: mockMembersList,
        },
      },
    })),
  },
}));

// ─── Mock CalendarService dependency ────────────────────────────────
const mockGetGoogleAuth = vi.fn(async () => ({ type: 'authorized_user' }));
const mockCalendarService = {
  getGoogleAuth: mockGetGoogleAuth,
} as any;

// ─── Import after mocks ────────────────────────────────────────────
import { GChatService } from '../gchat-service';

describe('GChatService', () => {
  let service: GChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGoogleAuth.mockResolvedValue({ type: 'authorized_user' });
    service = new GChatService(mockCalendarService);
  });

  // GCH-001: listSpaces returns spaces
  it('GCH-001: listSpaces returns all chat spaces with metadata', async () => {
    const result = await service.listSpaces();

    expect(result.success).toBe(true);
    expect(result.spaces).toBeDefined();
    expect(result.spaces!.length).toBe(2);
    expect(result.spaces![0]).toEqual({
      name: 'spaces/AAA',
      displayName: 'General',
      type: 'ROOM',
      spaceThreadingState: 'THREADED_MESSAGES',
    });
    expect(result.spaces![1].type).toBe('DM');
  });

  // GCH-002: sendMessage with thread
  it('GCH-002: sendMessage sends text to space with optional thread', async () => {
    const result = await service.sendMessage(
      'spaces/AAA',
      'Hola a todos',
      'spaces/AAA/threads/t1',
    );

    expect(result.success).toBe(true);
    expect(result.messageName).toBe('spaces/AAA/messages/m-new');
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      parent: 'spaces/AAA',
      requestBody: {
        text: 'Hola a todos',
        thread: { name: 'spaces/AAA/threads/t1' },
      },
    });
  });

  // GCH-003: getMessages paginated
  it('GCH-003: getMessages returns paginated messages from a space', async () => {
    const result = await service.getMessages('spaces/AAA', 10);

    expect(result.success).toBe(true);
    expect(result.messages).toBeDefined();
    expect(result.messages!.length).toBe(2);
    expect(result.messages![0].text).toBe('Hola equipo');
    expect(result.messages![0].sender.displayName).toBe('Alice');
    expect(result.messages![0].sender.email).toBe('alice@test.com');
    expect(result.messages![0].threadName).toBe('spaces/AAA/threads/t1');

    expect(mockMessagesList).toHaveBeenCalledWith({
      parent: 'spaces/AAA',
      pageSize: 10,
      orderBy: 'createTime desc',
    });
  });

  // GCH-004: addReaction with emoji
  it('GCH-004: addReaction sends unicode emoji reaction to message', async () => {
    const result = await service.addReaction(
      'spaces/AAA/messages/m1',
      '👍',
    );

    expect(result.success).toBe(true);
    expect(mockReactionsCreate).toHaveBeenCalledWith({
      parent: 'spaces/AAA/messages/m1',
      requestBody: {
        emoji: { unicode: '👍' },
      },
    });
  });

  // GCH-005: getMembers returns members
  it('GCH-005: getMembers returns space members with email when available', async () => {
    const result = await service.getMembers('spaces/AAA');

    expect(result.success).toBe(true);
    expect(result.members).toBeDefined();
    expect(result.members!.length).toBe(3);
    expect(result.members![0]).toEqual({
      name: 'users/u1',
      displayName: 'Alice',
      email: 'alice@test.com',
    });
    // Carlos has no email
    expect(result.members![2].email).toBeUndefined();

    expect(mockMembersList).toHaveBeenCalledWith({
      parent: 'spaces/AAA',
      pageSize: 100,
    });
  });
});
