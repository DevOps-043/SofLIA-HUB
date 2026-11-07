import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { validOAuthCode, validOAuthState } from './oauth-proof';

const callbackHtml = '<!doctype html><html lang="es"><meta charset="utf-8"><title>Autorización</title><body>Puedes volver a Soflia Hub y cerrar esta pestaña.</body></html>';

export function createOAuthReceiver({ state, assertCurrent, port, timeoutMs = 300000 }: {
  state: string; assertCurrent: () => void; port: number; timeoutMs?: number;
}) {
  if (!validOAuthState(state, state) || !Number.isInteger(port) || port < 0 || port > 65535
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) throw new Error('Configuración del receptor OAuth inválida.');
  assertCurrent();
  let resolveReady!: (listening: boolean) => void;
  let resolveResult!: (code: string | null) => void;
  const ready = new Promise<boolean>(resolve => { resolveReady = resolve; });
  const result = new Promise<string | null>(resolve => { resolveResult = resolve; });
  let stopping = false, closing = false, listening = false, claimed = false;
  let acceptedCode: string | null = null;
  let lifetime: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => { clearTimeout(lifetime); clearTimeout(bindTimer); };
  const close = () => {
    if (!listening || closing) return;
    closing = true;
    server.close(() => { listening = false; resolveResult(acceptedCode); });
    server.closeAllConnections();
  };
  const finish = (code: string | null) => {
    if (!stopping) {
      stopping = true; acceptedCode = code; clearTimers(); resolveReady(false); close();
    }
    return result;
  };
  const server = http.createServer({ maxHeaderSize: 8192, connectionsCheckingInterval: 1000 }, (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Connection', 'close');
    const deny = (status: number) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Solicitud de autorización rechazada.'); };
    if (stopping || claimed) { deny(410); return; }
    try { assertCurrent(); } catch { deny(403); void finish(null); return; }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); deny(405); return; }
    const currentPort = (server.address() as AddressInfo | null)?.port;
    if (!currentPort || ![`127.0.0.1:${currentPort}`, `localhost:${currentPort}`].includes(req.headers.host ?? '')) { deny(403); return; }
    const raw = req.url ?? '';
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.length > 16384 || /%(?![\da-f]{2})/i.test(raw)) { deny(400); return; }
    const origin = `http://127.0.0.1:${currentPort}`;
    let url: URL;
    try { url = new URL(raw, origin); } catch { deny(400); return; }
    if (url.origin !== origin || url.pathname !== '/callback') { deny(404); return; }
    if (url.searchParams.size > 32) { deny(400); return; }
    if (url.searchParams.getAll('state').length !== 1 || !validOAuthState(url.searchParams.get('state'), state)) { deny(403); return; }
    const codes = url.searchParams.getAll('code'), errors = url.searchParams.getAll('error');
    if ((errors.length && (errors.length !== 1 || codes.length)) || (!errors.length && (codes.length !== 1 || !validOAuthCode(codes[0])))) { deny(400); return; }
    const code = errors.length ? null : codes[0];
    claimed = true;
    // La respuesta se vacía antes de retirar las conexiones propias.
    res.once('finish', () => { void finish(code); });
    res.once('close', () => { void finish(null); });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(callbackHtml);
  });
  server.maxConnections = 4; server.maxHeadersCount = 32;
  server.headersTimeout = 5000; server.requestTimeout = 5000; server.keepAliveTimeout = 1000;
  server.maxRequestsPerSocket = 10;
  server.once('listening', () => {
    listening = true; clearTimeout(bindTimer);
    if (stopping) close(); else { resolveReady(true); lifetime = setTimeout(() => { void finish(null); }, timeoutMs); }
  });
  server.on('error', () => {
    clearTimers(); stopping = true; acceptedCode = null; resolveReady(false);
    if (listening) close(); else resolveResult(null);
  });
  const bindTimer = setTimeout(() => { void finish(null); }, 5000);
  server.listen(port, '127.0.0.1');
  return { ready, result, cancel: () => finish(null), isPending: () => !stopping && !claimed,
    address: () => server.address() as AddressInfo | null };
}
