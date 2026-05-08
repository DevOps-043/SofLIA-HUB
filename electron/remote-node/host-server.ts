import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { isAuthorized, sendJson } from './host-utils';
import { dispatchHostRoute } from './host-routes';
import type { RemoteNodeServer, RemoteNodeServerContext } from './types';

export async function syncRemoteNodeServer(
  server: RemoteNodeServer,
  context: RemoteNodeServerContext,
): Promise<RemoteNodeServer> {
  if (!context.state.host.enabled) {
    return stopRemoteNodeServer(server);
  }

  if (server?.listening) {
    const address = server.address();
    if (address && typeof address === 'object' && address.port === context.state.host.port) return server;
    await stopRemoteNodeServer(server);
  }

  const nextServer = http.createServer((req, res) => {
    void handleRequest(req, res, context);
  });

  await new Promise<void>((resolve, reject) => {
    nextServer.once('error', reject);
    nextServer.listen(context.state.host.port, context.state.host.bindAddress, () => {
      nextServer.off('error', reject);
      resolve();
    });
  });
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
    if (!isAuthorized(req, context.state)) {
      sendJson(res, 401, { success: false, error: 'Token de nodo remoto invalido.' });
      return;
    }

    const requestUrl = new URL(req.url || '/', context.getListeningUrl());
    await dispatchHostRoute(req, res, requestUrl, context);
  } catch (error: any) {
    sendJson(res, 500, { success: false, error: error.message || 'Error interno del nodo remoto.' });
  }
}
