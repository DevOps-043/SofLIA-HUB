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
const mockFindDirectMessage = vi.fn(async () => ({
  data: {
    name: 'spaces/DM123',
    spaceType: 'DIRECT_MESSAGE',
    type: 'ROOM',
    displayName: 'Ernesto Hernandez Martinez',
    spaceUri: 'https://chat.google.com/dm/DM123?cls=11',
  },
}));

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
        findDirectMessage: mockFindDirectMessage,
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
const mockGetConnections = vi.fn(() => ([
  {
    provider: 'google',
    email: 'fernando.suarez@pulsehub.mx',
    isActive: true,
  },
]));
const mockCalendarService = {
  getGoogleAuth: mockGetGoogleAuth,
  getConnections: mockGetConnections,
} as any;

// ─── Import after mocks ────────────────────────────────────────────
import { GChatService } from '../gchat-service';

describe('GChatService', () => {
  let service: GChatService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetGoogleAuth.mockResolvedValue({ type: 'authorized_user' });
    mockGetConnections.mockReturnValue([
      {
        provider: 'google',
        email: 'fernando.suarez@pulsehub.mx',
        isActive: true,
      },
    ]);
    mockSpacesList.mockImplementation(async () => ({
      data: {
        spaces: [
          { name: 'spaces/AAA', displayName: 'General', type: 'ROOM', spaceThreadingState: 'THREADED_MESSAGES' },
          { name: 'spaces/BBB', displayName: 'DM with Alice', type: 'DM' },
        ],
      },
    }));
    mockMessagesList.mockImplementation(async () => ({
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
    mockMessagesCreate.mockImplementation(async () => ({
      data: { name: 'spaces/AAA/messages/m-new' },
    }));
    mockReactionsCreate.mockImplementation(async () => ({}));
    mockFindDirectMessage.mockImplementation(async () => ({
      data: {
        name: 'spaces/DM123',
        spaceType: 'DIRECT_MESSAGE',
        type: 'ROOM',
        displayName: 'Ernesto Hernandez Martinez',
        spaceUri: 'https://chat.google.com/dm/DM123?cls=11',
      },
    }));
    mockMembersList.mockImplementation(async () => ({
      data: {
        memberships: [
          { member: { name: 'users/u1', displayName: 'Alice', email: 'alice@test.com' } },
          { member: { name: 'users/u2', displayName: 'Bob', email: 'bob@test.com' } },
          { member: { name: 'users/u3', displayName: 'Carlos' } },
        ],
      },
    }));
    service = new GChatService(mockCalendarService);
  });

  // GCH-001: listSpaces returns spaces
  it('GCH-001: listSpaces returns all chat spaces with metadata', async () => {
    const result = await service.listSpaces();

    expect(result.success).toBe(true);
    expect(result.spaces).toBeDefined();
    expect(result.spaces!.length).toBe(2);
    expect(result.spaces![0]).toMatchObject({
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
    expect(result.messages![0].text).toBe('Buenos dias');
    expect(result.messages![0].sender.displayName).toBe('Bob');
    expect(result.messages![0].sender.email).toBeUndefined();
    expect(result.messages![0].threadName).toBe('spaces/AAA/threads/t1');
    expect(result.messages![1].text).toBe('Hola equipo');
    expect(result.messages![1].sender.displayName).toBe('Alice');
    expect(result.messages![1].sender.email).toBe('alice@test.com');

    expect(mockMessagesList).toHaveBeenCalledWith({
      parent: 'spaces/AAA',
      pageSize: 1000,
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

  // GCH-006: getMessages tolerates messages without plain text
  it('GCH-006: getMessages falls back to formatted text, sender name, and attachment preview', async () => {
    mockMessagesList.mockResolvedValueOnce({
      data: {
        messages: [
          {
            name: 'spaces/AAA/messages/m-attachment',
            sender: { name: 'users/u7', displayName: '', type: 'HUMAN' },
            createTime: '2024-01-15T11:00:00Z',
            attachment: [
              { contentName: 'briefing.pdf' },
            ],
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

    const result = await service.getMessages('spaces/AAA', 5);

    expect(result.success).toBe(true);
    expect(result.messages).toBeDefined();
    expect(result.messages![0]).toEqual({
      name: 'spaces/AAA/messages/m-formatted',
      sender: {
        name: 'users/u8',
        displayName: 'users/u8',
        email: undefined,
      },
      createTime: '2024-01-15T11:05:00Z',
      text: '*Hola* equipo',
      threadName: 'spaces/AAA/threads/t7',
      urls: [],
    });
    expect(result.messages![1].text).toBe('[Mensaje con adjunto: briefing.pdf]');
    expect(result.messages![1].sender.displayName).toBe('users/u7');
    expect(result.messages![1].urls).toEqual([]);
  });

  // GCH-007: getMessages resolves direct messages by email alias and extracts URLs
  it('GCH-007: getMessages resolves a DM by email alias and exposes detected URLs', async () => {
    mockMessagesList.mockResolvedValueOnce({
      data: {
        messages: [
          {
            name: 'spaces/DM123/messages/m-link',
            sender: {
              name: 'users/ernesto',
              displayName: 'Ernesto Hernandez Martinez',
              email: 'ernesto.hernandez@pulsehub.mx',
            },
            createTime: '2026-03-21T15:28:00Z',
            text: 'Checa esto https://www.linkedin.com/posts/example_open-source-agents-12345 y luego vemos',
            thread: { name: 'spaces/DM123/threads/t99' },
          },
        ],
      },
    } as any);

    const result = await service.getMessages('ernesto.hernandez@pulsehub.mx', 5);

    expect(result.success).toBe(true);
    expect(mockFindDirectMessage).toHaveBeenCalledWith({
      name: 'users/ernesto.hernandez@pulsehub.mx',
    });
    expect(mockMessagesList).toHaveBeenCalledWith({
      parent: 'spaces/DM123',
      pageSize: 1000,
    });
    expect(result.resolvedSpace).toMatchObject({
      name: 'spaces/DM123',
      displayName: 'Ernesto Hernandez Martinez',
      type: 'DIRECT_MESSAGE',
      spaceType: 'DIRECT_MESSAGE',
      spaceUri: 'https://chat.google.com/dm/DM123?cls=11',
    });
    expect(result.messages![0].urls).toEqual([
      'https://www.linkedin.com/posts/example_open-source-agents-12345',
    ]);
    expect(result.urls).toEqual([
      'https://www.linkedin.com/posts/example_open-source-agents-12345',
    ]);
  });

  // GCH-008: getMessages can resolve a DM by partial person name found in message history
  it('GCH-008: getMessages resolves a DM by partial participant hint when recent history mentions that person', async () => {
    mockSpacesList.mockResolvedValueOnce({
      data: {
        spaces: [
          {
            name: 'spaces/DM-ERNESTO',
            displayName: '',
            type: 'ROOM',
            spaceType: 'DIRECT_MESSAGE',
            lastActiveTime: '2026-03-21T23:36:19.223071Z',
            spaceUri: 'https://chat.google.com/dm/DM-ERNESTO?cls=11',
          },
        ],
      },
    } as any);

    mockFindDirectMessage.mockRejectedValueOnce(new Error('not found'));
    mockMembersList.mockRejectedValueOnce(new Error('insufficient scope'));
    mockMessagesList.mockResolvedValueOnce({
      data: {
        messages: [
          {
            name: 'spaces/DM-ERNESTO/messages/m-old',
            sender: { name: 'users/u1', type: 'HUMAN' },
            createTime: '2026-02-01T10:00:00Z',
            text: 'Hola Ernesto, te comparto el contexto',
          },
          {
            name: 'spaces/DM-ERNESTO/messages/m-new',
            sender: { name: 'users/u1', type: 'HUMAN' },
            createTime: '2026-03-21T23:31:07Z',
            text: 'Hola, estas disponible?',
          },
        ],
      },
    } as any);
    mockMessagesList.mockResolvedValueOnce({
      data: {
        messages: [
          {
            name: 'spaces/DM-ERNESTO/messages/m-new',
            sender: { name: 'users/u1', type: 'HUMAN' },
            createTime: '2026-03-21T23:31:07Z',
            text: 'Hola, estas disponible?',
          },
        ],
      },
    } as any);

    const result = await service.getMessages('Ernesto', 5);

    expect(result.success).toBe(true);
    expect(result.resolvedSpace?.name).toBe('spaces/DM-ERNESTO');
    expect(result.messages?.[0].text).toBe('Hola, estas disponible?');
  });

  // GCH-009: getMessages can resolve a DM by extracting the contact email from recent Chat notifications
  it('GCH-009: getMessages resolves a DM by email found in recent Google Chat notifications', async () => {
    mockSpacesList.mockResolvedValueOnce({
      data: {
        spaces: [
          {
            name: 'spaces/BOT-DRIVE',
            displayName: 'Google Drive',
            type: 'DM',
            spaceType: 'DIRECT_MESSAGE',
            lastActiveTime: '2026-03-20T04:15:09.502607Z',
            singleUserBotDm: true,
            membershipCount: { joinedDirectHumanUserCount: 1 },
          },
        ],
      },
    } as any);

    (mockFindDirectMessage as any).mockImplementation(async (params: any) => {
      const name = params?.name;
      if (name === 'users/ernesto.hernandez@pulsehub.mx') {
        return {
          data: {
            name: 'spaces/DM-ERNESTO',
            spaceType: 'DIRECT_MESSAGE',
            type: 'ROOM',
            displayName: 'Ernesto Hernandez Martinez',
            spaceUri: 'https://chat.google.com/dm/DM-ERNESTO?cls=11',
            membershipCount: { joinedDirectHumanUserCount: 2 },
          },
        };
      }
      throw new Error('not found');
    });

    mockMembersList.mockResolvedValue({
      data: {
        memberships: [
          { member: { name: 'users/contact', type: 'HUMAN' } },
          { member: { name: 'users/self', type: 'HUMAN' } },
        ],
      },
    } as any);

    (mockMessagesList as any).mockImplementation(async (params: any) => {
      const parent = params?.parent;
      if (parent === 'spaces/DM-ERNESTO') {
        return {
          data: {
            messages: [
              {
                name: 'spaces/DM-ERNESTO/messages/m-new',
                sender: { name: 'users/contact', type: 'HUMAN' },
                createTime: '2026-03-21T23:31:07Z',
                text: 'Hola, estas disponible?',
              },
            ],
          },
        };
      }

      if (parent === 'spaces/BOT-DRIVE') {
        return {
          data: {
            messages: [
              {
                name: 'spaces/BOT-DRIVE/messages/m-notif',
                sender: { name: 'users/bot', type: 'BOT' },
                createTime: '2026-03-20T04:15:09.502607Z',
                text: 'Ernesto Hernández Martínez (ernesto.hernandez@pulsehub.mx) compartió La reunión se inició contigo',
              },
            ],
          },
        };
      }

      return { data: { messages: [] } };
    });

    const result = await service.getMessages('Ernesto', 5);

    expect(result.success).toBe(true);
    expect(result.resolvedSpace?.name).toBe('spaces/DM-ERNESTO');
    expect(mockFindDirectMessage).toHaveBeenCalledWith({
      name: 'users/ernesto.hernandez@pulsehub.mx',
    });
    expect(result.messages?.[0].text).toBe('Hola, estas disponible?');
  });
});
