import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ callbacks: new Set<(event: string) => void>(), user: vi.fn(), upsert: vi.fn(), remove: vi.fn(), single: vi.fn(), eq: vi.fn(), select: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getUser: mocks.user, onAuthStateChange: (callback: (event: string) => void) => { mocks.callbacks.add(callback); return { data: { subscription: { unsubscribe: () => { mocks.callbacks.delete(callback); } } } }; } }, from: () => ({ select: mocks.select, upsert: mocks.upsert, delete: mocks.remove }) } }));
import { saveUserApiKey, deleteUserApiKey } from '../../services/api-keys/mutations';
import { getUserApiKey } from '../../services/api-keys/queries';
import { invalidateApiKeyCache } from '../../services/api-keys/cache';
function changeSession() { for (const callback of mocks.callbacks) { callback('SIGNED_OUT'); callback('SIGNED_IN'); } }
beforeEach(() => { vi.resetAllMocks(); mocks.callbacks.clear(); mocks.user.mockResolvedValue({ data: { user: { id: 'usuario-a' } } }); mocks.upsert.mockResolvedValue({ error: null }); mocks.remove.mockReturnValue({ eq: mocks.eq }); mocks.select.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockReturnValue({ eq: mocks.eq, single: mocks.single, then: (resolve: (v: unknown) => void) => resolve({ error: null }) }); mocks.single.mockResolvedValue({ data: { api_key: 'clave-a' }, error: null }); });
afterEach(() => { expect(mocks.callbacks.size).toBe(0); vi.restoreAllMocks(); });
describe('Operaciones de claves sujetas a sesión', () => {
  it.each(['guardar', 'borrar', 'leer'])('%s no inicia operaciones tras cambiar sesión durante getUser', async mode => {
    let finish!: (v: unknown) => void; mocks.user.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = mode === 'guardar' ? saveUserApiKey({ provider: 'google', api_key: 'ficticia' }) : mode === 'borrar' ? deleteUserApiKey('google') : getUserApiKey('google');
    changeSession(); finish({ data: { user: { id: 'usuario-a' } } }); const result = await pending;
    if (mode === 'leer') expect(result).toBeNull(); else expect(result).toMatchObject({ success: false });
    expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.select).not.toHaveBeenCalled();
  });
  it('no publica datos de una consulta anterior', async () => {
    let finish!: (v: unknown) => void; mocks.single.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = getUserApiKey(); await vi.waitFor(() => expect(mocks.single).toHaveBeenCalled()); changeSession(); finish({ data: { api_key: 'clave-a' }, error: null }); expect(await pending).toBeNull();
  });
  it('no publica una consulta personal anterior a una modificación de clave', async () => {
    let finish!: (v: unknown) => void; mocks.single.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = getUserApiKey(); await vi.waitFor(() => expect(mocks.single).toHaveBeenCalled()); invalidateApiKeyCache();
    finish({ data: { api_key: 'clave-a' }, error: null }); expect(await pending).toBeNull();
  });
  it('no confirma eliminación que terminó tras cambio de sesión', async () => {
    let finish!: (v: { error: null }) => void;
    mocks.eq.mockReturnValueOnce({ eq: () => new Promise(resolve => { finish = resolve; }) });
    const pending = deleteUserApiKey(); await vi.waitFor(() => expect(finish).toBeTypeOf('function')); changeSession(); finish({ error: null });
    const result = await pending; expect(result.success).toBe(false); expect(result.error).toContain('no se confirmó');
  });
  it('libera la suscripción cuando falla la identificación', async () => {
    mocks.user.mockRejectedValueOnce(new Error('detalle-privado')); const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await saveUserApiKey({ provider: 'google', api_key: 'ficticia' })).toMatchObject({ success: false }); expect(JSON.stringify(log.mock.calls)).not.toContain('detalle-privado');
  });
  it('no confirma guardado que terminó tras cambio de sesión', async () => {
    let finish!: (v: unknown) => void; mocks.upsert.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = saveUserApiKey({ provider: 'google', api_key: 'ficticia' }); await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalled()); changeSession(); finish({ error: null }); expect(await pending).toMatchObject({ success: false });
  });
});
