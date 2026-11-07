import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ pending: vi.fn(), upsert: vi.fn(), remove: vi.fn(), eq: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: mocks.pending, auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }), getUser: async () => ({ data: { user: { id: 'usuario' } } }) }, from: () => ({ upsert: mocks.upsert, delete: mocks.remove }) } }));
import { getApiKeyWithCache } from '../../services/api-keys/cache';
import { deleteUserApiKey, saveUserApiKey } from '../../services/api-keys/mutations';
beforeEach(() => { vi.clearAllMocks(); mocks.upsert.mockResolvedValue({ error: null }); mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValue({ error: null }); mocks.remove.mockReturnValue({ eq: mocks.eq }); });
describe('Mutación de credenciales revoca lecturas', () => {
  it.each(['guardar', 'borrar'])('%s invalida una consulta anterior', async operation => {
    let finish!: (value: { data: string; error: null }) => void; mocks.pending.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const read = getApiKeyWithCache('google');
    const result = operation === 'guardar' ? await saveUserApiKey({ provider: 'google', api_key: 'nueva-ficticia' }) : await deleteUserApiKey('google');
    expect(result.success).toBe(true); finish({ data: 'anterior-ficticia', error: null }); await expect(read).rejects.toThrow('La sesión o la configuración de claves cambió.');
  });
});
