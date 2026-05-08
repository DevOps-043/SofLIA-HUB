import { describe, it, expect } from 'vitest';
import './chat-service.setup';
import { mockDelete, mockDeleteIn, mockMessageUpsert, mockOrder } from './chat-service.setup';

describe('chat-service messages', () => {
  it('RS-002A: saveMessages preserves created_at and avoids deleting remote siblings', async () => {
    const { createConversation, saveMessages } = await import('../../services/chat-service');
    const conversation = await createConversation('user-123', 'Test Chat');
    expect(conversation).not.toBeNull();
    await saveMessages(conversation!.id, 'user-123', [{
      id: 'msg-1',
      role: 'user',
      text: 'Hola desde otro dispositivo',
      timestamp: Date.parse('2026-01-01T00:00:00.000Z'),
    }]);
    expect(mockMessageUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'msg-1',
        conversation_id: conversation!.id,
        user_id: 'user-123',
        created_at: '2026-01-01T00:00:00.000Z',
      }),
    ], { onConflict: 'id' });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockDeleteIn).not.toHaveBeenCalled();
  });

  it('RS-003: createConversation returns null if userId is empty', async () => {
    const { createConversation } = await import('../../services/chat-service');
    await expect(createConversation('', 'Test')).resolves.toBeNull();
  });

  it('RS-004: loadMessages returns cached/empty on Supabase error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'Connection error', code: '500' } });
    const { loadMessages } = await import('../../services/chat-service');
    const messages = await loadMessages('conv-missing');
    expect(Array.isArray(messages)).toBe(true);
  });

  it('RS-005: generateTitle produces a trimmed title from messages', async () => {
    const { generateTitle } = await import('../../services/chat-service');
    const title = generateTitle([
      { id: '1', role: 'user' as const, text: 'Necesito ayuda con mi proyecto de React', timestamp: Date.now() },
      { id: '2', role: 'model' as const, text: 'Claro, en que te ayudo?', timestamp: Date.now() },
    ]);
    expect(typeof title).toBe('string');
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(60);
  });
});
