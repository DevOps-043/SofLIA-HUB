import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { isAuthorized, sendJson } from './host-utils';
import { dispatchHostRoute } from './host-routes';
import type { RemoteNodeServer, RemoteNodeServerContext } from './types';
const listeningHosts = new WeakMap<NonNullable<RemoteNodeServer>, string>();
const listeningStates = new WeakMap<NonNullable<RemoteNodeServer>, RemoteNodeServerContext['state']>();

export async function syncRemoteNodeServer(
  server: RemoteNodeServer,
  context: RemoteNodeServerContext,
): Promise<RemoteNodeServer> {
  const { port, bindAddress } = context.state.host;
  if (!context.state.host.enabled) {
    return stopRemoteNodeServer(server);
  }
  context.assertCurrent();

  if (server?.listening) {
    const address = server.address();
    if (address && typeof address === 'object' && address.port === port && listeningHosts.get(server) === bindAddress && listeningStates.get(server) === context.state) return server;
    await stopRemoteNodeServer(server);
  }

  const nextServer = http.createServer((req, res) => {
    void handleRequest(req, res, context);
  });
  nextServer.headersTimeout = 10_000; nextServer.requestTimeout = 15_000; nextServer.keepAliveTimeout = 1000;
  nextServer.maxHeadersCount = 32; nextServer.maxRequestsPerSocket = 32;
  const connections = new Set<import('node:net').Socket>();
  nextServer.on('connection', socket => {
    if (connections.size >= 8 || context.signal.aborted) { socket.destroy(); return; }
    connections.add(socket); socket.once('close', () => connections.delete(socket));
  });
  const revoke = () => nextServer.closeAllConnections();
  context.signal.addEventListener('abort', revoke, { once: true });
  nextServer.once('close', () => context.signal.removeEventListener('abort', revoke));

  try { await new Promise<void>((resolve, reject) => {
    nextServer.once('error', reject);
    nextServer.listen(port, bindAddress, () => {
      nextServer.off('error', reject);
      resolve();
    });
  }); } catch (error) {
    context.signal.removeEventListener('abort', revoke); nextServer.closeAllConnections();
    throw error;
  }
  listeningHosts.set(nextServer, bindAddress);
  listeningStates.set(nextServer, context.state);
  if (context.signal.aborted) { nextServer.closeAllConnections(); await stopRemoteNodeServer(nextServer); context.assertCurrent(); }
  return nextServer;
}

export async function stopRemoteNodeServer(server: RemoteNodeServer): Promise<RemoteNodeServer> {
  if (!server) return null;
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  return null;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  context: RemoteNodeServerContext,
): Promise<void> {
  try {
    context.assertCurrent();
    if (!isAuthorized(req, context.state)) {
      sendJson(res, 401, { success: false, error: 'Token de nodo remoto invalido.' });
      return;
    }

    const token = context.state.host.token;
    const cancelled = new AbortController();
    const cancel = () => cancelled.abort();
    res.once('close', cancel); req.once('aborted', cancel);
    const signal = AbortSignal.any([context.signal, cancelled.signal]);
    const requestContext: RemoteNodeServerContext = { ...context, signal, assertCurrent: () => {
      context.assertCurrent();
      if (signal.aborted || res.destroyed || !context.state.host.enabled || context.state.host.token !== token) throw new Error('Solicitud de nodo revocada.');
    } };
    try {
      const requestUrl = new URL(req.url || '/', context.getListeningUrl());
      await dispatchHostRoute(req, res, requestUrl, requestContext);
    } finally { res.removeListener('close', cancel); req.removeListener('aborted', cancel); }
  } catch {
    sendJson(res, 500, { success: false, error: 'Error interno del nodo remoto.' });
  }
}
