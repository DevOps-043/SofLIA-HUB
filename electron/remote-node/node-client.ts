import { safeNow } from './state-utils';
import type { RemoteNodeRecord } from './types';

export async function requestRemoteNode(
  node: RemoteNodeRecord,
  method: string,
  routePath: string,
  saveState: () => void,
  body?: Record<string, any>,
): Promise<any> {
  const headers: Record<string, string> = { Authorization: `Bearer ${node.token}` };
  let payload: string | undefined;
  if (body && method !== 'GET') {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`${node.baseUrl}${routePath}`, { method, headers, body: payload });
  } catch (error: any) {
    node.lastError = error.message || 'No se pudo contactar el nodo remoto.';
    node.updatedAt = safeNow();
    saveState();
    throw error;
  }

  const parsed = await parseRemoteResponse(response);
  node.updatedAt = safeNow();
  if (response.ok) {
    node.lastHealthAt = safeNow();
    node.lastError = null;
    updateNodeCapabilities(node, parsed);
  } else {
    node.lastError = parsed?.error || `HTTP ${response.status}`;
  }
  saveState();

  if (!response.ok) {
    throw new Error(parsed?.error || `El nodo remoto devolvio HTTP ${response.status}.`);
  }
  return parsed;
}

async function parseRemoteResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: response.ok, raw: text };
  }
}

function updateNodeCapabilities(node: RemoteNodeRecord, parsed: any): void {
  if (Array.isArray(parsed?.capabilities)) {
    node.capabilities = parsed.capabilities;
  } else if (Array.isArray(parsed?.health?.capabilities)) {
    node.capabilities = parsed.health.capabilities;
  }
}
