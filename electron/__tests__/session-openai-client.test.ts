import { afterEach, expect, it, vi } from 'vitest';
import { getSessionOpenAIClient } from '../ai-provider/session-client';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), options: vi.fn(), actor: { authenticated: true, userId: 'sofia' }, hub: 'lia' as string | null, listeners: new Set<() => void>() }));
vi.mock('../main/auth-state', () => ({ setAuthState: vi.fn(), getAuthState: () => mocks.actor, onAuthStateChange: (listener: () => void) => { mocks.listeners.add(listener); return () => mocks.listeners.delete(listener); } }));
vi.mock('../main/hub-session', () => ({ getHubSessionUserId: () => mocks.hub }));
vi.mock('../hub-db-client', () => ({ getHubDbClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('openai', () => ({ default: class { constructor(options: unknown) { mocks.options(options); } } }));
afterEach(() => { mocks.actor = { authenticated: true, userId: 'sofia' }; mocks.hub = 'lia'; vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('obtiene OpenAI mediante el RPC de Hub con timeout y no usa Gemini', async () => {
  const abortSignal = vi.fn().mockResolvedValue({ data: 'clave-de-prueba', error: null }); mocks.rpc.mockReturnValue({ abortSignal });
  await getSessionOpenAIClient();
  expect(mocks.rpc).toHaveBeenCalledWith('get_api_key', { p_provider: 'openai' });
  expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'clave-de-prueba', maxRetries: 0,
    baseURL: 'https://api.openai.com/v1', organization: null, project: null, logLevel: 'off' }));
});
it('un RPC malformado no activa la clave del entorno', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'entorno-ficticio');
  mocks.rpc.mockReturnValue({ abortSignal: async () => ({ data: { key: 'forma-no-admitida' }, error: null }) });
  await expect(getSessionOpenAIClient()).rejects.toThrow('configuración OpenAI');
  expect(mocks.options).not.toHaveBeenCalled();
});
it('rechaza falta de sesión, clave ausente y cambio de sesión durante la consulta', async () => {
  mocks.hub = null; await expect(getSessionOpenAIClient()).rejects.toThrow('Sesión'); expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.hub = 'lia'; vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('VITE_OPENAI_API_KEY', '');
  mocks.rpc.mockReturnValue({ abortSignal: async () => ({ data: null, error: null }) });
  await expect(getSessionOpenAIClient()).rejects.toThrow('API key de OpenAI');
  mocks.rpc.mockReturnValue({ abortSignal: async () => { mocks.listeners.forEach(listener => listener()); return { data: 'vieja', error: null }; } });
  await expect(getSessionOpenAIClient()).rejects.toThrow('sesión cambió');
  expect(mocks.options).not.toHaveBeenCalled();
});
it('un cliente previo deja de servir después de logout/login', async () => {
  mocks.rpc.mockReturnValue({ abortSignal: async () => ({ data: 'clave-de-prueba', error: null }) });
  await getSessionOpenAIClient(); const options = mocks.options.mock.calls[0][0];
  mocks.listeners.forEach(listener => listener());
  await expect(options.fetch('https://api.openai.com/v1/responses', {})).rejects.toThrow('sesión');
});
it('descarta el body que llega después de cambiar la sesión', async () => {
  mocks.rpc.mockReturnValue({ abortSignal: async () => ({ data: 'clave-de-prueba', error: null }) });
  await getSessionOpenAIClient(); const options = mocks.options.mock.calls[0][0];
  let finish!: (data: ArrayBuffer) => void;
  const body = new Promise<ArrayBuffer>(resolve => { finish = resolve; });
  const arrayBuffer = vi.fn(() => body);
  vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer, status: 200, headers: new Headers() })));
  const request = options.fetch('https://api.openai.com/v1/responses', {});
  await Promise.resolve(); expect(arrayBuffer).toHaveBeenCalled();
  mocks.listeners.forEach(listener => listener()); finish(new ArrayBuffer(0));
  await expect(request).rejects.toThrow('sesión');
});
