import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPermanentWriteError } from '../../services/chat/remote/error-kind';
import type { ChatMessage, Conversation } from '../../services/chat/types';

/**
 * Reproduce el bucle observado en produccion: miles de
 * `42501 new row violates row-level security policy` por hora sobre
 * `conversations` y `messages`, sostenidos durante una hora.
 *
 * La cola de estado pendiente reintenta lo que falla —correcto para una red
 * intermitente— pero no distinguia un rechazo de autorizacion, que no va a
 * cambiar nunca. La fila se quedaba en la cola, cada guardado la reenviaba y el
 * registro de Supabase se llenaba. Estas pruebas fijan que un fallo permanente
 * saca la entrada de la cola y uno transitorio la conserva.
 */

const upsertConversacion = vi.hoisted(() => vi.fn());
const upsertMensajes = vi.hoisted(() => vi.fn());
const limpiarUpsert = vi.hoisted(() => vi.fn());
const limpiarSnapshot = vi.hoisted(() => vi.fn());
const pendientes = vi.hoisted(() => ({ conversaciones: [] as Conversation[], snapshots: {} as Record<string, ChatMessage[]> }));

vi.mock('../../lib/supabase', () => ({
  supabase: {},
  isSupabaseConfigured: () => true,
}));

vi.mock('../../services/chat/cache', () => ({
  saveConversationToCache: vi.fn(),
  saveMessagesToCache: vi.fn(),
}));

vi.mock('../../services/chat/pending-state', () => ({
  clearPendingConversationDelete: vi.fn(),
  clearPendingConversationUpsert: limpiarUpsert,
  clearPendingMessageSnapshot: limpiarSnapshot,
  getPendingConversationUpserts: () => pendientes.conversaciones,
  readPendingChatState: () => ({
    deletedConversationIds: [],
    conversationUpserts: {},
    messageSnapshots: pendientes.snapshots,
  }),
}));

vi.mock('../../services/chat/remote', () => ({
  deleteConversationRemote: vi.fn(),
}));

vi.mock('../../services/chat/remote/conversation-mutations', () => ({
  upsertConversationRemoteOutcome: upsertConversacion,
}));

vi.mock('../../services/chat/remote/message-sync', () => ({
  syncMessagesRemoteOutcome: upsertMensajes,
}));

const { syncPendingChatState } = await import('../../services/chat/sync');

const USUARIO = '794c1b56-37da-4d60-b292-93115310e9c3';
const OTRA_IDENTIDAD = 'c4f12aa6-a09d-4e45-8332-daac6fcb5c3d';

function conversacion(extra: Partial<Conversation> = {}): Conversation {
  return {
    id: 'a293d695-d757-459d-be8f-81a201dc72c4',
    user_id: USUARIO,
    title: 'Auditoria de seguridad Jarvis',
    created_at: '2026-07-06T00:12:45.043Z',
    updated_at: '2026-08-10T23:00:00.000Z',
    ...extra,
  } as Conversation;
}

describe('sincronizacion del estado pendiente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendientes.conversaciones = [];
    pendientes.snapshots = {};
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('clasificacion del error', () => {
    it('un rechazo de RLS es permanente', () => {
      expect(isPermanentWriteError({ code: '42501', message: 'new row violates row-level security policy' })).toBe(true);
    });

    it('una clave foranea rota o un uuid invalido son permanentes', () => {
      expect(isPermanentWriteError({ code: '23503' })).toBe(true);
      expect(isPermanentWriteError({ code: '22P02' })).toBe(true);
    });

    it('un fallo de red o de servidor NO es permanente', () => {
      expect(isPermanentWriteError({ message: 'Failed to fetch' })).toBe(false);
      expect(isPermanentWriteError({ code: '08006' })).toBe(false);
      expect(isPermanentWriteError(null)).toBe(false);
    });
  });

  describe('conversaciones', () => {
    it('un rechazo de RLS saca la conversacion de la cola', async () => {
      pendientes.conversaciones = [conversacion()];
      upsertConversacion.mockResolvedValue({
        ok: false,
        permanente: true,
        message: 'new row violates row-level security policy for table "conversations"',
      });

      await syncPendingChatState(USUARIO);

      expect(limpiarUpsert).toHaveBeenCalledWith(USUARIO, conversacion().id);
    });

    it('un fallo transitorio la conserva para el siguiente intento', async () => {
      pendientes.conversaciones = [conversacion()];
      upsertConversacion.mockResolvedValue({ ok: false, permanente: false, message: 'Failed to fetch' });

      await syncPendingChatState(USUARIO);

      expect(limpiarUpsert).not.toHaveBeenCalled();
    });

    it('no intenta escribir una conversacion de otra identidad', async () => {
      // Es el caso real: la copia local quedo reetiquetada con la identidad
      // activa mientras la fila remota conserva su dueño.
      pendientes.conversaciones = [conversacion({ user_id: OTRA_IDENTIDAD })];

      await syncPendingChatState(USUARIO);

      expect(upsertConversacion).not.toHaveBeenCalled();
      expect(limpiarUpsert).toHaveBeenCalledWith(USUARIO, conversacion().id);
    });

    it('sigue guardando lo que si es suyo', async () => {
      pendientes.conversaciones = [conversacion()];
      upsertConversacion.mockResolvedValue({ ok: true, data: conversacion() });

      await syncPendingChatState(USUARIO);

      expect(upsertConversacion).toHaveBeenCalledTimes(1);
      expect(limpiarUpsert).toHaveBeenCalledWith(USUARIO, conversacion().id);
    });
  });

  describe('mensajes', () => {
    beforeEach(() => {
      pendientes.snapshots = { 'a293d695-d757-459d-be8f-81a201dc72c4': [] };
    });

    it('un rechazo de RLS saca el snapshot de la cola', async () => {
      upsertMensajes.mockResolvedValue({
        ok: false,
        permanente: true,
        message: 'new row violates row-level security policy for table "messages"',
      });

      await syncPendingChatState(USUARIO);

      expect(limpiarSnapshot).toHaveBeenCalledWith(USUARIO, 'a293d695-d757-459d-be8f-81a201dc72c4');
    });

    it('un fallo transitorio lo conserva', async () => {
      upsertMensajes.mockResolvedValue({ ok: false, permanente: false, message: 'timeout' });

      await syncPendingChatState(USUARIO);

      expect(limpiarSnapshot).not.toHaveBeenCalled();
    });
  });
});
