import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, session } from '../contexts/auth-lifecycle.fixture';

const mocks = vi.hoisted(() => ({ resolveEmail: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
  profile: vi.fn(), save: vi.fn(), build: vi.fn(), user: vi.fn() }));
vi.mock('../../lib/sofia-client', () => ({ isSofiaConfigured: () => true,
  sofiaSupa: { auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut } } }));
vi.mock('../../services/sofia-auth/login', () => ({ resolveLoginEmail: mocks.resolveEmail,
  INVALID_CREDENTIALS_MESSAGE: 'Credenciales invalidas', mapSupabaseAuthError: () => 'Credenciales invalidas' }));
vi.mock('../../services/sofia-auth/context', () => ({ buildActiveSofiaContext: mocks.build, createPseudoAuthUser: mocks.user }));
vi.mock('../../services/sofia-auth/profile', () => ({ fetchSofiaUserProfile: mocks.profile }));
vi.mock('../../services/sofia-auth/session-storage', () => ({ saveSofiaSession: mocks.save }));
import { sofiaAuth } from '../../services/sofia-auth';

const profile = { id: 'perfil-a', email: 'a@example.invalid' };
beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.resolveEmail.mockResolvedValue('a@example.invalid');
  mocks.signIn.mockResolvedValue({ data: { user: session().user, session: session() }, error: null });
  mocks.profile.mockResolvedValue(profile); mocks.save.mockResolvedValue(undefined);
  mocks.build.mockReturnValue({ user: profile }); mocks.user.mockReturnValue({ id: profile.id, email: profile.email });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

describe('Cancelación de etapas del servicio SOFIA real', () => {
  it('no inicia traducción ni SDK con una señal cancelada', async () => {
    const controller = new AbortController(); controller.abort();
    expect((await sofiaAuth.signInWithSofia('a', 'clave-ficticia', controller.signal)).success).toBe(false);
    expect(mocks.resolveEmail).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('cancelar tras traducción impide iniciar autenticación SDK', async () => {
    const pending = deferred<string>(); mocks.resolveEmail.mockReturnValue(pending.promise);
    const controller = new AbortController();
    const work = sofiaAuth.signInWithSofia('a', 'clave-ficticia', controller.signal);
    controller.abort(); pending.resolve('a@example.invalid');
    expect((await work).success).toBe(false);
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('cancelar tras SDK impide resolver y persistir perfil', async () => {
    const pending = deferred<{ data: { user: SessionUser; session: ReturnType<typeof session> }; error: null }>();
    mocks.signIn.mockReturnValue(pending.promise);
    const controller = new AbortController();
    const work = sofiaAuth.signInWithSofia('a', 'clave-ficticia', controller.signal);
    await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    controller.abort(); pending.resolve({ data: { user: session().user, session: session() }, error: null });
    expect((await work).success).toBe(false);
    expect(mocks.profile).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(['login', 'sso'] as const)('cancelar perfil %s no guarda snapshot ni cierra otra sesión', async kind => {
    const pending = deferred<typeof profile | null>(); mocks.profile.mockReturnValue(pending.promise);
    const controller = new AbortController();
    const work = kind === 'login' ? sofiaAuth.signInWithSofia('a', 'clave-ficticia', controller.signal)
      : sofiaAuth.completeSofiaSsoSession(session(), controller.signal);
    await vi.waitFor(() => expect(mocks.profile).toHaveBeenCalledOnce());
    controller.abort(); pending.resolve(null);
    expect((await work).success).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('el éxito vigente conserva identidad de perfil y sesión Auth sin equipararlas', async () => {
    const result = await sofiaAuth.signInWithSofia('a', 'clave-ficticia', new AbortController().signal);
    expect(result.success).toBe(true); expect(result.user?.id).toBe('perfil-a');
    expect(result.session?.user.id).toBe('a'); expect(mocks.save).toHaveBeenCalledOnce();
  });

  it('retira el snapshot local sin mutar el SDK', () => {
    localStorage.setItem('sofia-session', JSON.stringify({ user: { id: 'perfil-ficticio' } }));
    sofiaAuth.clearLocalProfile();
    expect(localStorage.getItem('sofia-session')).toBeNull();
    expect(sofiaAuth.getSofiaContext()).toBeNull();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('un almacenamiento local fallido no impide intentar el cierre SDK', async () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => { throw new Error('detalle-privado-ficticio'); });
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await sofiaAuth.signOut();
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledExactlyOnceWith('[SOFIA] no se pudo retirar el snapshot local del perfil');
  });
});

type SessionUser = ReturnType<typeof session>['user'];
