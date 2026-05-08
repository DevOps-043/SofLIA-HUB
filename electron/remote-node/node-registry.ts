import { REMOTE_NODE_CAPABILITIES } from './constants';
import { normalizeBaseUrl, safeNow, sanitizeNodeId } from './state-utils';
import type { RemoteNodeRecord, RemoteNodeState } from './types';

export interface RegisterRemoteNodeInput {
  id?: string;
  name: string;
  base_url: string;
  token: string;
  enabled?: boolean;
}

export function listRemoteNodes(state: RemoteNodeState): RemoteNodeRecord[] {
  return state.nodes
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((node) => ({ ...node }));
}

export function registerRemoteNode(state: RemoteNodeState, input: RegisterRemoteNodeInput): RemoteNodeRecord {
  const baseUrl = normalizeBaseUrl(input.base_url);
  if (!baseUrl) throw new Error('base_url es obligatorio.');
  if (!input.token?.trim()) throw new Error('token es obligatorio.');

  const id = sanitizeNodeId(input.id || input.name || baseUrl);
  const now = safeNow();
  const existingIndex = state.nodes.findIndex((node) => node.id === id);
  const previous = existingIndex >= 0 ? state.nodes[existingIndex] : null;
  const next: RemoteNodeRecord = {
    id,
    name: input.name?.trim() || id,
    baseUrl,
    token: input.token.trim(),
    enabled: input.enabled !== false,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    lastHealthAt: previous?.lastHealthAt || null,
    lastError: previous?.lastError || null,
    capabilities: previous?.capabilities?.length ? previous.capabilities : [...REMOTE_NODE_CAPABILITIES],
  };

  if (existingIndex >= 0) state.nodes[existingIndex] = next;
  else state.nodes.push(next);
  return next;
}

export function removeRemoteNode(state: RemoteNodeState, nodeId: string): boolean {
  const initialLength = state.nodes.length;
  state.nodes = state.nodes.filter((node) => node.id !== nodeId);
  return initialLength !== state.nodes.length;
}

export function getActiveRemoteNode(state: RemoteNodeState, nodeId: string): RemoteNodeRecord {
  const node = state.nodes.find((candidate) => candidate.id === nodeId && candidate.enabled !== false);
  if (!node) throw new Error(`No existe un nodo remoto activo con id "${nodeId}".`);
  return node;
}
