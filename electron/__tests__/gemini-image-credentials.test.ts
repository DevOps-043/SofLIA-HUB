import { describe, expect, it, vi } from 'vitest';
import type { getHubDbClient } from '../hub-db-client';
import { nativeGeminiAuthority } from '../openai-runtime/credentials';
describe('Credencial Google nativa', () => {
  it('consulta el proveedor Google en la sesión Lia vinculada', async () => {
    const controller = new AbortController(); const rpc = vi.fn(() => ({ abortSignal: vi.fn(async () => ({ data: 'clave-google-ficticia-de-prueba', error: null })) }));
    const unsubscribe = vi.fn(); const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'lia-a' } }, error: null })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })) }, rpc };
    const authority = nativeGeminiAuthority({ userId: 'sofia-a', signal: controller.signal, assert: vi.fn(), dispose: vi.fn() }, { client: () => client as unknown as ReturnType<typeof getHubDbClient>, userId: () => 'lia-a', environmentKey: () => undefined });
    expect(await authority.key()).toBe('clave-google-ficticia-de-prueba'); expect(rpc).toHaveBeenCalledWith('get_api_key', { p_provider: 'google' }); authority.dispose(); expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it('un fallo RPC no usa la clave de entorno', async () => {
    const controller = new AbortController(); const env = vi.fn(() => 'clave-google-de-entorno-ficticia');
    const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'lia-a' } }, error: null })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) }, rpc: vi.fn(() => ({ abortSignal: vi.fn(async () => ({ data: null, error: { message: 'detalle-privado' } })) })) };
    const authority = nativeGeminiAuthority({ userId: 'sofia-a', signal: controller.signal, assert: vi.fn(), dispose: vi.fn() }, { client: () => client as unknown as ReturnType<typeof getHubDbClient>, userId: () => 'lia-a', environmentKey: env });
    await expect(authority.key()).rejects.toThrow(); expect(env).not.toHaveBeenCalled(); authority.dispose();
  });
});
