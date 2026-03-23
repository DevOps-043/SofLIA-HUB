/**
 * Tests RS-001 to RS-005: chat-service.ts — Renderer service tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client before importing the service
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock('../../lib/supabase-factory', () => ({
  createElectronSupabaseClient: vi.fn(() => null),
  isValidUrl: vi.fn(() => true),
}));

vi.mock('../../config', () => ({
  SUPABASE: { URL: 'https://test.supabase.co', ANON_KEY: 'test-key' },
  GOOGLE_API_KEY: 'test-key',
  MODELS: {},
}));

describe('chat-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default chain: from().select().eq().order() etc.
    mockSingle.mockResolvedValue({
      data: {
        id: 'remote-conversation-id',
        user_id: 'user-123',
        title: 'Test Chat',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockEq.mockReturnValue({ order: mockOrder, eq: mockEq, single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
    const mockUpsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      upsert: mockUpsert,
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    });
  });

  // RS-001: createConversation generates a conversation and syncs to Supabase
  it('RS-001: createConversation calls Supabase insert via sync', async () => {
    const { createConversation } = await import('../../services/chat-service');

    const result = await createConversation('user-123', 'Test Chat');

    expect(result).not.toBeNull();
    expect(result?.user_id).toBe('user-123');
    expect(result?.title).toBe('Test Chat');
    expect(result?.id).toBeTruthy();
    // syncPendingChatState triggers Supabase upsert
    expect(mockFrom).toHaveBeenCalled();
  });

  it('RS-001A: migrateLegacyChatCache moves cached conversations to the Lia user id', async () => {
    const legacyConversation = {
      id: 'conv-legacy',
      user_id: 'sofia-user-1',
      title: 'Chat legado',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    localStorage.setItem('lia_conversations_sofia-user-1', JSON.stringify([legacyConversation]));
    localStorage.setItem(
      'lia_pending_chat_state_sofia-user-1',
      JSON.stringify({
        conversationUpserts: { 'conv-legacy': legacyConversation },
        messageSnapshots: {},
        deletedConversationIds: [],
      }),
    );

    const { migrateLegacyChatCache } = await import('../../services/chat-service');
    migrateLegacyChatCache('sofia-user-1', 'lia-user-1');

    expect(localStorage.getItem('lia_conversations_sofia-user-1')).toBeNull();

    const migratedConversations = JSON.parse(localStorage.getItem('lia_conversations_lia-user-1') || '[]');
    expect(migratedConversations).toHaveLength(1);
    expect(migratedConversations[0].user_id).toBe('lia-user-1');

    const migratedPendingState = JSON.parse(localStorage.getItem('lia_pending_chat_state_lia-user-1') || '{}');
    expect(migratedPendingState.conversationUpserts['conv-legacy'].user_id).toBe('lia-user-1');
  });

  // RS-002: loadMessages calls Supabase select with order
  it('RS-002: loadMessages calls Supabase select with ascending order', async () => {
    const mockMessages = [
      { id: 'msg-1', role: 'user', content: 'Hola', created_at: '2026-01-01T00:00:00Z', metadata: {} },
      { id: 'msg-2', role: 'model', content: 'Hola, en que puedo ayudarte?', created_at: '2026-01-01T00:00:01Z', metadata: {} },
    ];
    mockOrder.mockResolvedValue({ data: mockMessages, error: null });

    const { loadMessages } = await import('../../services/chat-service');
    const messages = await loadMessages('conv-123');

    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('conversation_id', 'conv-123');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
  });

  // RS-003: createConversation returns null for empty userId
  it('RS-003: createConversation returns null if userId is empty', async () => {
    const { createConversation } = await import('../../services/chat-service');

    const result = await createConversation('', 'Test');

    expect(result).toBeNull();
  });

  // RS-004: loadMessages returns empty array when Supabase errors
  it('RS-004: loadMessages returns cached/empty on Supabase error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'Connection error', code: '500' } });

    const { loadMessages } = await import('../../services/chat-service');
    const messages = await loadMessages('conv-missing');

    expect(Array.isArray(messages)).toBe(true);
  });

  // RS-005: generateTitle extracts title from first user message
  it('RS-005: generateTitle produces a trimmed title from messages', async () => {
    const { generateTitle } = await import('../../services/chat-service');

    const messages = [
      { id: '1', role: 'user' as const, text: 'Necesito ayuda con mi proyecto de React', timestamp: Date.now() },
      { id: '2', role: 'model' as const, text: 'Claro, en que te ayudo?', timestamp: Date.now() },
    ];

    const title = generateTitle(messages);
    expect(typeof title).toBe('string');
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(60);
  });
});
