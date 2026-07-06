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

  it('RS-005: generateTitle produces a short semantic title from messages', async () => {
    const { generateTitle } = await import('../../services/chat-service');
    const title = generateTitle([
      { id: '1', role: 'user' as const, text: 'Necesito ayuda con mi proyecto de React', timestamp: Date.now() },
      { id: '2', role: 'model' as const, text: 'Claro, en que te ayudo?', timestamp: Date.now() },
    ]);
    expect(title).toBe('Proyecto React');
    expect(title.length).toBeLessThanOrEqual(44);
  });

  it('RS-006: generateTitle removes prompt filler and keeps useful chat context', async () => {
    const { generateTitle } = await import('../../services/chat-service');
    const title = generateTitle([
      { id: '1', role: 'user' as const, text: 'Cual es la diferencia entre procesos y proyectos empresariales?', timestamp: Date.now() },
    ]);
    expect(title).toBe('Diferencia procesos proyectos empresariales');
  });

  it('RS-007: generateTitle avoids using a greeting as the chat title', async () => {
    const { generateTitle } = await import('../../services/chat-service');
    const title = generateTitle([
      { id: '1', role: 'user' as const, text: 'Hola', timestamp: Date.now() },
    ]);
    expect(title).toBe('Conversacion inicial');
  });
});
