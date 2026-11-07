import { safeNow } from './state-utils';
import type { RemoteNodeRecord } from './types';
import type { RemoteNodePayload } from '../../src/shared/remote-node';
import type { RemoteNodeOperationContext } from './operation-context';
import { REMOTE_NODE_REQUEST_MS, REMOTE_NODE_TASK_REQUEST_MS, remoteResponseText } from './http-response';
import { remoteNodeBaseUrl } from '../../src/shared/remote-node-input';

export async function requestRemoteNode(
  node: RemoteNodeRecord,
  method: string,
  routePath: string,
  saveState: () => void | Promise<void>,
  body?: Record<string, unknown>,
  context?: RemoteNodeOperationContext,
): Promise<RemoteNodePayload> {
  const cancellation = new AbortController();
  const signal = context?.signal ? AbortSignal.any([context.signal, cancellation.signal]) : cancellation.signal;
  const assert = () => {
    if (signal.aborted) throw new Error('Solicitud remota cancelada.');
    context?.assertCurrent();
  };
  const timeout = routePath === '/v1/desktop/execute-task' ? REMOTE_NODE_TASK_REQUEST_MS : REMOTE_NODE_REQUEST_MS;
  const timer = setTimeout(() => cancellation.abort(), timeout);
  let acquiredResponse: Response | undefined;
  let abort!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new Error('Solicitud remota cancelada.'));
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    assert();
    const baseUrl = remoteNodeBaseUrl.parse(node.baseUrl).replace(/\/+$/, '');
    const headers: Record<string, string> = { Authorization: `Bearer ${node.token}` };
    let payload: string | undefined;
    if (body && method !== 'GET') {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      assert(); context?.onDispatch?.();
      const pending = fetch(`${baseUrl}${routePath}`, { method, headers, body: payload, redirect: 'error', signal })
        .then(value => { if (signal.aborted) void value.body?.cancel().catch(() => undefined); return value; });
      response = await Promise.race([pending, aborted]);
      acquiredResponse = response;
    } catch {
      assert();
      node.lastError = 'No se pudo contactar el nodo remoto.';
      node.updatedAt = safeNow();
      await saveState(); assert();
      throw new Error(node.lastError);
    }

    assert();
    if (response.redirected || response.status >= 300 && response.status < 400) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error('No se permiten redirecciones del nodo remoto.');
    }
    const parsed = await parseRemoteResponse(response, signal);
    assert();
    node.updatedAt = safeNow();
    if (response.ok) {
      node.lastHealthAt = safeNow();
      node.lastError = null;
      updateNodeCapabilities(node, parsed);
    } else {
      node.lastError = `HTTP ${response.status}`;
    }
    await saveState(); assert();

    if (!response.ok) {
      throw new Error(`El nodo remoto devolvió HTTP ${response.status}.`);
    }
    return parsed;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    void acquiredResponse?.body?.cancel().catch(() => undefined);
  }
}

async function parseRemoteResponse(response: Response, signal: AbortSignal): Promise<RemoteNodePayload> {
  const text = await remoteResponseText(response, signal);
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    return { success: response.ok, raw: text };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('El nodo remoto devolvió una respuesta JSON no válida.');
  return parsed as RemoteNodePayload;
}

function updateNodeCapabilities(node: RemoteNodeRecord, parsed: RemoteNodePayload): void {
  const health = parsed.health && typeof parsed.health === 'object' && !Array.isArray(parsed.health)
    ? parsed.health as RemoteNodePayload : null;
  const capabilities = Array.isArray(parsed.capabilities) ? parsed.capabilities : health?.capabilities;
  if (Array.isArray(capabilities) && capabilities.every((value): value is string => typeof value === 'string')) {
    node.capabilities = [...capabilities];
  }
}
