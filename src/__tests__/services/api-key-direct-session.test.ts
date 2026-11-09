import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), callbacks: new Set<(event: string) => void>() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, auth: { onAuthStateChange: (callback: (event: string) => void) => { mocks.callbacks.add(callback); return { data: { subscription: { unsubscribe: () => { mocks.callbacks.delete(callback); } } } }; } } } }));
import { getApiKey } from '../../services/api-keys/queries';
import { invalidateApiKeyCache } from '../../services/api-keys/cache';
import * as records from '../../services/api-keys/records';
beforeEach(() => { mocks.rpc.mockReset(); mocks.callbacks.clear(); invalidateApiKeyCache(); });
afterEach(() => { expect(mocks.callbacks.size).toBe(0); });
describe('Lectura directa de clave', () => {
  it.each(['sesión', 'mutación'])('descarta la respuesta al cambiar %s', async reason => {
    let finish!: (value: { data: string; error: null }) => void; mocks.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = getApiKey('google'); if (reason === 'sesión') { for (const callback of mocks.callbacks) { callback('SIGNED_OUT'); callback('SIGNED_IN'); } } else invalidateApiKeyCache();
    finish({ data: 'clave-anterior', error: null }); await expect(pending).rejects.toThrow('La sesión o la configuración de claves cambió.');
  });
  it('la fachada histórica comparte la protección', () => { expect(records.getApiKey).toBe(getApiKey); });
});
