import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../../services/chat/types';
import type { RemoteWriteOutcome } from '../../services/chat/remote/error-kind';
import { syncPendingChatState } from '../../services/chat/sync';
import { saveConversationToCache, saveMessagesToCache, loadConversationsFromCache } from '../../services/chat/cache';
import { queueConversationUpsert, queueMessageSnapshot, queueConversationDelete, readPendingChatState } from '../../services/chat/pending-state';
import { chatAuth, type TestChatSession } from './chat-auth.fixture';

const remote = vi.hoisted(() => ({
  upsert: vi.fn<(entry: Conversation) => Promise<RemoteWriteOutcome<Conversation>>>(),
  messages: vi.fn<() => Promise<RemoteWriteOutcome<null>>>(),
  delete: vi.fn<() => Promise<boolean>>(),
}));
vi.mock('../../lib/supabase', async () => ({
  supabase: { auth: (await import('./chat-auth.fixture')).chatAuth.source }, isSupabaseConfigured: () => true,
}));
vi.mock('../../services/chat/remote', () => ({ deleteConversationRemote: remote.delete }));
vi.mock('../../services/chat/remote/conversation-mutations', () => ({ upsertConversationRemoteOutcome: remote.upsert }));
vi.mock('../../services/chat/remote/message-sync', () => ({ syncMessagesRemoteOutcome: remote.messages }));

const USER = 'lia-identidad-A', CHAT = 'chat-ficticio';
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject };
}
function seed(id = CHAT, title = 'Contenido local'): Conversation {
  const entry = { id, title, user_id: USER, created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z' };
  saveConversationToCache(USER, entry); queueConversationUpsert(USER, entry); return entry;
}
function seedMessages() {
  const messages = [{ id: 'mensaje-ficticio', role: 'user' as const, text: 'Contenido local', timestamp: 1 }];
  saveMessagesToCache(CHAT, messages); queueMessageSnapshot(USER, CHAT, messages);
}
function pausedUpsert() {
  const entered = deferred<void>(), response = deferred<RemoteWriteOutcome<Conversation>>();
  remote.upsert.mockImplementationOnce(() => { entered.resolve(); return response.promise; }); return { entered, response };
}
beforeEach(() => {
  vi.resetAllMocks(); chatAuth.reset(USER); localStorage.clear();
  remote.upsert.mockImplementation(async entry => ({ ok: true, data: entry }));
  remote.messages.mockResolvedValue({ ok: true, data: null }); remote.delete.mockResolvedValue(true);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); chatAuth.reset(null); localStorage.clear(); });

describe('sesión vigente del lote de chat', () => {
  it.each([null, 'lia-identidad-B'])('no envía el lote A con sesión %s', async subject => {
    seed(); seedMessages(); chatAuth.reset(subject); await syncPendingChatState(USER);
    expect(remote.upsert).not.toHaveBeenCalled(); expect(remote.messages).not.toHaveBeenCalled();
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
  });
  it('un error leyendo sesión conserva la cola sin efectos', async () => {
    seed(); chatAuth.source.getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('Fallo ficticio') });
    await syncPendingChatState(USER); expect(remote.upsert).not.toHaveBeenCalled();
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
  });
  it('un error al suscribir Auth no usa un fallback permisivo', async () => {
    seed(); chatAuth.source.onAuthStateChange.mockImplementationOnce(() => { throw new Error('Fallo ficticio'); });
    await syncPendingChatState(USER); expect(remote.upsert).not.toHaveBeenCalled();
  });
  it('cerrar sesión impide reconocer/publicar el upsert y comenzar los mensajes siguientes', async () => {
    const entry = seed(); seedMessages(); const gate = pausedUpsert(), running = syncPendingChatState(USER); await gate.entered.promise;
    chatAuth.change('SIGNED_OUT', null); gate.response.resolve({ ok: true, data: { ...entry, title: 'Respuesta anterior' } }); await running;
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
    expect(loadConversationsFromCache(USER)[0].title).toBe('Contenido local'); expect(remote.messages).not.toHaveBeenCalled();
  });
  it.each(['éxito', 'permanente'] as const)('no reconoce mensajes tras cambiar de cuenta: %s', async result => {
    seedMessages(); const entered = deferred<void>(), response = deferred<RemoteWriteOutcome<null>>();
    remote.messages.mockImplementationOnce(() => { entered.resolve(); return response.promise; });
    const running = syncPendingChatState(USER); await entered.promise; chatAuth.change('SIGNED_IN', 'lia-identidad-B');
    response.resolve(result === 'éxito' ? { ok: true, data: null } : { ok: false, permanente: true, message: 'Rechazo ficticio' }); await running;
    expect(readPendingChatState(USER).messageSnapshots[CHAT]).toBeDefined(); expect(console.warn).not.toHaveBeenCalled();
  });
  it('no reconoce un borrado si su respuesta llega tras salir', async () => {
    queueConversationDelete(USER, CHAT); const entered = deferred<void>(), response = deferred<boolean>();
    remote.delete.mockImplementationOnce(() => { entered.resolve(); return response.promise; });
    const running = syncPendingChatState(USER); await entered.promise; chatAuth.change('SIGNED_OUT', null);
    response.resolve(true); await running; expect(readPendingChatState(USER).deletedConversationIds).toContain(CHAT);
  });
  it('A/B/A no reactiva un lote anterior', async () => {
    const entry = seed(), gate = pausedUpsert(), running = syncPendingChatState(USER); await gate.entered.promise;
    chatAuth.change('SIGNED_IN', 'lia-identidad-B'); chatAuth.change('SIGNED_IN', USER);
    gate.response.resolve({ ok: true, data: entry }); await running;
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
  });
  it.each(['TOKEN_REFRESHED', 'SIGNED_IN'])('el evento %s repetido de la misma identidad conserva el lote', async event => {
    const entry = seed(), gate = pausedUpsert(), running = syncPendingChatState(USER); await gate.entered.promise;
    chatAuth.change(event, USER); gate.response.resolve({ ok: true, data: entry }); await running;
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeUndefined();
  });
  it.each([false, true])('no hereda el scope pendiente revocado en otro ciclo; global=%s', async global => {
    const entry = seed('activa'), gate = pausedUpsert(), first = syncPendingChatState(USER, ['activa']); await gate.entered.promise;
    seed('pendiente-anterior'); const previous = syncPendingChatState(USER, global ? undefined : ['pendiente-anterior']);
    chatAuth.change('SIGNED_IN', 'lia-identidad-B'); chatAuth.change('SIGNED_IN', USER);
    seed('solicitud-nueva'); const next = syncPendingChatState(USER, ['solicitud-nueva']);
    gate.response.resolve({ ok: true, data: entry }); await Promise.all([first, previous, next]);
    expect(remote.upsert.mock.calls.map(([row]) => row.id)).toEqual(['activa', 'solicitud-nueva']);
    expect(readPendingChatState(USER).conversationUpserts['pendiente-anterior']).toBeDefined();
    expect(readPendingChatState(USER).conversationUpserts.activa).toBeDefined();
  });
  it('una lectura inicial A tardía no reemplaza el cierre observado', async () => {
    seed(); const snapshot = deferred<{ data: { session: TestChatSession | null }; error: Error | null }>();
    chatAuth.source.getSession.mockImplementationOnce(() => snapshot.promise);
    const running = syncPendingChatState(USER); await Promise.resolve(); chatAuth.change('SIGNED_OUT', null);
    snapshot.resolve({ data: { session: { user: { id: USER } } }, error: null }); await running;
    expect(remote.upsert).not.toHaveBeenCalled(); expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
  });
  it('INITIAL_SESSION tardío no restaura una sesión cerrada', async () => {
    const entry = seed(), gate = pausedUpsert(), running = syncPendingChatState(USER); await gate.entered.promise;
    chatAuth.change('SIGNED_OUT', null); chatAuth.notify('INITIAL_SESSION', USER);
    gate.response.resolve({ ok: true, data: entry }); await running;
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
  });
  it('libera listener al quedar ocioso y obtiene revisión nueva para otra solicitud', async () => {
    seed(); await syncPendingChatState(USER); expect(chatAuth.listeners.size).toBe(0); expect(chatAuth.unsubscribe).toHaveBeenCalledOnce();
    seed(CHAT, 'Nuevo ciclo'); await syncPendingChatState(USER);
    expect(chatAuth.source.getSession).toHaveBeenCalledTimes(2); expect(chatAuth.unsubscribe).toHaveBeenCalledTimes(2);
  });
  it('un fallo de unsubscribe no bloquea futuros coordinadores', async () => {
    seed(); chatAuth.unsubscribe.mockImplementationOnce(() => { throw new Error('Detalle privado ficticio'); });
    await expect(syncPendingChatState(USER)).resolves.toBeUndefined();
    seed(CHAT, 'Nueva solicitud'); await syncPendingChatState(USER);
    expect(chatAuth.unsubscribe).toHaveBeenCalledTimes(2); expect(chatAuth.listeners.size).toBe(0);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('Detalle privado');
  });
  it('un evento de cierre libera una lectura inicial aún pendiente y descarta su resultado tardío', async () => {
    seed(); const snapshot = deferred<{ data: { session: TestChatSession | null }; error: Error | null }>();
    chatAuth.source.getSession.mockImplementationOnce(() => snapshot.promise);
    const running = syncPendingChatState(USER); await Promise.resolve(); chatAuth.change('SIGNED_OUT', null);
    try {
      await running; expect(chatAuth.unsubscribe).toHaveBeenCalledOnce(); expect(remote.upsert).not.toHaveBeenCalled();
    } finally { snapshot.resolve({ data: { session: { user: { id: USER } } }, error: null }); await Promise.resolve(); }
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
  });
  it('un evento inicial síncrono evita una lectura redundante dentro del callback', async () => {
    seed(); const subscribe = chatAuth.source.onAuthStateChange.getMockImplementation()!;
    chatAuth.source.onAuthStateChange.mockImplementationOnce(callback => {
      const result = subscribe(callback); callback('INITIAL_SESSION', { user: { id: USER } }); return result;
    });
    await syncPendingChatState(USER);
    expect(remote.upsert).toHaveBeenCalledOnce(); expect(chatAuth.source.getSession).not.toHaveBeenCalled();
    expect(chatAuth.unsubscribe).toHaveBeenCalledOnce();
  });
  it.each(['TOKEN_REFRESHED', 'USER_UPDATED'])('un evento %s con otro sujeto también revoca la revisión', async event => {
    const entry = seed(), gate = pausedUpsert(), running = syncPendingChatState(USER); await gate.entered.promise;
    chatAuth.change(event, 'lia-identidad-B'); gate.response.resolve({ ok: true, data: entry }); await running;
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
  });
  it('el callback de Auth es síncrono y no vuelve a consultar al SDK', async () => {
    const entry = seed(), gate = pausedUpsert(), running = syncPendingChatState(USER); await gate.entered.promise;
    const listener = [...chatAuth.listeners][0], reads = chatAuth.source.getSession.mock.calls.length;
    try {
      expect(listener('TOKEN_REFRESHED', { user: { id: USER } })).toBeUndefined();
      expect(chatAuth.source.getSession).toHaveBeenCalledTimes(reads);
    } finally { gate.response.resolve({ ok: true, data: entry }); await running; }
  });
  it('un cierre seguido de la misma cuenta no revive el lote anterior', async () => {
    const entry = seed(), gate = pausedUpsert(), running = syncPendingChatState(USER); await gate.entered.promise;
    chatAuth.change('SIGNED_OUT', null); chatAuth.change('SIGNED_IN', USER);
    gate.response.resolve({ ok: true, data: entry }); await running;
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
  });
  it('un rechazo inesperado del lector bloquea el lote pero permite un intento nuevo', async () => {
    seed(); chatAuth.source.getSession.mockRejectedValueOnce(new Error('Detalle privado de QA'));
    await syncPendingChatState(USER); expect(remote.upsert).not.toHaveBeenCalled();
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
    await syncPendingChatState(USER); expect(remote.upsert).toHaveBeenCalledOnce();
    expect(chatAuth.unsubscribe).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('Detalle privado');
  });
  it.each(['otro sujeto', 'error'] as const)('un resultado inicial tardío de %s no sustituye el evento vigente', async result => {
    const entry = seed(), snapshot = deferred<{ data: { session: TestChatSession | null }; error: Error | null }>();
    chatAuth.source.getSession.mockImplementationOnce(() => snapshot.promise);
    const gate = pausedUpsert(), running = syncPendingChatState(USER); await Promise.resolve();
    chatAuth.notify('INITIAL_SESSION', USER); await gate.entered.promise;
    if (result === 'otro sujeto') snapshot.resolve({ data: { session: { user: { id: 'lia-identidad-B' } } }, error: null });
    else snapshot.reject(new Error('Lectura antigua ficticia'));
    await Promise.resolve(); gate.response.resolve({ ok: true, data: entry }); await running;
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeUndefined(); expect(console.warn).not.toHaveBeenCalled();
  });
});
