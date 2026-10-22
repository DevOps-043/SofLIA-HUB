import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'electron';

const mock = vi.hoisted(() => ({
  user: 'uno', nativeUser: 'uno', kind: 'authenticated', files: new Map<string, string>(),
  listeners: new Set<() => void>(), getSession: vi.fn(),
}));
vi.mock('node:fs', () => ({ default: {
  existsSync: (file: string) => mock.files.has(file), readFileSync: (file: string) => mock.files.get(file),
  mkdirSync: vi.fn(), writeFileSync: (file: string, value: string) => mock.files.set(file, value),
  renameSync: (from: string, to: string) => { mock.files.set(to, mock.files.get(from)!); mock.files.delete(from); },
} }));
vi.mock('../sofia/clients', () => ({ getSofiaClient: () => ({ auth: { getSession: mock.getSession } }) }));
vi.mock('../main/auth-state', () => ({
  setAuthState: vi.fn(),
  getAuthState: () => ({ authenticated: !!mock.user, userId: mock.user }),
  onAuthStateChange: (listener: () => void) => { mock.listeners.add(listener); return () => mock.listeners.delete(listener); },
}));
vi.mock('../main/sofia-session', () => ({ getSofiaSessionUserId: () => mock.nativeUser }));
vi.mock('../learning-sso', () => ({ readLearningBaseUrl: () => null }));
vi.mock('../integrated-browser/profile-scope', () => ({
  browserScopeIdFor: (user: string) => `scope:${user}`,
  getBrowserScopeId: () => `scope:${mock.user}`, getBrowserProfileKind: () => mock.kind,
  browserProfilePath: (file: string) => `${mock.user}/${file}`,
}));

function partition() {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ success: true, userId: mock.user })));
  const cookies = vi.fn(async (): Promise<Array<{ name: string; value: string }>> => []);
  return { fetcher, cookies, session: { fetch: fetcher, cookies: { get: cookies } } as unknown as Session };
}
beforeEach(() => {
  vi.resetModules(); mock.files.clear(); mock.listeners.clear(); mock.user = 'uno'; mock.nativeUser = 'uno'; mock.kind = 'authenticated';
  mock.getSession.mockReset().mockImplementation(async () => ({ data: { session: { user: { id: mock.nativeUser }, access_token: 'token-ficticio' } }, error: null }));
});

describe('Persistencia y aislamiento del acceso del ecosistema', () => {
  it.each(['https://sofliahub.netlify.app', 'https://irisia.netlify.app'])('no entrega identidad al origen retirado %s, incluso con reconexión explícita', async target => {
    const runtime = await import('../integrated-browser/ecosystem-session-runtime');
    const { session, fetcher } = partition();
    expect(await runtime.prepareEcosystemSession(target, session, () => {}, true)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(mock.getSession).not.toHaveBeenCalled();
  });
  it('conecta una vez y conserva la elección después de reiniciar y expirar la cookie', async () => {
    let runtime = await import('../integrated-browser/ecosystem-session-runtime');
    const { session, fetcher } = partition();
    expect(await runtime.prepareEcosystemSession('https://soflia.ai/curso', session, () => {})).toBe(true);
    vi.resetModules(); runtime = await import('../integrated-browser/ecosystem-session-runtime');
    expect(await runtime.prepareEcosystemSession('https://soflia.ai/otro', session, () => {})).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
    expect([...mock.files.values()].join('')).not.toContain('token-ficticio');
  });
  it('conserva una sesión elegida previamente en la web aunque después desaparezca su cookie', async () => {
    const { prepareEcosystemSession } = await import('../integrated-browser/ecosystem-session-runtime');
    const { session, cookies, fetcher } = partition();
    cookies.mockResolvedValueOnce([{ name: 'accessToken', value: 'otra-cuenta' }]);
    fetcher.mockResolvedValueOnce(new Response('{"success":true,"userId":"otra-cuenta","preserved":true}'));
    expect(await prepareEcosystemSession('https://soflia.ai', session, () => {})).toBe(true);
    expect(await prepareEcosystemSession('https://soflia.ai', session, () => {})).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('una conexión antigua inferida de cookies se vuelve a validar antes de recordarla', async () => {
    mock.files.set('uno/ecosystem-session.json', '{"connected":["https://soflia.ai"],"signedOut":[]}');
    const { prepareEcosystemSession } = await import('../integrated-browser/ecosystem-session-runtime');
    const { session, fetcher } = partition();
    expect(await prepareEcosystemSession('https://soflia.ai', session, () => {})).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(mock.files.get('uno/ecosystem-session.json')!)).toMatchObject({ version: 2 });
  });
  it('cerrar sesión bloquea también el alias del sitio hasta la reconexión explícita', async () => {
    const runtime = await import('../integrated-browser/ecosystem-session-runtime');
    const { session, fetcher } = partition();
    runtime.rememberEcosystemSignOut('https://www.soflia.ai/api/auth/logout');
    expect(await runtime.prepareEcosystemSession('https://soflia.ai', session, () => {})).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await runtime.prepareEcosystemSession('https://soflia.ai', session, () => {}, true)).toBe(true);
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({ replace: true });
  });
  it.each(['guest', 'private'])('el perfil %s no recibe la identidad del escritorio', async kind => {
    mock.kind = kind;
    const { prepareEcosystemSession } = await import('../integrated-browser/ecosystem-session-runtime');
    const { session, fetcher } = partition();
    expect(await prepareEcosystemSession('https://soflia.ai', session, () => {}, true)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled(); expect(mock.getSession).not.toHaveBeenCalled();
  });
  it('rechaza una identidad SOFIA distinta de la cuenta autenticada', async () => {
    mock.nativeUser = 'dos';
    const { prepareEcosystemSession } = await import('../integrated-browser/ecosystem-session-runtime');
    const { session, fetcher } = partition();
    expect(await prepareEcosystemSession('https://soflia.ai', session, () => {})).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('dos pestañas simultáneas comparten un solo canje', async () => {
    const { prepareEcosystemSession } = await import('../integrated-browser/ecosystem-session-runtime');
    const { session, fetcher } = partition();
    await Promise.all([prepareEcosystemSession('https://soflia.ai/uno', session, () => {}), prepareEcosystemSession('https://soflia.ai/dos', session, () => {})]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('un cambio de cuenta durante la petición cancela la conexión y no guarda éxito', async () => {
    const { prepareEcosystemSession } = await import('../integrated-browser/ecosystem-session-runtime');
    const { session, fetcher } = partition();
    fetcher.mockImplementationOnce(async () => {
      mock.user = 'dos'; for (const listener of mock.listeners) listener();
      return new Response('{"success":true,"userId":"uno"}');
    });
    await expect(prepareEcosystemSession('https://soflia.ai', session, () => {})).rejects.toThrow();
    expect(mock.files.size).toBe(0);
  });
});
