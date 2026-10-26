import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { CalendarService } from '../calendar-service';
import { MicrosoftFilesAuth } from '../project-hub/microsoft-files-auth';

const doubles = vi.hoisted(() => ({ code: vi.fn(), url: vi.fn(), byCode: vi.fn(), silent: vi.fn(), account: vi.fn(), save: vi.fn(), load: vi.fn(), deserialize: vi.fn() }));
vi.mock('../calendar/oauth-window', () => ({ openOAuthWindow: doubles.code }));
vi.mock('@azure/msal-node', () => ({
  PublicClientApplication: class {
    getAuthCodeUrl = doubles.url;
    acquireTokenByCode = doubles.byCode;
    acquireTokenSilent = doubles.silent;
    getTokenCache() { return { serialize: () => 'cache-cifrada-por-store', deserialize: doubles.deserialize, getAccountByHomeId: doubles.account }; }
  },
  CryptoProvider: class { async generatePkceCodes() { return { challenge: 'desafio-qa', verifier: 'verificador-qa' }; } },
}));
const auth = { userId: 'actor', assertCurrent: vi.fn(), signal: new AbortController().signal };
const account = { username: 'persona@outlook.test', homeAccountId: 'cuenta-id' };
let calendar: CalendarService;
let files: MicrosoftFilesAuth;
beforeEach(() => {
  vi.clearAllMocks();
  doubles.code.mockResolvedValue('codigo-ficticio'); doubles.url.mockResolvedValue('https://login.microsoftonline.com/autorizar');
  doubles.byCode.mockResolvedValue({ account, scopes: ['Files.ReadWrite'], accessToken: 'ficticio' });
  doubles.silent.mockResolvedValue({ account, scopes: ['Files.ReadWrite'], accessToken: 'ficticio' }); doubles.account.mockResolvedValue(account);
  doubles.load.mockResolvedValue({ email: account.username, homeAccountId: account.homeAccountId, cache: 'cache-anterior' }); doubles.save.mockResolvedValue(undefined);
  calendar = { userId: 'actor', contextRevision: 1, config: { microsoft: { clientId: 'cliente-qa' } }, connections: new Map([['microsoft', { userId: 'actor', provider: 'microsoft', email: account.username, accessToken: 'calendario-ficticio', refreshToken: '', isActive: true }]]) } as unknown as CalendarService;
  files = new MicrosoftFilesAuth(calendar, { read: doubles.load, write: doubles.save });
});
describe('OneDrive con la cuenta Microsoft vinculada', () => {
  it('solicita permiso de archivos con PKCE, state y la cuenta vinculada, sin alterar calendario', async () => {
    const original = calendar.connections.get('microsoft');
    expect(await files.authorize(auth, {} as BrowserWindow)).toBe(true);
    expect(doubles.url).toHaveBeenCalledWith(expect.objectContaining({ scopes: ['Files.ReadWrite', 'User.Read'], loginHint: account.username, codeChallenge: 'desafio-qa', codeChallengeMethod: 'S256', state: expect.any(String) }));
    expect(doubles.code).toHaveBeenCalledWith(expect.any(String), 'OneDrive', expect.objectContaining({ signal: auth.signal, state: expect.any(String) }));
    expect(doubles.byCode).toHaveBeenCalledWith(expect.objectContaining({ codeVerifier: 'verificador-qa' }));
    expect(calendar.connections.get('microsoft')).toBe(original);
    expect(doubles.save).toHaveBeenCalledWith('actor', expect.any(String), expect.objectContaining({ email: account.username, cache: 'cache-cifrada-por-store' }), expect.any(Function));
  });
  it('rechaza otra cuenta y no guarda sus credenciales', async () => {
    doubles.byCode.mockResolvedValue({ account: { ...account, username: 'otra@outlook.test' }, scopes: ['Files.ReadWrite'] });
    await expect(files.authorize(auth, {} as BrowserWindow)).rejects.toThrow();
    expect(doubles.save).not.toHaveBeenCalled();
  });
  it('sin cuenta vinculada no abre autorización ni usa cachés previas', async () => {
    calendar.connections.clear();
    await expect(files.token(auth)).rejects.toThrow();
    expect(doubles.code).not.toHaveBeenCalled(); expect(doubles.load).not.toHaveBeenCalled();
  });
  it('renueva desde la caché privada y no devuelve esa caché al consumidor', async () => {
    const result = await files.token(auth);
    expect(result.token).toBe('ficticio');
    expect(result).not.toHaveProperty('cache');
    expect(doubles.silent).toHaveBeenCalledWith({ account, scopes: ['Files.ReadWrite', 'User.Read'] });
    expect(doubles.save).toHaveBeenCalledOnce();
  });
});
