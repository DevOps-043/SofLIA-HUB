import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), callbacks: new Set<(event: string) => void>() }));
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: (_name: string, args: { p_provider: string }) => mocks.fetch(args.p_provider), auth: { onAuthStateChange: (callback: (event: string) => void) => {
    mocks.callbacks.add(callback);
    return { data: { subscription: { unsubscribe: () => { mocks.callbacks.delete(callback); } } } };
  } } },
}));
import { getApiKeyWithCache, invalidateApiKeyCache } from '../../services/api-keys/cache';
function auth(event: string) { for (const callback of mocks.callbacks) callback(event); }
beforeEach(() => { mocks.fetch.mockReset(); mocks.callbacks.clear(); invalidateApiKeyCache(); });
afterEach(() => { expect(mocks.callbacks.size).toBe(0); });
describe('Credenciales por solicitud y sesión', () => {
  it('no comparte claves entre proveedores ni conserva resultados entre consultas', async () => {
    mocks.fetch.mockResolvedValueOnce({ data: 'google-a', error: null }).mockResolvedValueOnce({ data: 'openai-a', error: null }).mockResolvedValueOnce({ data: 'google-b', error: null });
    expect(await getApiKeyWithCache('google')).toBe('google-a'); expect(await getApiKeyWithCache('openai')).toBe('openai-a'); expect(await getApiKeyWithCache('google')).toBe('google-b');
    expect(mocks.fetch.mock.calls.map(call => call[0])).toEqual(['google', 'openai', 'google']);
  });
  it('permite la publicación inicial de sesión sin rechazar una consulta válida', async () => {
    let finish!: (key: { data: string; error: null }) => void; mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = getApiKeyWithCache(); auth('INITIAL_SESSION'); finish({ data: 'clave-actual', error: null }); expect(await pending).toBe('clave-actual');
  });
  it('descarta una respuesta anterior al cierre de sesión', async () => {
    let finish!: (key: { data: string; error: null }) => void; mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = getApiKeyWithCache(); auth('SIGNED_OUT'); finish({ data: 'clave-anterior', error: null }); await expect(pending).rejects.toThrow('La sesión o la configuración de claves cambió.');
  });
  it('descarta respuesta anterior en una transición A/B/A', async () => {
    let finish!: (key: { data: string; error: null }) => void; mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = getApiKeyWithCache(); auth('SIGNED_IN'); auth('SIGNED_IN'); finish({ data: 'clave-anterior', error: null }); await expect(pending).rejects.toThrow('La sesión o la configuración de claves cambió.');
  });
  it('invalida consultas pendientes al guardar o borrar clave', async () => {
    let finish!: (key: { data: string; error: null }) => void; mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = getApiKeyWithCache(); invalidateApiKeyCache(); finish({ data: 'clave-anterior', error: null }); await expect(pending).rejects.toThrow('La sesión o la configuración de claves cambió.');
  });
  it('libera la suscripción ante fallo', async () => { mocks.fetch.mockRejectedValueOnce(new Error('fallo')); await expect(getApiKeyWithCache()).rejects.toThrow('No se pudo consultar la credencial.'); });
});
