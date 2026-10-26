import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createIrisProjectFetch, type IrisProjectScope } from '../iris/project-session-fetch';

const origin = 'https://iris-prueba.supabase.co';
function fixture() {
  let scope: IrisProjectScope = { userId: 'usuario-a', organizationId: 'organizacion-a', revision: 1 };
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json([]));
  const session = vi.fn(async () => ({ userId: 'usuario-a', accessToken: 'token-ficticio-no-real' }));
  const request = createIrisProjectFetch(origin, { scope: () => scope, session, publicKey: () => 'clave-publica-ficticia', fetch });
  return { request, fetch, session, change: (next: IrisProjectScope) => { scope = next; } };
}
describe('Identidad para la base directa de proyectos', () => {
  it('adjunta sesión vigente y organización sólo al destino IRIS, sin seguir redirecciones', async () => {
    const f = fixture();
    await f.request(`${origin}/rest/v1/pm_project_evidence`, { method: 'POST', headers: { apikey: 'iris-publica' } });
    const init = f.fetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('x-soflia-token')).toBe('token-ficticio-no-real');
    expect(headers.get('x-soflia-organization')).toBe('organizacion-a');
    expect(headers.get('x-soflia-key')).toBe('clave-publica-ficticia');
    expect(headers.get('apikey')).toBe('iris-publica');
    expect(init.redirect).toBe('error');
  });
  it.each(['https://otro.supabase.co/rest/v1/pm_projects', `${origin}/auth/v1/user`])('no envía credenciales a %s', async url => {
    const f = fixture();
    await expect(f.request(url)).rejects.toThrow('Destino');
    expect(f.session).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it('conserva la firma de descargas históricas del SDK sin adjuntar la sesión de Learning', async () => {
    const f = fixture();
    f.fetch.mockResolvedValueOnce(Response.json({ signedURL: '/object/sign/project-files/historico.pdf?token=ficticio' }));
    const client = createClient(origin, 'clave-publica-iris-ficticia', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: f.request, headers: { 'x-soflia-token': 'ajeno', 'x-soflia-key': 'ajena', 'x-soflia-organization': 'ajena' } } });
    const result = await client.storage.from('project-files').createSignedUrl('historial/archivo.pdf', 300);
    expect(result.error).toBeNull();
    expect(result.data?.signedUrl).toContain('/storage/v1/object/sign/project-files/historico.pdf');
    const [url, init] = f.fetch.mock.calls[0];
    expect(String(url)).toBe(`${origin}/storage/v1/object/sign/project-files/historial/archivo.pdf`);
    const headers = new Headers(init?.headers);
    expect(headers.get('apikey')).toBe('clave-publica-iris-ficticia');
    expect(headers.get('authorization')).toBe('Bearer clave-publica-iris-ficticia');
    expect([...headers.keys()]).not.toEqual(expect.arrayContaining(['x-soflia-token', 'x-soflia-key', 'x-soflia-organization']));
    expect(init?.redirect).toBe('error'); expect(f.session).not.toHaveBeenCalled();
  });
  it.each(['/storage/v1/object/sign/otro-bucket/archivo.pdf', '/storage/v1/object/project-files/archivo.pdf'])('mantiene bloqueada la ruta de almacenamiento %s', async route => {
    const f = fixture();
    await expect(f.request(`${origin}${route}`)).rejects.toThrow('Destino');
    expect(f.session).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it('descarta cabeceras proporcionadas por otro consumidor sin una sesión propia', async () => {
    const f = fixture(); f.change({ userId: null, organizationId: null, revision: 2 });
    await f.request(`${origin}/rest/v1/pm_projects`, { headers: { 'x-soflia-token': 'falso', 'x-soflia-key': 'falsa', 'x-soflia-organization': 'ajena' } });
    const init = f.fetch.mock.calls[0][1] as RequestInit;
    expect([...new Headers(init.headers).keys()]).not.toEqual(expect.arrayContaining(['x-soflia-token', 'x-soflia-key', 'x-soflia-organization']));
    expect(f.session).not.toHaveBeenCalled();
  });
  it('no hereda el token de otra identidad', async () => {
    const f = fixture(); f.session.mockResolvedValue({ userId: 'usuario-b', accessToken: 'otro-ficticio' });
    await expect(f.request(`${origin}/rest/v1/pm_projects`)).rejects.toThrow('no coincide');
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it('un cambio A/B/A invalida la petición antes de enviarla', async () => {
    const f = fixture();
    f.session.mockImplementation(async () => {
      f.change({ userId: 'usuario-a', organizationId: 'organizacion-a', revision: 3 });
      return { userId: 'usuario-a', accessToken: 'token-ficticio' };
    });
    await expect(f.request(`${origin}/rest/v1/pm_projects`)).rejects.toThrow('cambió');
    expect(f.fetch).not.toHaveBeenCalled();
  });
});
