import { describe, it, expect } from 'vitest';
import './chat-service.setup';
import { mockDelete, mockDeleteIn, mockMessageUpsert, mockOrder } from './chat-service.setup';

describe('chat-service messages', () => {
  it('conserva la edición corta y oculta la rama sustituida ante una lectura remota vieja', async () => {
    const { saveMessages, loadMessages } = await import('../../services/chat-service');
    const conversationId = 'edicion-qa';
    const original = { id: 'usuario', role: 'user' as const, content: 'Una versión original que era mucho más larga', created_at: new Date(1).toISOString() };
    const reply = { id: 'antigua', role: 'model' as const, content: 'Respuesta vieja', created_at: new Date(2).toISOString() };
    const sibling = { id: 'otro-equipo', role: 'user' as const, content: 'Mensaje independiente', created_at: new Date(3).toISOString() };
    const revision = { editedAt: 4, supersedes: ['antigua'] };
    await saveMessages(conversationId, 'user-123', [{ id: original.id, role: original.role, timestamp: 1, text: 'Edición', revision }]);
    expect(mockMessageUpsert).toHaveBeenCalledWith([expect.objectContaining({ id: original.id, content: 'Edición', metadata: expect.objectContaining({ revision }) })], { onConflict: 'id' });
    mockOrder.mockResolvedValue({ error: null, data: [original, reply, sibling] });
    const reloaded = await loadMessages(conversationId, 'user-123');
    expect(reloaded.map(message => [message.id, message.text])).toEqual([[original.id, 'Edición'], [sibling.id, sibling.content]]);
    expect(mockDelete).not.toHaveBeenCalled();

    localStorage.clear();
    const { saveMessagesToCache } = await import('../../services/chat-service');
    saveMessagesToCache(conversationId, [
      { id: original.id, role: original.role, timestamp: 1, text: original.content },
      { id: reply.id, role: reply.role, timestamp: 2, text: reply.content },
      { id: 'sin-subir', role: 'model', timestamp: 2, text: 'Otra respuesta de la rama vieja' },
    ]);
    mockMessageUpsert.mockClear();
    const remoteRevision = { ...revision, supersedes: [...revision.supersedes, 'sin-subir'] };
    mockOrder.mockResolvedValue({ error: null, data: [{ ...original, content: 'Edición', metadata: { revision: remoteRevision } }, reply, sibling] });
    expect((await loadMessages(conversationId, 'user-123')).map(message => message.id)).toEqual([original.id, sibling.id]);
    expect(mockMessageUpsert).not.toHaveBeenCalled();
  });
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
