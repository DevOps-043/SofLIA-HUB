import { describe, expect, it, vi } from 'vitest';
import { connectEcosystemSession } from '../integrated-browser/ecosystem-session';
import { ecosystemOrigin } from '../../src/shared/browser-ecosystem';
import { responseClearsEcosystemSession, responseIndicatesEcosystemSignOut } from '../integrated-browser/ecosystem-session-runtime';

const origin = 'https://soflia.ai';
function dependencies() {
  return {
    origins: [origin],
    getIdentity: vi.fn(async () => ({ userId: 'usuario', accessToken: 'credencial-sofia' })),
    assertCurrent: vi.fn(), hasConnected: vi.fn(() => false), remember: vi.fn(),
    fetcher: vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ success: true, userId: 'usuario' }))),
  };
}

describe('Sesión del ecosistema en el navegador', () => {
  it('solo el origen exacto recibe el bearer, sin contraseña ni refresh token', async () => {
    const deps = dependencies();
    await expect(connectEcosystemSession(`${origin}/curso`, deps)).resolves.toBe(true);
    const [url, request] = deps.fetcher.mock.calls[0];
    expect(url).toBe(`${origin}/api/auth/hub-session`);
    expect(request).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'include', body: '{"replace":false}', headers: { Authorization: 'Bearer credencial-sofia' } });
    expect(String(url)).not.toContain('credencial');
    expect(request?.body).not.toContain('credencial');
    expect(deps.remember).toHaveBeenCalledWith(origin);
  });
  it.each(['https://soflia.ai.evil.test/', 'https://evil.test@soflia.ai/', 'http://soflia.ai/', 'https://soflia.ai:444/', 'https://sub.soflia.ai/', 'file:///x'])('rechaza el destino %s', async target => {
    const deps = dependencies();
    expect(ecosystemOrigin(target, deps.origins)).toBeNull();
    await expect(connectEcosystemSession(target, deps)).resolves.toBe(false);
    expect(deps.getIdentity).not.toHaveBeenCalled(); expect(deps.fetcher).not.toHaveBeenCalled();
  });
  it('respeta un cierre de sesión y solo reconecta por acción explícita', async () => {
    const deps = dependencies(); deps.hasConnected.mockReturnValue(true);
    await expect(connectEcosystemSession(origin, deps)).resolves.toBe(false);
    expect(deps.fetcher).not.toHaveBeenCalled();
    await expect(connectEcosystemSession(origin, deps, true)).resolves.toBe(true);
    expect(deps.fetcher.mock.calls[0][1]?.body).toBe('{"replace":true}');
  });
  it('sin identidad vigente no inicia conexiones', async () => {
    const deps = { ...dependencies(), getIdentity: vi.fn(async () => null) };
    await expect(connectEcosystemSession(origin, deps)).resolves.toBe(false);
    expect(deps.fetcher).not.toHaveBeenCalled();
  });
  it('rechaza otra identidad y fallos del servidor sin recordar un éxito', async () => {
    for (const response of [new Response('{"success":true,"userId":"ajeno"}'), new Response('', { status: 401 }), new Response('x'.repeat(4097))]) {
      const deps = dependencies(); deps.fetcher.mockResolvedValue(response);
      await expect(connectEcosystemSession(origin, deps)).rejects.toThrow();
      expect(deps.remember).not.toHaveBeenCalled();
    }
  });
  it('conserva una cuenta distinta elegida en la web', async () => {
    const deps = dependencies(); deps.fetcher.mockResolvedValue(new Response('{"success":true,"userId":"otra-cuenta","preserved":true}'));
    await expect(connectEcosystemSession(origin, deps)).resolves.toBe(true);
  });
  it('un cambio de usuario durante la petición impide publicar el éxito', async () => {
    const deps = dependencies(); deps.getIdentity.mockResolvedValueOnce({ userId: 'usuario', accessToken: 'credencial-sofia' }).mockResolvedValue({ userId: 'otro', accessToken: 'otro-token' });
    await expect(connectEcosystemSession(origin, deps)).rejects.toThrow(/cuenta cambió/);
    expect(deps.remember).not.toHaveBeenCalled();
  });
  it('cancelar la navegación impide la conexión', async () => {
    const deps = dependencies(); deps.assertCurrent.mockImplementation(() => { throw new Error('cancelada'); });
    await expect(connectEcosystemSession(origin, deps)).rejects.toThrow('cancelada');
    expect(deps.fetcher).not.toHaveBeenCalled();
  });
  it('distingue cierre de sesión de rotación de cookies fragmentadas', () => {
    expect(responseClearsEcosystemSession({ 'Set-Cookie': ['cf_access_token=; Max-Age=0; Path=/'] })).toBe(true);
    expect(responseClearsEcosystemSession({ 'set-cookie': ['sb-ref-auth-token.0=; Max-Age=0', 'sb-ref-auth-token=nueva; Path=/'] })).toBe(false);
    expect(responseClearsEcosystemSession({ 'set-cookie': ['accessToken=vigente; Path=/'] })).toBe(false);
    expect(responseClearsEcosystemSession({ 'set-cookie': ['preferencia=; Max-Age=0'] })).toBe(false);
  });
  it('no confunde limpieza de cookies caducadas en GET o errores con logout elegido', () => {
    const headers = { 'Set-Cookie': ['sb-ref-auth-token=; Max-Age=0'] };
    expect(responseIndicatesEcosystemSignOut('GET', 200, headers)).toBe(false);
    expect(responseIndicatesEcosystemSignOut('POST', 401, headers)).toBe(false);
    expect(responseIndicatesEcosystemSignOut('POST', 204, headers)).toBe(true);
  });
  it.each([
    new Response('', { status: 404 }),
    new Response('{"error":"UNAUTHENTICATED"}', { status: 401 }),
    new Response('{"error":"No autorizado","code":"UNAUTHORIZED"}', { status: 401 }),
  ])('identifica una web todavía sin la integración publicada', async response => {
    const deps = dependencies(); deps.fetcher.mockResolvedValue(response);
    await expect(connectEcosystemSession(origin, deps)).rejects.toMatchObject({ code: 'endpoint-unavailable' });
    expect(deps.remember).not.toHaveBeenCalled();
  });
});
