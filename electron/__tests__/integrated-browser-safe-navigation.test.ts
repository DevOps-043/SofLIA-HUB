import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBrowserNavigation, checkBrowserNavigationLocal } from '../integrated-browser/safe-navigation';

const env = { BROWSER_SAFE_BROWSING_ENDPOINT: 'https://safe.example/check' };
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('navegación segura del navegador integrado', () => {
  it('la cancelación externa termina la consulta aun si fetch no coopera', async () => {
    const controller = new AbortController(); let remoteSignal: AbortSignal | null | undefined;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => { remoteSignal = init?.signal; return new Promise(() => undefined); });
    const pending = checkBrowserNavigation('https://example.com/', { env, fetcher, signal: controller.signal });
    controller.abort(); expect(await pending).toMatchObject({ source: 'degraded' }); expect(remoteSignal?.aborted).toBe(true);
    fetcher.mockClear(); await checkBrowserNavigation('https://example.com/', { env, fetcher, signal: controller.signal }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('bloquea credenciales incrustadas y hosts de la lista local', () => {
    expect(checkBrowserNavigationLocal('https://usuario:secreto@example.com')).toMatchObject({ action: 'block', source: 'local' });
    expect(checkBrowserNavigationLocal('https://login.example.test/ruta', { BROWSER_SAFE_BROWSING_BLOCKED_HOSTS: 'example.test' })).toMatchObject({ action: 'block', source: 'local' });
  });

  it('marca HTTP y dominios codificados sin bloquear la navegación por sí sola', () => {
    expect(checkBrowserNavigationLocal('http://example.com')).toMatchObject({ action: 'warn', source: 'local' });
    expect(checkBrowserNavigationLocal('https://xn--ejemplo-9za.test')).toMatchObject({ action: 'warn', source: 'local' });
    expect(checkBrowserNavigationLocal('https://example.com')).toMatchObject({ action: 'allow', source: 'local' });
  });

  it('consulta un proveedor explícito sin enviar ruta ni query y conserva bloqueo remoto', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://safe.example/check');
      expect(JSON.parse(String(init?.body))).toEqual({ protocol: 'https:', hostname: 'example.com', port: null });
      expect(init).toMatchObject({ redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
      return new Response(JSON.stringify({ action: 'block', reason: 'secreto\nhttps://ruta-interna' }), { status: 200 });
    });
    await expect(checkBrowserNavigation('https://example.com/login?token=secreto', {
      env: { BROWSER_SAFE_BROWSING_ENDPOINT: 'https://safe.example/check' }, fetcher,
    })).resolves.toMatchObject({ action: 'block', source: 'remote', reason: 'El proveedor bloqueó la navegación.' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('degrada a la revisión local si el proveedor falla', async () => {
    const fetcher = vi.fn(async () => { throw new Error('offline'); });
    await expect(checkBrowserNavigation('https://example.com', {
      env: { BROWSER_SAFE_BROWSING_ENDPOINT: 'https://safe.example/check' }, fetcher,
    })).resolves.toMatchObject({ action: 'allow', source: 'degraded' });
  });

  it.each(['http://example.com', 'https://xn--ejemplo-9za.com'])('un permiso remoto no rebaja la advertencia local: %s', async (url) => {
    const fetcher = vi.fn(async () => new Response('{"action":"allow"}'));
    await expect(checkBrowserNavigation(url, { env, fetcher })).resolves.toMatchObject({ action: 'warn', source: 'local' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(['about:blank', 'http://localhost', 'https://servidor', 'http://127.0.0.2', 'https://192.168.0.2', 'https://[::1]', 'https://[::ffff:192.168.0.2]', 'https://impresora.local', 'https://servicio.test'])('no divulga destinos locales/internos: %s', async (url) => {
    const fetcher = vi.fn();
    await expect(checkBrowserNavigation(url, { env, fetcher })).resolves.toMatchObject({ source: 'local' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('respeta la desactivación remota y un entorno inyectado vacío', async () => {
    const fetcher = vi.fn();
    vi.stubEnv('BROWSER_SAFE_BROWSING_ENDPOINT', env.BROWSER_SAFE_BROWSING_ENDPOINT);
    await checkBrowserNavigation('https://example.com', { env, fetcher, allowRemote: false });
    await checkBrowserNavigation('https://example.com', { env: {}, fetcher });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['https://user:secret@safe.example/check', 'https://safe.example/check?token=a', 'http://safe.example/check'])('rechaza proveedores con configuración insegura: %s', async (endpoint) => {
    const fetcher = vi.fn();
    await checkBrowserNavigation('https://example.com', { env: { BROWSER_SAFE_BROWSING_ENDPOINT: endpoint }, fetcher });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['null', '[]', '{}', '{"action":"unknown"}', 'x'.repeat(4_097)])('degrada respuestas inválidas o excesivas: %#', async (body) => {
    await expect(checkBrowserNavigation('https://example.com', { env, fetcher: async () => new Response(body) })).resolves.toMatchObject({ source: 'degraded' });
  });

  it.each(['fetch', 'body'] as const)('el plazo total vence aunque se atasque %s y no coopere con abort', async (phase) => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const cancel = vi.fn();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      signal = init?.signal;
      if (phase === 'fetch') return new Promise(() => undefined);
      return Promise.resolve(new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{')); }, cancel })));
    });
    const result = checkBrowserNavigation('https://example.com', { env, fetcher, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(101);
    await expect(result).resolves.toMatchObject({ source: 'degraded' });
    expect(signal?.aborted).toBe(true);
    if (phase === 'body') expect(cancel).toHaveBeenCalledOnce();
  });

  it('bloquea IPs explícitas y no confunde sufijos parecidos', () => {
    expect(checkBrowserNavigationLocal('https://10.1.2.3', { BROWSER_SAFE_BROWSING_BLOCKED_HOSTS: '10.1.2.3' }).action).toBe('block');
    expect(checkBrowserNavigationLocal('https://notexample.com', { BROWSER_SAFE_BROWSING_BLOCKED_HOSTS: 'example.com' }).action).toBe('allow');
  });
});
