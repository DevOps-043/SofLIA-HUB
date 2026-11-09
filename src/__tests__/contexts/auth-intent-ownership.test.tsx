import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { session, deferred } from './auth-lifecycle.fixture';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(), signOut: vi.fn(), read: vi.fn(), profile: vi.fn(), subscribe: vi.fn(),
  liaRead: vi.fn(), liaOut: vi.fn(), publish: vi.fn(), createSso: vi.fn(), openSso: vi.fn(),
  exchangeSso: vi.fn(), completeSso: vi.fn(), consumeSso: vi.fn(), subscribeSso: vi.fn(),
  isOrb: vi.fn(),
  clearLocalProfile: vi.fn(),
  sdk: null as Session | null,
  event: null as ((event: string, value: Session | null) => void) | null,
  ssoEvent: null as ((value: { state: string; ticket: string | null; error: string | null }) => void) | null,
}));

vi.mock('../../lib/sofia-client', () => ({ isSofiaConfigured: () => true, sofiaSupa: null }));
vi.mock('../../lib/supabase', () => ({ supabase: {
  auth: { getSession: mocks.liaRead, refreshSession: vi.fn(async () => ({ data: { session: null } })),
    signOut: mocks.liaOut, verifyOtp: vi.fn(), onAuthStateChange: vi.fn() },
  functions: { invoke: vi.fn() },
} }));
vi.mock('../../services/sofia-auth', () => ({ sofiaAuth: {
  getSession: mocks.read, signInWithSofia: mocks.signIn, signOut: mocks.signOut,
  clearLocalProfile: mocks.clearLocalProfile,
  fetchSofiaUserProfile: mocks.profile, onAuthStateChange: mocks.subscribe,
  completeSofiaSsoSession: mocks.completeSso,
} }));
vi.mock('../../services/auth-state', () => ({ isOrbWindowRenderer: mocks.isOrb, publishAuthState: mocks.publish }));
vi.mock('../../services/learning-sso', async () => ({
  ...await vi.importActual<typeof import('../../services/learning-sso')>('../../services/learning-sso'),
  isLearningSsoAvailable: () => true, createLearningSsoRequest: mocks.createSso,
  openLearningSso: mocks.openSso, exchangeTicketForSofiaSession: mocks.exchangeSso,
  consumePendingLearningSsoCallback: mocks.consumeSso, subscribeToLearningSsoCallback: mocks.subscribeSso,
}));

import { useAuthProviderModel } from '../../contexts/auth/useAuthProviderModel';

function profile(id = 'a') {
  return { id, email: `${id}@example.invalid`,
    memberships: [{ status: 'active', organization_id: `org-${id}`, team_id: `team-${id}` }],
    organizations: [{ id: `org-${id}`, name: `Organización ${id}` }],
    teams: [{ id: `team-${id}`, name: `Equipo ${id}`, organization_id: `org-${id}` }] };
}
function reply(id = 'a') {
  return { success: true, user: { id, email: `${id}@example.invalid` }, session: session(id), sofiaProfile: profile(id) };
}
function request(id = 'a') { return { state: id.repeat(22), codeVerifier: id.repeat(43), codeChallenge: id.repeat(43) }; }
async function flush() { await act(async () => { await Promise.resolve(); }); }
async function mount() {
  const view = renderHook(() => useAuthProviderModel());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}
async function login(view: Awaited<ReturnType<typeof mount>>, id = 'a') {
  await act(async () => { await view.result.current.signInWithSofia(`${id}@example.invalid`, 'clave-ficticia'); });
}

beforeEach(() => {
  Object.values(mocks).forEach(mock => { if (typeof mock === 'function' && 'mockReset' in mock) mock.mockReset(); });
  mocks.sdk = null; mocks.event = null; mocks.ssoEvent = null;
  mocks.read.mockImplementation(async () => mocks.sdk);
  mocks.profile.mockImplementation(async (id: string) => profile(id));
  mocks.subscribe.mockImplementation(callback => {
    mocks.event = callback;
    return { data: { subscription: { unsubscribe: vi.fn(() => { mocks.event = null; }) } } };
  });
  mocks.signIn.mockImplementation(async (email: string) => {
    const id = email.split('@')[0]; mocks.sdk = session(id);
    return reply(id);
  });
  mocks.signOut.mockImplementation(async () => { mocks.sdk = null; });
  mocks.liaOut.mockResolvedValue({ error: null });
  mocks.liaRead.mockImplementation(async () => ({ data: { session: mocks.sdk } }));
  mocks.publish.mockResolvedValue(true);
  mocks.isOrb.mockReturnValue(false);
  mocks.createSso.mockResolvedValue(request());
  mocks.openSso.mockResolvedValue(undefined);
  mocks.exchangeSso.mockResolvedValue(session());
  mocks.completeSso.mockImplementation(async (value: Session) => { mocks.sdk = value; return reply(value.user.id); });
  mocks.consumeSso.mockResolvedValue(null);
  mocks.subscribeSso.mockImplementation(callback => { mocks.ssoEvent = callback; return vi.fn(() => { mocks.ssoEvent = null; }); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Ownership integrado de intenciones Auth', () => {
  it('un login pendiente no restaura identidad después de pedir cierre', async () => {
    const pending = deferred<ReturnType<typeof reply>>();
    mocks.signIn.mockReturnValue(pending.promise);
    const view = await mount();
    let work!: Promise<unknown>;
    act(() => { work = view.result.current.signInWithSofia('a@example.invalid', 'clave-ficticia'); });
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    let closing!: Promise<void>;
    act(() => { closing = view.result.current.signOut(); });
    pending.resolve(reply());
    await act(async () => { await Promise.all([work, closing]); });
    expect(view.result.current.user).toBeNull();
    expect(view.result.current.session).toBeNull();
    expect(view.result.current.sofiaContext).toBeNull();
  });

  it('cierra estado y publica revocación antes de esperar logout o lectura de token', async () => {
    const view = await mount();
    await login(view);
    const network = deferred<void>();
    const token = deferred<Session | null>();
    mocks.signOut.mockReturnValue(network.promise);
    mocks.read.mockReturnValue(token.promise);
    mocks.publish.mockClear();
    let closing!: Promise<void>;
    act(() => { closing = view.result.current.signOut(); });
    await flush();
    try {
      expect(view.result.current.user).toBeNull();
      expect(mocks.clearLocalProfile).toHaveBeenCalledOnce();
      expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ authenticated: false, userId: null }));
    } finally {
      network.resolve(); token.resolve(null);
      await act(async () => { await closing; });
    }
  });

  it('ordena mutaciones SDK y sólo acepta el acceso más reciente', async () => {
    const pending = deferred<ReturnType<typeof reply>>();
    mocks.signIn.mockReturnValueOnce(pending.promise);
    const view = await mount();
    let first!: Promise<unknown>, second!: Promise<unknown>;
    act(() => { first = view.result.current.signInWithSofia('a@example.invalid', 'clave-ficticia'); });
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    act(() => { second = view.result.current.signInWithSofia('b@example.invalid', 'clave-ficticia'); });
    await flush();
    try { expect(mocks.signIn).toHaveBeenCalledOnce(); } finally {
      pending.resolve(reply());
      await act(async () => { await Promise.all([first, second]); });
    }
    expect(view.result.current.user?.id).toBe('b');
    expect(view.result.current.dataUserId).toBe('b');
  });

  it('acepta SIGNED_IN del propio login sin disparar dos recuperaciones', async () => {
    mocks.signIn.mockImplementation(async () => {
      mocks.sdk = session(); mocks.event?.('SIGNED_IN', mocks.sdk); return reply();
    });
    const view = await mount();
    await login(view);
    expect(view.result.current.user?.id).toBe('a');
    expect(mocks.liaRead).toHaveBeenCalledOnce();
  });

  it('reintenta una publicación rechazada y cancela el siguiente intento al cerrar sesión', async () => {
    const view = await mount();
    vi.useFakeTimers();
    try {
      mocks.publish.mockClear();
      mocks.publish.mockImplementation(async ({ authenticated }) => !authenticated);
      await login(view);
      const positive = () => mocks.publish.mock.calls.filter(([value]) => value.authenticated);
      const initial = positive().length;
      expect(initial).toBeGreaterThan(0);
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      expect(positive()).toHaveLength(initial + 1);
      await act(async () => { await view.result.current.signOut(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
      expect(positive()).toHaveLength(initial + 1);
      expect(mocks.publish).toHaveBeenLastCalledWith({ authenticated: false, userId: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('sale del workspace si main confirma que la sesión SOFIA fue revocada', async () => {
    const view = await mount();
    mocks.publish.mockImplementation(async ({ authenticated }) => authenticated ? 'revoked' : true);
    await login(view);
    await waitFor(() => expect(view.result.current.user).toBeNull());
    expect(view.result.current.session).toBeNull();
    expect(mocks.publish).toHaveBeenLastCalledWith({ authenticated: false, userId: null });
  });

  it('publica SOFIA antes de que responda Lia y conserva su correo autenticado', async () => {
    const view = await mount();
    const lia = deferred<{ data: { session: Session } }>();
    mocks.read.mockClear();
    mocks.liaRead.mockReturnValueOnce(lia.promise);
    mocks.signIn.mockResolvedValueOnce({ ...reply(), user: { id: 'a', email: 'perfil-anterior@example.invalid' } });
    let work!: Promise<unknown>;
    act(() => { work = view.result.current.signInWithSofia('a@example.invalid', 'clave-ficticia'); });
    try {
      await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
        authenticated: true, userId: 'a', sofiaAccessToken: session().access_token, accessToken: null,
      })));
      expect(mocks.read).not.toHaveBeenCalled();
    } finally {
      lia.resolve({ data: { session: session() } });
      await act(async () => { await work; });
    }
    expect(view.result.current.session?.user.email).toBe('a@example.invalid');
    expect(mocks.liaOut).not.toHaveBeenCalled();
  });

  it('un reintento del directorio no publica contexto después del cierre', async () => {
    const view = await mount();
    await login(view);
    const pending = deferred<ReturnType<typeof profile>>();
    mocks.profile.mockReturnValue(pending.promise);
    let retry!: Promise<boolean>;
    act(() => { retry = view.result.current.retrySofiaContext(); });
    await act(async () => { await view.result.current.signOut(); });
    pending.resolve(profile());
    await act(async () => { await retry; });
    expect(view.result.current.user).toBeNull();
    expect(view.result.current.sofiaContext).toBeNull();
  });

  it('cancelar SSO mientras se crea la solicitud impide abrir navegador', async () => {
    const pending = deferred<ReturnType<typeof request>>();
    mocks.createSso.mockReturnValue(pending.promise);
    const view = await mount();
    let work!: Promise<void>;
    act(() => { work = view.result.current.signInWithLearningSso(); });
    await waitFor(() => expect(mocks.createSso).toHaveBeenCalledOnce());
    act(() => { view.result.current.cancelLearningSso(); });
    pending.resolve(request());
    await act(async () => { await work; });
    expect(mocks.openSso).not.toHaveBeenCalled();
    expect(view.result.current.ssoPending).toBe(false);
  });

  it('cancelar SSO tras reclamar el retorno impide completar identidad', async () => {
    const pending = deferred<Session>();
    mocks.exchangeSso.mockReturnValue(pending.promise);
    const view = await mount();
    await act(async () => { await view.result.current.signInWithLearningSso(); });
    act(() => { mocks.ssoEvent?.({ state: request().state, ticket: 't'.repeat(64), error: null }); });
    await waitFor(() => expect(mocks.exchangeSso).toHaveBeenCalledOnce());
    act(() => { view.result.current.cancelLearningSso(); });
    pending.resolve(session());
    await flush();
    expect(mocks.completeSso).not.toHaveBeenCalled();
    expect(view.result.current.user).toBeNull();
  });

  it('el finally de un retorno SSO anterior no termina la solicitud nueva', async () => {
    const pending = deferred<Session>();
    mocks.exchangeSso.mockReturnValue(pending.promise);
    mocks.createSso.mockResolvedValueOnce(request()).mockResolvedValueOnce(request('b'));
    const view = await mount();
    await act(async () => { await view.result.current.signInWithLearningSso(); });
    act(() => { mocks.ssoEvent?.({ state: request().state, ticket: 't'.repeat(64), error: null }); });
    await waitFor(() => expect(mocks.exchangeSso).toHaveBeenCalledOnce());
    let next!: Promise<void>;
    act(() => { next = view.result.current.signInWithLearningSso(); });
    pending.resolve(session());
    await act(async () => { await next; });
    expect(view.result.current.ssoPending).toBe(true);
    expect(view.result.current.user).toBeNull();
  });

  it('un SIGNED_OUT del logout físico anterior no cancela el login en espera', async () => {
    const view = await mount();
    await login(view);
    const network = deferred<void>();
    mocks.signOut.mockReturnValue(network.promise);
    let closing!: Promise<void>, next!: Promise<unknown>;
    act(() => { closing = view.result.current.signOut(); });
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    act(() => { next = view.result.current.signInWithSofia('b@example.invalid', 'clave-ficticia'); });
    act(() => { mocks.sdk = null; mocks.event?.('SIGNED_OUT', null); });
    network.resolve();
    await act(async () => { await Promise.all([closing, next]); });
    expect(view.result.current.user?.id).toBe('b');
    expect(view.result.current.dataUserId).toBe('b');
  });

  it('un cierre externo revoca el login activo y no acepta su resultado tardío', async () => {
    const pending = deferred<ReturnType<typeof reply>>();
    mocks.signIn.mockReturnValue(pending.promise);
    const view = await mount();
    let work!: Promise<unknown>;
    act(() => { work = view.result.current.signInWithSofia('a@example.invalid', 'clave-ficticia'); });
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    act(() => { mocks.event?.('SIGNED_OUT', null); });
    pending.resolve(reply());
    await act(async () => { await work; });
    act(() => { mocks.event?.('SIGNED_IN', session()); });
    await flush();
    expect(view.result.current.user).toBeNull();
    expect(view.result.current.sofiaContext).toBeNull();
  });

  it('rechaza un resultado de login incompatible con el último sujeto SDK observado', async () => {
    const pending = deferred<ReturnType<typeof reply>>();
    mocks.signIn.mockReturnValue(pending.promise);
    const view = await mount();
    let work!: Promise<unknown>;
    act(() => { work = view.result.current.signInWithSofia('a@example.invalid', 'clave-ficticia'); });
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    act(() => { mocks.event?.('SIGNED_IN', session('b')); });
    pending.resolve(reply());
    await act(async () => { await work; });
    expect(view.result.current.user).toBeNull();
    expect(mocks.liaRead).not.toHaveBeenCalled();
  });

  it('una publicación positiva pendiente no reemplaza la revocación', async () => {
    const view = await mount();
    const token = deferred<Session | null>();
    mocks.read.mockReturnValue(token.promise);
    await login(view);
    mocks.publish.mockClear();
    await act(async () => { await view.result.current.signOut(); });
    token.resolve(session());
    await flush();
    expect(mocks.publish).toHaveBeenCalled();
    expect(mocks.publish.mock.calls.every(([value]) => value.authenticated === false)).toBe(true);
  });

  it('un error tardío de publicación o retry se maneja sin exponer detalles', async () => {
    const view = await mount();
    await login(view);
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.read.mockRejectedValue(new Error('detalle-privado-ficticio'));
    await act(async () => { expect(await view.result.current.retryConversations()).toBe(false); });
    expect(log).toHaveBeenCalledExactlyOnceWith('[autenticacion] no se pudo reintentar conversaciones');
    expect(view.result.current.user?.id).toBe('a');
  });

  it('desmontar durante login impide publicar y comenzar recuperación', async () => {
    const pending = deferred<ReturnType<typeof reply>>();
    mocks.signIn.mockReturnValue(pending.promise);
    const view = await mount();
    let work!: Promise<unknown>;
    act(() => { work = view.result.current.signInWithSofia('a@example.invalid', 'clave-ficticia'); });
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    view.unmount(); mocks.publish.mockClear();
    pending.resolve(reply());
    await act(async () => { await work; });
    expect(mocks.liaRead).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('StrictMode restaura con la activación vigente y descarta la anterior', async () => {
    mocks.sdk = session();
    const view = renderHook(() => useAuthProviderModel(), { reactStrictMode: true });
    await waitFor(() => expect(view.result.current.dataUserId).toBe('a'));
    expect(view.result.current.user?.id).toBe('a');
    expect(mocks.liaRead).toHaveBeenCalledOnce();
  });

  it('desmontar SSO durante creación no abre navegador ni conserva retorno', async () => {
    const pending = deferred<ReturnType<typeof request>>();
    mocks.createSso.mockReturnValue(pending.promise);
    const view = await mount();
    let work!: Promise<void>;
    act(() => { work = view.result.current.signInWithLearningSso(); });
    await waitFor(() => expect(mocks.createSso).toHaveBeenCalledOnce());
    view.unmount(); pending.resolve(request());
    await act(async () => { await work; });
    expect(mocks.openSso).not.toHaveBeenCalled();
    expect(mocks.ssoEvent).toBeNull();
  });

  it('el renderer orbe nunca publica acceso o revocación', async () => {
    mocks.isOrb.mockReturnValue(true);
    const view = await mount();
    await login(view);
    await act(async () => { await view.result.current.signOut(); });
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
