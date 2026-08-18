/**
 * Lo que un equipo borra, los demas lo aprenden.
 *
 * Escenario reportado: el usuario borra chats en el portatil, abre el equipo
 * principal y vuelven a aparecer; peor aun, el equipo principal los devolvia a
 * Supabase y reaparecian tambien en el portatil. La lapida local no viajaba, asi
 * que el borrado ahora vive en `conversations.deleted_at` y cada equipo lo
 * traduce a su propia lapida al cargar.
 */

import { describe, it, expect } from 'vitest';
import './chat-service.setup';
import { mockDeletedIdsLimit, mockSoftDeleteSelect, mockUpdate } from './chat-service.setup';

const USER = 'lia-user-1';
const OTRA_IDENTIDAD = 'sofia-user-1';
const CONV = 'conv-borrada-en-otro-equipo';

function sembrarEstadoLocal(): void {
  localStorage.setItem(`lia_conversations_${USER}`, JSON.stringify([{
    id: CONV,
    user_id: USER,
    title: 'Chat borrado en el portatil',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }]));
  localStorage.setItem(`lia_messages_${CONV}`, JSON.stringify([
    { id: 'msg-1', role: 'user', text: 'Hola', timestamp: 1767225600000 },
  ]));
  localStorage.setItem(`lia_pending_chat_state_${USER}`, JSON.stringify({
    conversationUpserts: {
      [CONV]: {
        id: CONV,
        user_id: USER,
        title: 'Chat borrado en el portatil',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    },
    messageSnapshots: { [CONV]: [{ id: 'msg-1', role: 'user', text: 'Hola', timestamp: 1767225600000 }] },
    deletedConversationIds: [],
  }));
}

describe('reconciliacion de borrados entre equipos', () => {
  it('convierte un deleted_at remoto en lapida local y limpia cache y cola', async () => {
    sembrarEstadoLocal();
    mockDeletedIdsLimit.mockResolvedValue({ data: [{ id: CONV }], error: null });

    const { reconcileRemoteConversationDeletions } = await import('../../services/chat/operations/reconcile-deletions');
    await expect(reconcileRemoteConversationDeletions(USER)).resolves.toEqual([CONV]);

    const lapidas = JSON.parse(localStorage.getItem(`lia_deleted_conversations_${USER}`) || '{}');
    expect(lapidas.ids).toContain(CONV);
    expect(JSON.parse(localStorage.getItem(`lia_conversations_${USER}`) || '[]')).toEqual([]);
    expect(localStorage.getItem(`lia_messages_${CONV}`)).toBeNull();
    // Sin purgar la cola, este equipo volveria a subir lo que el otro borro.
    const pendiente = JSON.parse(localStorage.getItem(`lia_pending_chat_state_${USER}`) || '{}');
    expect(pendiente.conversationUpserts?.[CONV]).toBeUndefined();
    expect(pendiente.messageSnapshots?.[CONV]).toBeUndefined();
  });

  it('no reencola la conversacion borrada aunque siga en el cache con mensajes', async () => {
    sembrarEstadoLocal();
    mockDeletedIdsLimit.mockResolvedValue({ data: [{ id: CONV }], error: null });

    const { reconcileRemoteConversationDeletions } = await import('../../services/chat/operations/reconcile-deletions');
    await reconcileRemoteConversationDeletions(USER);

    // Cache que vuelve a aparecer despues (otra pestana, otra identidad).
    localStorage.setItem(`lia_conversations_${USER}`, JSON.stringify([{
      id: CONV,
      user_id: USER,
      title: 'Chat borrado en el portatil',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }]));
    localStorage.setItem(`lia_messages_${CONV}`, JSON.stringify([
      { id: 'msg-1', role: 'user', text: 'Hola', timestamp: 1767225600000 },
    ]));

    const { recoverPendingConversationsFromCache } = await import('../../services/chat/recovery');
    expect(recoverPendingConversationsFromCache(USER, new Set())).toEqual([]);
  });

  it('marca tambien las identidades locales heredadas', async () => {
    localStorage.setItem(`lia_conversations_${OTRA_IDENTIDAD}`, JSON.stringify([]));
    mockDeletedIdsLimit.mockResolvedValue({ data: [{ id: CONV }], error: null });

    const { reconcileRemoteConversationDeletions } = await import('../../services/chat/operations/reconcile-deletions');
    await reconcileRemoteConversationDeletions(USER);

    const lapidasHeredadas = JSON.parse(localStorage.getItem(`lia_deleted_conversations_${OTRA_IDENTIDAD}`) || '{}');
    expect(lapidasHeredadas.ids).toContain(CONV);
  });

  it('no repite trabajo cuando el borrado ya era conocido', async () => {
    mockDeletedIdsLimit.mockResolvedValue({ data: [{ id: CONV }], error: null });

    const { reconcileRemoteConversationDeletions } = await import('../../services/chat/operations/reconcile-deletions');
    await reconcileRemoteConversationDeletions(USER);
    await expect(reconcileRemoteConversationDeletions(USER)).resolves.toEqual([]);
  });

  it('termina en Supabase un borrado que solo existia como lapida local', async () => {
    // Escenario heredado: el DELETE fisico se dio por hecho, la fila sobrevivio
    // y el otro equipo la sigue viendo.
    const { recordConversationTombstone } = await import('../../services/chat/tombstones');
    recordConversationTombstone(USER, CONV);
    mockSoftDeleteSelect.mockResolvedValue({ data: [{ id: CONV }], error: null });

    const { pushLocalTombstonesToRemote } = await import('../../services/chat/operations/reconcile-deletions');
    const remoto = [{
      id: CONV,
      user_id: USER,
      title: 'Chat que sobrevivio',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }];

    await expect(pushLocalTombstonesToRemote(USER, remoto)).resolves.toEqual([CONV]);
    expect(mockUpdate).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
  });

  it('no borra en Supabase una conversacion compartida por otra persona', async () => {
    const { recordConversationTombstone } = await import('../../services/chat/tombstones');
    recordConversationTombstone(USER, CONV);

    const { pushLocalTombstonesToRemote } = await import('../../services/chat/operations/reconcile-deletions');
    const remoto = [{
      id: CONV,
      user_id: 'otra-persona',
      title: 'Chat de otra persona',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }];

    await expect(pushLocalTombstonesToRemote(USER, remoto)).resolves.toEqual([]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('degrada sin ruido si la migracion de deleted_at no esta aplicada', async () => {
    sembrarEstadoLocal();
    mockDeletedIdsLimit.mockResolvedValue({
      data: null,
      error: { code: '42703', message: 'column conversations.deleted_at does not exist' },
    });

    const { reconcileRemoteConversationDeletions } = await import('../../services/chat/operations/reconcile-deletions');
    await expect(reconcileRemoteConversationDeletions(USER)).resolves.toEqual([]);
    expect(localStorage.getItem(`lia_deleted_conversations_${USER}`)).toBeNull();
    expect(JSON.parse(localStorage.getItem(`lia_conversations_${USER}`) || '[]')).toHaveLength(1);
  });
});
