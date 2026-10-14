import { describe, expect, it, vi } from 'vitest';
import { requestLearningLiveCatalog } from '../learning-live-catalog';

const userId = '00000000-0000-4000-8000-000000000013';
const catalog = { version: 1, user_id: userId, can_teach: false, total: 0, sessions: [] };
const input = { organization_slug: 'acme', page: 0, view: 'student' as const };
function dependencies() {
  return { baseUrl: 'https://learning.test', getIdentity: vi.fn(async (): Promise<{ userId: string; accessToken: string } | null> => ({ userId, accessToken: 'private-token' })), fetcher: vi.fn<typeof fetch>(async () => new Response(JSON.stringify(catalog))) };
}
describe('catálogo académico del escritorio', () => {
  it('consulta la ruta fija y devuelve únicamente el catálogo validado', async () => {
    const deps = dependencies();
    expect(await requestLearningLiveCatalog(input, deps)).toEqual({ success: true, catalog });
    expect(deps.fetcher).toHaveBeenCalledWith('https://learning.test/api/auth/live/catalog', expect.objectContaining({ redirect: 'error', cache: 'no-store', body: JSON.stringify(input) }));
  });
  it('rechaza identidad, URL, vista y páginas manipuladas antes de hacer red', async () => {
    const deps = dependencies();
    for (const extra of [{ user_id: userId }, { url: 'https://evil.test' }, { page: -1 }, { view: 'admin' }]) {
      expect((await requestLearningLiveCatalog({ ...input, ...extra }, deps)).success).toBe(false);
    }
    expect(deps.fetcher).not.toHaveBeenCalled();
  });
  it('impide consultas sin identidad y descarta resultados de otra cuenta', async () => {
    const deps = dependencies(); deps.getIdentity.mockResolvedValueOnce(null);
    expect(await requestLearningLiveCatalog(input, deps)).toMatchObject({ success: false, code: 'not_ready' });
    expect(deps.fetcher).not.toHaveBeenCalled();
    deps.getIdentity.mockResolvedValueOnce({ userId, accessToken: 'token' }).mockResolvedValueOnce(null);
    expect(await requestLearningLiveCatalog(input, deps)).toMatchObject({ success: false, code: 'not_ready' });
    deps.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...catalog, user_id: '00000000-0000-4000-8000-000000000014' })));
    expect((await requestLearningLiveCatalog(input, deps)).success).toBe(false);
  });
  it('rechaza salidas privadas e incompatibles y sanitiza errores', async () => {
    const deps = dependencies();
    deps.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...catalog, join_url: 'https://zoom.us/private' })));
    expect((await requestLearningLiveCatalog(input, deps)).success).toBe(false);
    deps.fetcher.mockRejectedValueOnce(new Error('private-token'));
    expect(JSON.stringify(await requestLearningLiveCatalog(input, deps))).not.toContain('private-token');
  });
  it.each([
    [401, 'not_ready', 'Learning no pudo validar tu sesión. Vuelve a iniciar sesión en Hub.'],
    [403, 'access_denied', 'No tienes acceso a las sesiones de esta organización.'],
    [404, 'unavailable', 'La agenda de Learning todavía no está habilitada para Soflia Hub.'],
    [405, 'unavailable', 'La agenda de Learning todavía no está habilitada para Soflia Hub.'],
    [429, 'unavailable', 'Espera un momento antes de actualizar.'],
    [503, 'unavailable', 'Learning no está disponible. Reintenta en un momento.'],
    [400, 'unavailable', 'Learning no pudo entregar tu agenda. Reintenta en un momento.'],
  ])('presenta el HTTP %i sin inventar una falta de permisos', async (status, code, error) => {
    const deps = dependencies();
    deps.fetcher.mockResolvedValueOnce(new Response('private-token', { status: Number(status) }));
    expect(await requestLearningLiveCatalog(input, deps)).toEqual({ success: false, code, error });
  });
  it('identifica el rechazo del filtro web antes del handler bearer', async () => {
    const deps = dependencies();
    deps.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'UNAUTHENTICATED', message: 'private-token' }), { status: 401 }));
    expect(await requestLearningLiveCatalog(input, deps)).toEqual({ success: false, code: 'unavailable', error: 'La agenda de Learning todavía no está habilitada para Soflia Hub.' });
  });
  it('acota errores remotos y conserva el diagnóstico de autenticación', async () => {
    const deps = dependencies();
    deps.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'UNAUTHENTICATED', extra: 'x'.repeat(5000) }), { status: 401 }));
    expect(await requestLearningLiveCatalog(input, deps)).toMatchObject({ success: false, code: 'not_ready' });
  });
  it('no atribuye un origen mal configurado a los permisos de la cuenta', async () => {
    const deps = dependencies();
    expect(await requestLearningLiveCatalog(input, { ...deps, baseUrl: '' })).toMatchObject({ success: false, code: 'unavailable' });
    expect(deps.fetcher).not.toHaveBeenCalled();
  });
});
