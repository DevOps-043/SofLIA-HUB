import { isIP } from 'node:net';

export type BrowserNavigationSafetyAction = 'allow' | 'warn' | 'block';
export type BrowserNavigationSafetySource = 'local' | 'remote' | 'degraded';

export interface BrowserNavigationSafetyVerdict {
  action: BrowserNavigationSafetyAction;
  source: BrowserNavigationSafetySource;
  reason: string | null;
  checkedAt: string;
}

export interface BrowserSafeNavigationOptions {
  env?: Readonly<Record<string, string | undefined>>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  allowRemote?: boolean;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 1_000;
const MAX_BLOCKED_HOSTS = 2_000;
const MAX_RESPONSE_BYTES = 4_096;

export function canCheckBrowserNavigationRemotely(rawUrl: string, options: BrowserSafeNavigationOptions = {}): boolean {
  if (options.allowRemote === false || options.signal?.aborted) return false;
  try { return isPublicReputationTarget(new URL(rawUrl)) && safeProviderEndpoint((options.env ?? process.env).BROWSER_SAFE_BROWSING_ENDPOINT) !== null; }
  catch { return false; }
}

/**
 * Revisión local, determinista y sin red. No intenta adivinar si un sitio es
 * malicioso: sólo bloquea formas que nunca deberían llegar a Chromium y marca
 * señales de riesgo que requieren decisión del usuario o una lista externa.
 */
export function checkBrowserNavigationLocal(rawUrl: string, env: Readonly<Record<string, string | undefined>> = process.env): BrowserNavigationSafetyVerdict {
  const checkedAt = new Date().toISOString();
  let url: URL;
  try { url = new URL(rawUrl); } catch { return verdict('block', 'local', 'La dirección no se puede interpretar.', checkedAt); }
  if (url.protocol === 'about:') return url.href === 'about:blank'
    ? verdict('allow', 'local', null, checkedAt)
    : verdict('block', 'local', 'El protocolo interno no está permitido.', checkedAt);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return verdict('block', 'local', 'El protocolo no está permitido.', checkedAt);
  if (url.username || url.password) return verdict('block', 'local', 'La dirección contiene credenciales incrustadas.', checkedAt);

  const blockedHosts = parseBlockedHosts(env.BROWSER_SAFE_BROWSING_BLOCKED_HOSTS);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (blockedHosts.some((blocked) => hostname === blocked || (!isIP(blocked) && hostname.endsWith(`.${blocked}`)))) {
    return verdict('block', 'local', 'El dominio está en la lista local de navegación bloqueada.', checkedAt);
  }
  if (hostname.startsWith('xn--') || hostname.includes('.xn--')) {
    return verdict('warn', 'local', 'El dominio usa caracteres codificados; verifica que sea el sitio esperado.', checkedAt);
  }
  if (url.protocol === 'http:' && !isLoopbackHost(hostname)) {
    return verdict('warn', 'local', 'La conexión no está cifrada.', checkedAt);
  }
  return verdict('allow', 'local', null, checkedAt);
}

/**
 * Consulta un proveedor explícito sin enviar ruta, query, fragmento ni
 * credenciales. Un fallo remoto degrada a la decisión local y nunca bloquea
 * por una caída del proveedor.
 */
export async function checkBrowserNavigation(
  rawUrl: string,
  options: BrowserSafeNavigationOptions = {},
): Promise<BrowserNavigationSafetyVerdict> {
  const local = checkBrowserNavigationLocal(rawUrl, options.env);
  if (local.action === 'block') return local;
  const parsed = new URL(rawUrl);
  if (!canCheckBrowserNavigationRemotely(rawUrl, options)) return local;
  const endpoint = safeProviderEndpoint((options.env ?? process.env).BROWSER_SAFE_BROWSING_ENDPOINT);
  if (!endpoint) return local;
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const requestedTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutMs = Number.isFinite(requestedTimeout) ? Math.max(100, Math.min(requestedTimeout, 5_000)) : DEFAULT_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let cancel!: () => void;
  const canceled = new Promise<never>((_resolve, reject) => { cancel = () => { controller.abort(); reject(new Error('La revisión fue cancelada.')); }; });
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error('Se agotó el plazo de reputación.'));
    }, timeoutMs);
  });
  try {
    const query = async (): Promise<BrowserNavigationSafetyVerdict> => {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ protocol: parsed.protocol, hostname: parsed.hostname.toLowerCase(), port: parsed.port || null }),
        signal: controller.signal,
        redirect: 'error',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      });
      if (controller.signal.aborted || !response.ok || response.redirected || !response.body
        || Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
        void response.body?.cancel().catch(() => undefined);
        throw new Error('Respuesta de reputación no válida.');
      }
      reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        controller.signal.throwIfAborted();
        const { value, done } = await reader.read();
        controller.signal.throwIfAborted();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) throw new Error('Respuesta de reputación excesiva.');
        chunks.push(value);
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!body || typeof body !== 'object' || Array.isArray(body) || !('action' in body)) throw new Error('Formato de reputación no válido.');
      // El proveedor aporta clasificación, nunca texto confiable para UI/logs.
      if (body.action === 'block') return verdict('block', 'remote', 'El proveedor bloqueó la navegación.', new Date().toISOString());
      if (body.action === 'warn') return local.action === 'warn' ? local : verdict('warn', 'remote', 'El proveedor recomienda verificar el sitio.', new Date().toISOString());
      if (body.action === 'allow') return local.action === 'warn' ? local : verdict('allow', 'remote', null, new Date().toISOString());
      throw new Error('Clasificación de reputación no válida.');
    };
    return await Promise.race([query(), deadline, canceled]);
  } catch {
    return degraded(local, 'No se pudo consultar el proveedor de navegación; se aplicó la revisión local.');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
    controller.abort();
    void reader?.cancel().catch(() => undefined);
  }
}

function degraded(local: BrowserNavigationSafetyVerdict, reason: string): BrowserNavigationSafetyVerdict {
  return { ...local, source: 'degraded', reason: local.reason ?? reason };
}

function verdict(action: BrowserNavigationSafetyAction, source: BrowserNavigationSafetySource, reason: string | null, checkedAt: string): BrowserNavigationSafetyVerdict {
  return { action, source, reason, checkedAt };
}

function parseBlockedHosts(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',', MAX_BLOCKED_HOSTS).map((host) => host.trim().toLowerCase().replace(/^\.+|\.+$/g, '')).filter((host) => host && host.length <= 253 && !host.includes('/')))];
}

function safeProviderEndpoint(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!parsed.username && !parsed.password && parsed.search === '' && parsed.hash === '' && (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)))) return parsed.toString();
  } catch { /* configuración ausente o inválida: proveedor apagado */ }
  return null;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function isPublicReputationTarget(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.')) return false;
  return !['localhost', 'local', 'internal', 'intranet', 'lan', 'home', 'test', 'invalid'].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}
