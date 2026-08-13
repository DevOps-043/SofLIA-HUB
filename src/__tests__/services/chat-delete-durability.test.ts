/**
 * Un chat borrado no vuelve.
 *
 * Regresion cubierta: PostgREST no devuelve error cuando la politica RLS deja el
 * DELETE en cero filas, y el codigo trataba ese exito aparente como borrado
 * hecho. Se limpiaba la cola pendiente, la conversacion seguia viva en Supabase
 * y reaparecia en la siguiente carga.
 */

import { describe, it, expect } from 'vitest';
import './chat-service.setup';
import { mockDeleteSelect, mockMaybeSingle, mockOrder } from './chat-service.setup';

const USER = 'lia-user-1';
const CONV = 'conv-borrada';

function conversacionRemota() {
  return {
    id: CONV,
    user_id: USER,
    title: 'Chat borrado',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('durabilidad del borrado de conversaciones', () => {
  it('no declara borrada una conversacion que la politica no dejo borrar', async () => {
    // Cero filas borradas y la conversacion sigue visible: permiso denegado.
    mockDeleteSelect.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: { id: CONV }, error: null });

    const { deleteConversationRemote } = await import('../../services/chat/remote');
    await expect(deleteConversationRemote(CONV)).resolves.toBe(false);
  });

  it('acepta el borrado idempotente cuando la conversacion ya no existe', async () => {
    mockDeleteSelect.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { deleteConversationRemote } = await import('../../services/chat/remote');
    await expect(deleteConversationRemote(CONV)).resolves.toBe(true);
  });

  it('mantiene oculta la conversacion aunque el borrado remoto falle y siga llegando desde Supabase', async () => {
    mockDeleteSelect.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: { id: CONV }, error: null });

    const { deleteConversation, loadConversations } = await import('../../services/chat-service');
    await deleteConversation(USER, CONV);

    // Supabase sigue devolviendola: es exactamente el escenario reportado.
    mockOrder.mockResolvedValue({ data: [conversacionRemota()], error: null });
    const conversaciones = await loadConversations(USER);

    expect(conversaciones.map((item) => item.id)).not.toContain(CONV);
    // La lapida es durable: sobrevive a que la cola pendiente se limpie.
    const lapidas = JSON.parse(localStorage.getItem(`lia_deleted_conversations_${USER}`) || '{}');
    expect(lapidas.ids).toContain(CONV);
  });

  it('ignora un guardado de mensajes que aterriza despues del borrado', async () => {
    const { deleteConversation, saveMessages } = await import('../../services/chat-service');
    await deleteConversation(USER, CONV);

    await saveMessages(CONV, USER, [
      { id: 'msg-1', role: 'user', text: 'Mensaje tardio', timestamp: Date.now() },
    ]);

    expect(localStorage.getItem(`lia_messages_${CONV}`)).toBeNull();
    const pendiente = JSON.parse(localStorage.getItem(`lia_pending_chat_state_${USER}`) || '{}');
    expect(pendiente.messageSnapshots?.[CONV]).toBeUndefined();
    expect(pendiente.conversationUpserts?.[CONV]).toBeUndefined();
  });

  it('no vuelve a subir una conversacion borrada que quedo en el cache de otra identidad', async () => {
    const { deleteConversation } = await import('../../services/chat-service');
    await deleteConversation(USER, CONV);

    // Cache que sobrevive en otra maquina o identidad, con mensajes locales.
    localStorage.setItem(`lia_conversations_${USER}`, JSON.stringify([conversacionRemota()]));
    localStorage.setItem(`lia_messages_${CONV}`, JSON.stringify([
      { id: 'msg-1', role: 'user', text: 'Hola', timestamp: 1767225600000 },
    ]));

    const { recoverPendingConversationsFromCache } = await import('../../services/chat/recovery');
    expect(recoverPendingConversationsFromCache(USER, new Set())).toEqual([]);
  });

  it('la migracion de identidad no arrastra conversaciones borradas', async () => {
    const { deleteConversation } = await import('../../services/chat-service');
    await deleteConversation('sofia-user-1', CONV);

    localStorage.setItem('lia_conversations_sofia-user-1', JSON.stringify([
      { ...conversacionRemota(), user_id: 'sofia-user-1' },
    ]));

    const { migrateLegacyChatCache } = await import('../../services/chat-service');
    migrateLegacyChatCache('sofia-user-1', USER);

    const migradas = JSON.parse(localStorage.getItem(`lia_conversations_${USER}`) || '[]');
    expect(migradas.map((item: { id: string }) => item.id)).not.toContain(CONV);
  });
});
