import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RemoteNodeState } from './types';

export function isAuthorized(req: IncomingMessage, state: RemoteNodeState): boolean {
  const authHeader = String(req.headers.authorization || '').trim();
  const tokenHeader = String(req.headers['x-soflia-node-token'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : tokenHeader;
  return !!token && token === state.host.token;
}

export async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf-8').trim();
  return text ? JSON.parse(text) : {};
}

export function sendJson(res: ServerResponse, statusCode: number, payload: any): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
