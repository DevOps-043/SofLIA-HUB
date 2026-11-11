import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CalendarService } from '../calendar-service';
import { openOAuthWindow } from '../calendar/oauth-window';
import { CalendarStorageUnavailableError, type CalendarCredentialStore } from '../calendar/credential-store';

const sdk = vi.hoisted(() => ({ authUrl: vi.fn(), token: vi.fn(), publicClient: vi.fn(), confidential: vi.fn() }));
vi.mock('@azure/msal-node', () => ({
  PublicClientApplication: sdk.publicClient,
  ConfidentialClientApplication: sdk.confidential,
  ResponseMode: { QUERY: 'query' },
}));
vi.mock('../calendar/oauth-window', () => ({ openOAuthWindow: vi.fn() }));
let service: CalendarService;
let credentials: { [Method in 'load' | 'save']: Mock<CalendarCredentialStore[Method]> };
beforeEach(() => {
  vi.clearAllMocks(); sdk.authUrl.mockResolvedValue('https://fixture.invalid/authorization');
  sdk.token.mockResolvedValue({ accessToken: 'token-ficticio', account: { username: 'cuenta@example.test' }, expiresOn: new Date(Date.now() + 3600000) });
  sdk.publicClient.mockImplementation(function () { return { getAuthCodeUrl: sdk.authUrl, acquireTokenByCode: sdk.token }; });
  vi.mocked(openOAuthWindow).mockResolvedValue('codigo-ficticio');
  credentials = { load: vi.fn<CalendarCredentialStore['load']>().mockResolvedValue([]),
    save: vi.fn<CalendarCredentialStore['save']>().mockResolvedValue(undefined) };
  service = new CalendarService(credentials); service.setUserId('A'); service.setConfig({ microsoft: { clientId: 'cliente-ficticio' } });
});
afterEach(() => { service.dispose(); vi.restoreAllMocks(); });

describe('Intercambio Microsoft público vinculado al intento', () => {
  it('usa cliente público sin secreto, PKCE/nonce y custodia del dueño', async () => {
    const connected = vi.fn(); service.on('connected', connected);
    expect(await service.connectMicrosoft()).toEqual({ success: true, email: 'cuenta@example.test' });
    expect(sdk.confidential).not.toHaveBeenCalled();
    expect(sdk.publicClient.mock.calls[0][0].auth).toEqual({ clientId: 'cliente-ficticio', authority: 'https://login.microsoftonline.com/common' });
    const request = sdk.authUrl.mock.calls[0][0]; const options = vi.mocked(openOAuthWindow).mock.calls[0][2];
    expect(request).toMatchObject({ responseMode: 'query', state: options.proof.state, codeChallenge: options.proof.challenge, codeChallengeMethod: 'S256', scopes: ['Calendars.Read', 'User.Read'] });
    expect(request.nonce).toMatch(/^[\w-]{43}$/);
    expect(sdk.token).toHaveBeenCalledWith({ code: 'codigo-ficticio', redirectUri: 'http://localhost:8234/callback',
      scopes: ['Calendars.Read', 'User.Read'], state: options.proof.state, nonce: request.nonce, codeVerifier: options.proof.verifier });
    expect(credentials.save).toHaveBeenCalledWith('A', [expect.objectContaining({ provider: 'microsoft', userId: 'A', accessToken: 'token-ficticio' })], expect.any(Function));
    expect(connected).toHaveBeenCalledWith({ provider: 'microsoft', email: 'cuenta@example.test' });
  });
  it('genera pruebas nuevas en cada intento y no canjea si se cancela', async () => {
    vi.mocked(openOAuthWindow).mockResolvedValue(null);
    expect((await service.connectMicrosoft()).success).toBe(false); expect((await service.connectMicrosoft()).success).toBe(false);
    const first = sdk.authUrl.mock.calls[0][0], second = sdk.authUrl.mock.calls[1][0];
    expect(first.state).not.toBe(second.state); expect(first.nonce).not.toBe(second.nonce);
    expect(sdk.token).not.toHaveBeenCalled(); expect(credentials.save).not.toHaveBeenCalled();
  });
  it.each(['ventana', 'canje', 'configuración'])('descarta resultados si cambia el contexto durante %s', async stage => {
    if (stage === 'ventana') vi.mocked(openOAuthWindow).mockImplementationOnce(async () => { service.setUserId('B'); service.setUserId('A'); return 'codigo-ficticio'; });
    if (stage === 'canje') sdk.token.mockImplementationOnce(async () => { service.setUserId('B'); service.setUserId('A'); return { accessToken: 'token-obsoleto' }; });
    if (stage === 'configuración') vi.mocked(openOAuthWindow).mockImplementationOnce(async () => { service.setConfig({ microsoft: { clientId: 'otro' } }); return 'codigo-ficticio'; });
    const connected = vi.fn(); service.on('connected', connected);
    expect((await service.connectMicrosoft()).success).toBe(false);
    if (stage !== 'canje') expect(sdk.token).not.toHaveBeenCalled();
    expect(credentials.save).not.toHaveBeenCalled(); expect(connected).not.toHaveBeenCalled(); expect(service.getConnections()).toEqual([]);
  });
  it('un código URL no llega al SDK aunque el receptor sea sustituido', async () => {
    vi.mocked(openOAuthWindow).mockResolvedValue('https://ajeno.invalid/codigo');
    expect((await service.connectMicrosoft()).success).toBe(false); expect(sdk.token).not.toHaveBeenCalled();
  });
  it('no publica token vacío o errores sensibles del proveedor', async () => {
    sdk.token.mockResolvedValueOnce({ accessToken: '' });
    expect((await service.connectMicrosoft()).success).toBe(false);
    sdk.token.mockRejectedValueOnce(new Error('token-privado-ficticio'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await service.connectMicrosoft();
    expect(result.success).toBe(false); expect(JSON.stringify(result)).not.toContain('token-privado-ficticio');
    expect(JSON.stringify(log.mock.calls)).not.toContain('token-privado-ficticio'); expect(credentials.save).not.toHaveBeenCalled();
  });
  it('error de custodia no emite conexión ni publica credencial en memoria', async () => {
    credentials.save.mockRejectedValue(new CalendarStorageUnavailableError());
    const connected = vi.fn(); service.on('connected', connected);
    expect(await service.connectMicrosoft()).toMatchObject({ success: false, errorCode: 'secure_storage_unavailable' });
    expect(connected).not.toHaveBeenCalled(); expect(service.getConnections()).toEqual([]);
  });
});
