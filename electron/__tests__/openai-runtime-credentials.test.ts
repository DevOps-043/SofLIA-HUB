import { describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { nativeOpenAIAuthority } from '../openai-runtime/credentials';
import type { getHubDbClient } from '../hub-db-client';
function fixture() {
  const callerAbort = new AbortController(); let owner: string | null = 'lia-A', listener!: (event: AuthChangeEvent, session: Session | null) => void;
  const unsubscribe = vi.fn(), dispose = vi.fn();
  const rpcResult: { data: unknown; error: null | { message: string } } = { data: 'sk-credencial-personal-totalmente-ficticia', error: null };
  const rpc = vi.fn(() => ({ abortSignal: vi.fn(async () => rpcResult) }));
  const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'lia-A' } }, error: null })), onAuthStateChange: vi.fn((callback: typeof listener) => { listener = callback; return { data: { subscription: { unsubscribe } } }; }) }, rpc };
  const env = vi.fn(() => 'sk-credencial-entorno-totalmente-ficticia');
  const authority = nativeOpenAIAuthority({ userId: 'sofia-A', signal: callerAbort.signal, assert: () => { if (callerAbort.signal.aborted) throw new Error('revocada'); }, dispose }, { client: () => client as unknown as ReturnType<typeof getHubDbClient>, userId: () => owner, environmentKey: env });
  return { authority, callerAbort, rpcResult, client, rpc, env, unsubscribe, dispose, change: (next: string | null) => { owner = next; listener(next ? 'SIGNED_IN' : 'SIGNED_OUT', next ? { user: { id: next } } as Session : null); } };
}
describe('Credenciales OpenAI nativas por sesión y proveedor', () => {
  it('consulta sólo OpenAI y conserva sujetos Lia/SOFIA separados', async () => { const f = fixture(); expect(await f.authority.key()).toBe(f.rpcResult.data); expect(f.rpc).toHaveBeenCalledWith('get_api_key', { p_provider: 'openai' }); expect(f.env).not.toHaveBeenCalled(); f.authority.dispose(); });
  it('sin clave personal permite fallback nativo explícito', async () => { const f = fixture(); f.rpcResult.data = null; expect(await f.authority.key()).toBe(f.env()); f.authority.dispose(); });
  it('fallo de RPC no activa fallback de entorno', async () => { const f = fixture(); f.rpcResult.error = { message: 'detalle privado' }; await expect(f.authority.key()).rejects.toThrow('consultar'); expect(f.env).not.toHaveBeenCalled(); f.authority.dispose(); });
  it('A/B/A revoca aunque el ID vuelva a coincidir', async () => { const f = fixture(); f.change('lia-B'); f.change('lia-A'); expect(() => f.authority.assert()).toThrow(); await expect(f.authority.key()).rejects.toThrow(); expect(f.rpc).not.toHaveBeenCalled(); f.authority.dispose(); });
  it('revocación durante getUser no consulta la clave ni fallback', async () => { const f = fixture(); f.client.auth.getUser.mockImplementationOnce(async () => { f.change(null); return { data: { user: { id: 'lia-A' } }, error: null }; }); await expect(f.authority.key()).rejects.toThrow(); expect(f.rpc).not.toHaveBeenCalled(); expect(f.env).not.toHaveBeenCalled(); f.authority.dispose(); });
  it('cancelación del trabajo antes de consulta no inicia getUser', async () => { const f = fixture(), abort = new AbortController(); abort.abort(); await expect(f.authority.key(abort.signal)).rejects.toThrow(); expect(f.client.auth.getUser).not.toHaveBeenCalled(); f.authority.dispose(); });
  it('retira suscripción y caller una sola vez', () => { const f = fixture(); f.authority.dispose(); f.authority.dispose(); expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.dispose).toHaveBeenCalledOnce(); });
});
