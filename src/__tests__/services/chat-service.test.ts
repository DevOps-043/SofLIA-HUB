import { describe, it, expect } from 'vitest';
import './chat-service.setup';
import { mockFrom, mockOrder, mockSelect, mockEq } from './chat-service.setup';

describe('chat-service conversations', () => {
  it('RS-001: createConversation calls Supabase insert via sync', async () => {
    const { createConversation } = await import('../../services/chat-service');
    const result = await createConversation('user-123', 'Test Chat');
    expect(result).not.toBeNull();
    expect(result?.user_id).toBe('user-123');
    expect(result?.title).toBe('Test Chat');
    expect(result?.id).toBeTruthy();
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
    localStorage.setItem('lia_pending_chat_state_sofia-user-1', JSON.stringify({
      conversationUpserts: { 'conv-legacy': legacyConversation },
      messageSnapshots: {},
      deletedConversationIds: [],
    }));

    const { migrateLegacyChatCache } = await import('../../services/chat-service');
    migrateLegacyChatCache('sofia-user-1', 'lia-user-1');

    expect(localStorage.getItem('lia_conversations_sofia-user-1')).toBeNull();
    const migrated = JSON.parse(localStorage.getItem('lia_conversations_lia-user-1') || '[]');
    expect(migrated).toHaveLength(1);
    expect(migrated[0].user_id).toBe('lia-user-1');
    const pending = JSON.parse(localStorage.getItem('lia_pending_chat_state_lia-user-1') || '{}');
    expect(pending.conversationUpserts['conv-legacy'].user_id).toBe('lia-user-1');
  });

  it('RS-002: loadMessages calls Supabase select with ascending order', async () => {
    mockOrder.mockResolvedValue({ data: [
      { id: 'msg-1', role: 'user', content: 'Hola', created_at: '2026-01-01T00:00:00Z', metadata: {} },
      { id: 'msg-2', role: 'model', content: 'Hola, en que puedo ayudarte?', created_at: '2026-01-01T00:00:01Z', metadata: {} },
    ], error: null });
    const { loadMessages } = await import('../../services/chat-service');
    const messages = await loadMessages('conv-123');
    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('conversation_id', 'conv-123');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
  });
});
