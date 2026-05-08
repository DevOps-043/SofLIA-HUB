import { vi } from 'vitest';

export const {
  mockFindDirectMessage,
  mockGetConnections,
  mockGetGoogleAuth,
  mockMembersList,
  mockMessagesCreate,
  mockMessagesList,
  mockReactionsCreate,
  mockSpacesList,
} = vi.hoisted(() => ({
  mockFindDirectMessage: vi.fn(),
  mockGetConnections: vi.fn(),
  mockGetGoogleAuth: vi.fn(),
  mockMembersList: vi.fn(),
  mockMessagesCreate: vi.fn(),
  mockMessagesList: vi.fn(),
  mockReactionsCreate: vi.fn(),
  mockSpacesList: vi.fn(),
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
          reactions: { create: mockReactionsCreate },
        },
        members: { list: mockMembersList },
      },
    })),
  },
}));

export const mockCalendarService = {
  getGoogleAuth: mockGetGoogleAuth,
  getConnections: mockGetConnections,
} as any;

export function resetGChatMocks(): void {
  mockGetGoogleAuth.mockReset().mockResolvedValue({ type: 'authorized_user' });
  mockGetConnections.mockReset().mockReturnValue([
    { provider: 'google', email: 'fernando.suarez@pulsehub.mx', isActive: true },
  ]);
  mockSpacesList.mockReset().mockResolvedValue({
    data: {
      spaces: [
        { name: 'spaces/AAA', displayName: 'General', type: 'ROOM', spaceThreadingState: 'THREADED_MESSAGES' },
        { name: 'spaces/BBB', displayName: 'DM with Alice', type: 'DM' },
      ],
    },
  });
  mockMessagesList.mockReset().mockResolvedValue({
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
  });
  mockMessagesCreate.mockReset().mockResolvedValue({ data: { name: 'spaces/AAA/messages/m-new' } });
  mockReactionsCreate.mockReset().mockResolvedValue({});
  mockFindDirectMessage.mockReset().mockResolvedValue({
    data: {
      name: 'spaces/DM123',
      spaceType: 'DIRECT_MESSAGE',
      type: 'ROOM',
      displayName: 'Ernesto Hernandez Martinez',
      spaceUri: 'https://chat.google.com/dm/DM123?cls=11',
    },
  });
  mockMembersList.mockReset().mockResolvedValue({
    data: {
      memberships: [
        { member: { name: 'users/u1', displayName: 'Alice', email: 'alice@test.com' } },
        { member: { name: 'users/u2', displayName: 'Bob', email: 'bob@test.com' } },
        { member: { name: 'users/u3', displayName: 'Carlos' } },
      ],
    },
  });
}
