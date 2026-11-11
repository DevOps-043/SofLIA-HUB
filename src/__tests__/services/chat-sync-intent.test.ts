import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, Conversation } from '../../services/chat/types';
import type { RemoteWriteOutcome } from '../../services/chat/remote/error-kind';
import { syncPendingChatState } from '../../services/chat/sync';
import { deleteConversation } from '../../services/chat/operations/conversation-mutations';
import { loadConversationsFromCache, loadMessagesFromCache, saveConversationToCache, saveMessagesToCache, getPendingChatStateKey, getConversationCacheKey, getMessageCacheKey, removeConversationFromAllCaches } from '../../services/chat/cache';
import { queueConversationUpsert, queueMessageSnapshot, queueConversationDelete, readPendingChatState, writePendingChatState, purgeConversationFromAllPendingStates } from '../../services/chat/pending-state';
import { recordConversationTombstone } from '../../services/chat/tombstones';
import { chatAuth } from './chat-auth.fixture';

const remote = vi.hoisted(() => ({
  configured: true,
  upsert: vi.fn<(entry: Conversation) => Promise<RemoteWriteOutcome<Conversation>>>(),
  messages: vi.fn<(id: string, user: string, messages: ChatMessage[]) => Promise<RemoteWriteOutcome<null>>>(),
  delete: vi.fn<(id: string) => Promise<boolean>>(),
}));
vi.mock('../../lib/supabase', async () => ({
  supabase: { auth: (await import('./chat-auth.fixture')).chatAuth.source }, isSupabaseConfigured: () => remote.configured,
}));
vi.mock('../../services/chat/remote', () => ({ deleteConversationRemote: remote.delete }));
vi.mock('../../services/chat/remote/conversation-mutations', () => ({ upsertConversationRemoteOutcome: remote.upsert }));
vi.mock('../../services/chat/remote/message-sync', () => ({ syncMessagesRemoteOutcome: remote.messages }));

const USER = 'identidad-ficticia', CHAT = 'chat-ficticio';
const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
let storageFrame: HTMLIFrameElement;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function conversation(id = CHAT, title = 'Anterior', user = USER): Conversation {
  return { id, title, user_id: user, created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z' };
}
function messages(text = 'Anterior'): ChatMessage[] { return [{ id: 'mensaje-ficticio', role: 'user', text, timestamp: 1 }]; }
function seedConversation(id = CHAT, title = 'Anterior', user = USER) {
  const entry = conversation(id, title, user); saveConversationToCache(user, entry); queueConversationUpsert(user, entry); return entry;
}
function seedMessages(id = CHAT, text = 'Anterior') {
  const entries = messages(text); saveMessagesToCache(id, entries); queueMessageSnapshot(USER, id, entries); return entries;
}
function pauseConversation() {
  const entered = deferred<void>(), reply = deferred<RemoteWriteOutcome<Conversation>>();
  remote.upsert.mockImplementationOnce(() => { entered.resolve(); return reply.promise; });
  return { entered, reply };
}
function pauseMessages() {
  const entered = deferred<void>(), reply = deferred<RemoteWriteOutcome<null>>();
  remote.messages.mockImplementationOnce(() => { entered.resolve(); return reply.promise; });
  return { entered, reply };
}
beforeEach(() => {
  vi.resetAllMocks();
  chatAuth.reset(USER);
  // Storage de jsdom en un documento sin recursos; no el Map del setup global.
  storageFrame = document.createElement('iframe'); document.body.append(storageFrame);
  Object.defineProperty(window, 'localStorage', { value: storageFrame.contentWindow!.localStorage, writable: true });
  expect(Object.prototype.toString.call(localStorage)).toBe('[object Storage]');
  localStorage.clear(); remote.configured = true;
  remote.upsert.mockImplementation(async entry => ({ ok: true, data: entry }));
  remote.messages.mockResolvedValue({ ok: true, data: null }); remote.delete.mockResolvedValue(true);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks(); localStorage.clear();
  Object.defineProperty(window, 'localStorage', storageDescriptor); storageFrame.remove();
});

describe('propiedad del contenido que sincroniza el chat', () => {
  it.each(['éxito', 'permanente'] as const)('conserva mensajes encolados durante una respuesta anterior: %s', async result => {
    seedMessages(); const gate = pauseMessages(), running = syncPendingChatState(USER); await gate.entered.promise;
    seedMessages(CHAT, 'Reciente');
    gate.reply.resolve(result === 'éxito' ? { ok: true, data: null } : { ok: false, permanente: true, message: 'rechazo ficticio' });
    await running;
    expect(readPendingChatState(USER).messageSnapshots[CHAT]?.[0]?.text).toBe('Reciente');
    expect(loadMessagesFromCache(CHAT)[0].text).toBe('Reciente');
  });
  it.each(['éxito', 'permanente'] as const)('conserva título encolado durante una respuesta anterior: %s', async result => {
    const old = seedConversation(), gate = pauseConversation(), running = syncPendingChatState(USER); await gate.entered.promise;
    seedConversation(CHAT, 'Reciente');
    gate.reply.resolve(result === 'éxito' ? { ok: true, data: old } : { ok: false, permanente: true, message: 'rechazo ficticio' });
    await running;
    expect(readPendingChatState(USER).conversationUpserts[CHAT]?.title).toBe('Reciente');
    expect(loadConversationsFromCache(USER)[0].title).toBe('Reciente');
  });
  it('conserva cache de mensajes adelantado a su turno en la cola', async () => {
    seedMessages(); saveMessagesToCache(CHAT, messages('Autosave reciente'));
    await syncPendingChatState(USER);
    expect(loadMessagesFromCache(CHAT)[0].text).toBe('Autosave reciente');
    expect(readPendingChatState(USER).messageSnapshots[CHAT]).toBeUndefined();
  });
  it('conserva cache de conversación adelantado a su turno en la cola', async () => {
    seedConversation(); saveConversationToCache(USER, conversation(CHAT, 'Título reciente'));
    await syncPendingChatState(USER);
    expect(loadConversationsFromCache(USER)[0].title).toBe('Título reciente');
  });
  it('no repuebla cache retirado mientras espera red', async () => {
    const old = seedConversation(), gate = pauseConversation(), running = syncPendingChatState(USER); await gate.entered.promise;
    localStorage.removeItem(getConversationCacheKey(USER)); gate.reply.resolve({ ok: true, data: old }); await running;
    expect(loadConversationsFromCache(USER)).toEqual([]);
  });
  it('un borrado del consumidor no revive desde el upsert en vuelo', async () => {
    const old = seedConversation(), gate = pauseConversation(), first = syncPendingChatState(USER); await gate.entered.promise;
    const deleting = deleteConversation(USER, CHAT);
    gate.reply.resolve({ ok: true, data: old }); await Promise.all([first, deleting]);
    expect(loadConversationsFromCache(USER)).toEqual([]);
    expect(readPendingChatState(USER).deletedConversationIds).toEqual([]); expect(remote.delete).toHaveBeenCalledOnce();
  });
  it('serializa efectos de la misma identidad y después escribe su versión reciente', async () => {
    const old = seedConversation(), gate = pauseConversation(), first = syncPendingChatState(USER); await gate.entered.promise;
    seedConversation(CHAT, 'Reciente'); const second = syncPendingChatState(USER);
    try { expect(remote.upsert).toHaveBeenCalledTimes(1); }
    finally { gate.reply.resolve({ ok: true, data: old }); await Promise.all([first, second]); }
    expect(remote.upsert.mock.calls.map(([entry]) => entry.title)).toEqual(['Anterior', 'Reciente']);
    expect(loadConversationsFromCache(USER)[0].title).toBe('Reciente'); expect(readPendingChatState(USER).conversationUpserts).toEqual({});
  });
  it('otro usuario progresa mientras una identidad espera', async () => {
    const old = seedConversation(), gate = pauseConversation(), first = syncPendingChatState(USER); await gate.entered.promise;
    seedConversation('otro-chat', 'Otro usuario', 'otra-identidad');
    chatAuth.change('SIGNED_IN', 'otra-identidad');
    try { await syncPendingChatState('otra-identidad'); expect(remote.upsert).toHaveBeenCalledTimes(2); }
    finally { gate.reply.resolve({ ok: true, data: old }); await first; }
  });
  it('une scopes pendientes sin escribir conversaciones ajenas al filtro', async () => {
    const old = seedConversation('activa'), gate = pauseConversation(), first = syncPendingChatState(USER, ['activa']); await gate.entered.promise;
    for (const id of ['primera', 'segunda', 'excluida']) seedConversation(id);
    const one = syncPendingChatState(USER, ['primera']), two = syncPendingChatState(USER, ['segunda']);
    try { expect(remote.upsert).toHaveBeenCalledTimes(1); }
    finally { gate.reply.resolve({ ok: true, data: old }); await Promise.all([first, one, two]); }
    expect(remote.upsert.mock.calls.map(([entry]) => entry.id).sort()).toEqual(['activa', 'primera', 'segunda']);
    expect(readPendingChatState(USER).conversationUpserts.excluida).toBeDefined();
  });
  it('una petición global pendiente conserva todos los destinos', async () => {
    const old = seedConversation('activa'), gate = pauseConversation(), first = syncPendingChatState(USER, ['activa']); await gate.entered.promise;
    seedConversation('dirigida'); seedConversation('global');
    const targeted = syncPendingChatState(USER, ['dirigida']), all = syncPendingChatState(USER);
    try { expect(remote.upsert).toHaveBeenCalledTimes(1); }
    finally { gate.reply.resolve({ ok: true, data: old }); await Promise.all([first, targeted, all]); }
    expect(remote.upsert.mock.calls.map(([entry]) => entry.id).sort()).toEqual(['activa', 'dirigida', 'global']);
  });
  it('no envía otro upsert capturado que fue revocado durante la espera', async () => {
    const old = seedConversation('primera'); seedConversation('segunda');
    // El orden normalizado de fechas iguales conserva inserción: usar filtro de llamada para pausar la primera enviada.
    const gate = pauseConversation(), running = syncPendingChatState(USER); await gate.entered.promise;
    const heldId = remote.upsert.mock.calls[0][0].id, revoked = heldId === 'primera' ? 'segunda' : 'primera';
    purgeConversationFromAllPendingStates(revoked); removeConversationFromAllCaches(revoked); queueConversationDelete(USER, revoked);
    gate.reply.resolve({ ok: true, data: { ...old, id: heldId } }); await running;
    expect(remote.upsert.mock.calls.map(([entry]) => entry.id)).not.toContain(revoked);
    expect(readPendingChatState(USER).deletedConversationIds).toContain(revoked);
  });
  it('el borrado heredado tiene prioridad sobre payloads contradictorios', async () => {
    writePendingChatState(USER, { conversationUpserts: { [CHAT]: conversation() }, messageSnapshots: { [CHAT]: messages() }, deletedConversationIds: [CHAT] });
    await syncPendingChatState(USER);
    expect(remote.delete).toHaveBeenCalledOnce(); expect(remote.upsert).not.toHaveBeenCalled(); expect(remote.messages).not.toHaveBeenCalled();
    expect(readPendingChatState(USER)).toEqual({ conversationUpserts: {}, messageSnapshots: {}, deletedConversationIds: [] });
  });
  it.each(['setItem', 'removeItem'] as const)('no publica si falla confirmar retirada mediante %s', async operation => {
    const old = seedConversation(); if (operation === 'setItem') seedConversation('otra');
    const gate = pauseConversation(), running = syncPendingChatState(USER, [CHAT]); await gate.entered.promise;
    const prototype = Object.getPrototypeOf(localStorage) as Storage;
    if (operation === 'setItem') {
      const original = localStorage.setItem;
      vi.spyOn(prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
        if (key === getPendingChatStateKey(USER)) throw new Error('Cuota ficticia');
        original.call(this, key, value);
      });
    } else {
      const original = localStorage.removeItem;
      vi.spyOn(prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
        if (key === getPendingChatStateKey(USER)) throw new Error('Cuota ficticia');
        original.call(this, key);
      });
    }
    gate.reply.resolve({ ok: true, data: { ...old, title: 'Respuesta canónica' } }); await running;
    expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
    expect(loadConversationsFromCache(USER).find(entry => entry.id === CHAT)?.title).toBe('Anterior');
  });
  it('un fallo inesperado no bloquea la pasada pendiente ni un ciclo posterior', async () => {
    seedConversation(); const gate = pauseConversation(), first = syncPendingChatState(USER);
    const failed = first.catch(error => error); await gate.entered.promise;
    seedConversation(CHAT, 'Pendiente'); const next = syncPendingChatState(USER);
    gate.reply.reject(new Error('Fallo ficticio')); expect(await failed).toBeInstanceOf(Error); await next;
    seedConversation(CHAT, 'Posterior'); await syncPendingChatState(USER);
    expect(remote.upsert.mock.calls.map(([entry]) => entry.title)).toEqual(['Anterior', 'Pendiente', 'Posterior']);
    expect(readPendingChatState(USER).conversationUpserts).toEqual({});
  });
  it('diez solicitudes durante una espera comparten una pasada con el contenido más reciente', async () => {
    const old = seedConversation(), gate = pauseConversation(), first = syncPendingChatState(USER); await gate.entered.promise;
    const requests: Promise<void>[] = [];
    for (let index = 1; index <= 10; index++) { seedConversation(CHAT, 'Versión ' + index); requests.push(syncPendingChatState(USER, [CHAT])); }
    try { expect(remote.upsert).toHaveBeenCalledTimes(1); }
    finally { gate.reply.resolve({ ok: true, data: old }); await Promise.all([first, ...requests]); }
    expect(remote.upsert.mock.calls.map(([entry]) => entry.title)).toEqual(['Anterior', 'Versión 10']);
    expect(loadConversationsFromCache(USER)[0].title).toBe('Versión 10');
  });
  it('solicitudes fusionadas esperan el resultado de todos sus destinos', async () => {
    const initial = deferred<RemoteWriteOutcome<Conversation>>(), last = deferred<RemoteWriteOutcome<Conversation>>();
    const entered = deferred<void>(), lastEntered = deferred<void>();
    remote.upsert.mockImplementation(entry => {
      if (entry.id === 'activa') { entered.resolve(); return initial.promise; }
      if (entry.id === 'última') { lastEntered.resolve(); return last.promise; }
      return Promise.resolve({ ok: true, data: entry });
    });
    const old = seedConversation('activa'), first = syncPendingChatState(USER); await entered.promise;
    seedConversation('primera'); const final = seedConversation('última'); let completed = false;
    const one = syncPendingChatState(USER, ['primera']).then(() => { completed = true; });
    const two = syncPendingChatState(USER, ['última']); initial.resolve({ ok: true, data: old }); await lastEntered.promise;
    try { expect(completed).toBe(false); }
    finally { last.resolve({ ok: true, data: final }); await Promise.all([first, one, two]); }
    expect(completed).toBe(true);
  });
  it('copia los IDs solicitados antes de esperar su turno', async () => {
    const old = seedConversation('activa'), gate = pauseConversation(), first = syncPendingChatState(USER, ['activa']); await gate.entered.promise;
    seedConversation('incluida'); seedConversation('ajena'); const ids = ['incluida'], next = syncPendingChatState(USER, ids);
    ids[0] = 'ajena'; gate.reply.resolve({ ok: true, data: old }); await Promise.all([first, next]);
    expect(remote.upsert.mock.calls.map(([entry]) => entry.id)).toEqual(['activa', 'incluida']);
  });
  it('revalida otro snapshot antes de enviarlo tras esperar mensajes anteriores', async () => {
    seedMessages('primera'); seedMessages('segunda');
    const gate = pauseMessages(), running = syncPendingChatState(USER); await gate.entered.promise;
    seedMessages('segunda', 'Reciente'); gate.reply.resolve({ ok: true, data: null }); await running;
    expect(remote.messages.mock.calls.map(([id]) => id)).toEqual(['primera']);
    expect(readPendingChatState(USER).messageSnapshots.segunda[0].text).toBe('Reciente');
  });
  it.each(['conversación', 'mensajes'] as const)('un fallo transitorio conserva %s con storage de jsdom', async kind => {
    if (kind === 'conversación') { seedConversation(); remote.upsert.mockResolvedValue({ ok: false, permanente: false, message: 'Red ficticia' }); }
    else { seedMessages(); remote.messages.mockResolvedValue({ ok: false, permanente: false, message: 'Red ficticia' }); }
    await syncPendingChatState(USER);
    const state = readPendingChatState(USER);
    expect(kind === 'conversación' ? state.conversationUpserts[CHAT] : state.messageSnapshots[CHAT]).toBeDefined();
  });
  it('no escribe la entrada heredada de otra identidad', async () => {
    writePendingChatState(USER, { conversationUpserts: { [CHAT]: conversation(CHAT, 'Ajena', 'otra-identidad') }, messageSnapshots: {}, deletedConversationIds: [] });
    await syncPendingChatState(USER);
    expect(remote.upsert).not.toHaveBeenCalled(); expect(readPendingChatState(USER).conversationUpserts).toEqual({});
  });
  it('una lápida durable excluye payloads huérfanos de escritura', async () => {
    seedConversation(); seedMessages(); recordConversationTombstone(USER, CHAT);
    await syncPendingChatState(USER);
    expect(remote.upsert).not.toHaveBeenCalled(); expect(remote.messages).not.toHaveBeenCalled();
    expect(readPendingChatState(USER)).toEqual({ conversationUpserts: {}, messageSnapshots: {}, deletedConversationIds: [] });
  });
  it('conserva mensajes cambiados sólo en cache durante la espera', async () => {
    seedMessages(); const gate = pauseMessages(), running = syncPendingChatState(USER); await gate.entered.promise;
    saveMessagesToCache(CHAT, messages('Cache reciente')); gate.reply.resolve({ ok: true, data: null }); await running;
    expect(loadMessagesFromCache(CHAT)[0].text).toBe('Cache reciente'); expect(readPendingChatState(USER).messageSnapshots).toEqual({});
  });
  it('conserva un título cambiado sólo en cache durante la espera', async () => {
    const old = seedConversation(), gate = pauseConversation(), running = syncPendingChatState(USER); await gate.entered.promise;
    saveConversationToCache(USER, conversation(CHAT, 'Cache reciente')); gate.reply.resolve({ ok: true, data: old }); await running;
    expect(loadConversationsFromCache(USER)[0].title).toBe('Cache reciente');
  });
  it('conserva cache corrupto para recuperación sin reemplazarlo desde una respuesta', async () => {
    seedMessages(); localStorage.setItem(getMessageCacheKey(CHAT), '{contenido-corrupto');
    await syncPendingChatState(USER);
    expect(localStorage.getItem(getMessageCacheKey(CHAT))).toBe('{contenido-corrupto');
    expect(readPendingChatState(USER).messageSnapshots).toEqual({}); expect(remote.messages).toHaveBeenCalledOnce();
  });
  it('no programa efectos sin identidad o configuración remota', async () => {
    seedConversation(); await syncPendingChatState(''); remote.configured = false; await syncPendingChatState(USER);
    expect(remote.upsert).not.toHaveBeenCalled(); expect(readPendingChatState(USER).conversationUpserts[CHAT]).toBeDefined();
  });
  it('el aviso de rechazo permanente no incorpora contenido ni error libre del proveedor', async () => {
    seedConversation(CHAT, 'CONTENIDO_PRIVADO_FICTICIO');
    remote.upsert.mockResolvedValue({ ok: false, permanente: true, message: 'ERROR_PRIVADO_FICTICIO' });
    await syncPendingChatState(USER);
    expect(console.warn).toHaveBeenCalledOnce();
    const logged = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logged).not.toContain('PRIVADO_FICTICIO'); expect(logged).not.toContain(USER); expect(logged).not.toContain(CHAT);
  });
});
