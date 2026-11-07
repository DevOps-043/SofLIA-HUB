import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { REMOTE_NODE_IPC_MAX_BYTES, remoteNodeSnapshot } from '../../src/shared/remote-node-input';
import type { RemoteNodeServerContext, RemoteNodeState } from './types';

export function isAuthorized(req: IncomingMessage, state: RemoteNodeState): boolean {
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
  const fallback = req.headers['x-soflia-node-token'];
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : typeof fallback === 'string' ? fallback.trim() : '';
  if (!state.host.enabled || !token || token.length > 4096) return false;
  const actual = Buffer.from(token), expected = Buffer.from(state.host.token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function readJsonBody(req: IncomingMessage, context: RemoteNodeServerContext): Promise<unknown> {
  context.assertCurrent();
  const declared = req.headers['content-length'];
  if (declared !== undefined && (typeof declared !== 'string' || !/^\d+$/.test(declared) || Number(declared) > REMOTE_NODE_IPC_MAX_BYTES)) throw new Error('Cuerpo de nodo excesivo.');
  const chunks: Buffer[] = []; let total = 0;
  const cancel = () => req.destroy(new Error('Solicitud de nodo cancelada.'));
  const timer = setTimeout(cancel, 15_000);
  context.signal.addEventListener('abort', cancel, { once: true });
  try {
    if (context.signal.aborted) throw new Error('Solicitud de nodo cancelada.');
    for await (const chunk of req) {
      context.assertCurrent();
      if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string') throw new Error('Cuerpo de nodo no válido.');
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.length; if (total > REMOTE_NODE_IPC_MAX_BYTES) throw new Error('Cuerpo de nodo excesivo.');
      chunks.push(bytes);
    }
    context.assertCurrent(); const text = Buffer.concat(chunks, total).toString('utf8').trim();
    return remoteNodeSnapshot([text ? JSON.parse(text) as unknown : {}])[0];
  } finally { clearTimeout(timer); context.signal.removeEventListener('abort', cancel); }
}
export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload));
}
