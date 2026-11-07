import { z } from 'zod';
import { remoteNodeBaseUrl, remoteNodeBindAddress, remoteNodeId, remoteNodeRegistration } from '../../src/shared/remote-node-input';
import type { RemoteNodeState } from './types';

export const REMOTE_NODE_STATE_BYTES = 4 * 1024 * 1024;
export const REMOTE_NODE_PROFILE_LIMIT = 256;
export const remoteNodeOwner = z.string().min(1).max(128).refine(value => value.trim().length > 0 && Array.from(value).every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127));
export const storedRemoteNode = z.object({
  id: remoteNodeId, name: remoteNodeRegistration.shape.name, baseUrl: remoteNodeBaseUrl,
  token: remoteNodeRegistration.shape.token, enabled: z.boolean(),
  owner_user_id: remoteNodeOwner, organization_id: remoteNodeOwner.nullable().optional(),
  visibility: z.enum(['personal', 'organization']).optional(),
  createdAt: z.string().min(1).max(64), updatedAt: z.string().min(1).max(64),
  lastHealthAt: z.string().max(64).nullable().optional(), lastError: z.string().max(2000).nullable().optional(),
  capabilities: z.array(z.string().max(128)).max(128).optional(),
});
const stateSchema = z.object({
  host: z.object({ enabled: z.boolean(), bindAddress: remoteNodeBindAddress, port: z.number().int().min(1).max(65535),
    token: remoteNodeRegistration.shape.token, nodeName: remoteNodeRegistration.shape.name, advertiseUrl: remoteNodeBaseUrl.nullable().optional() }).strict(),
  nodes: z.array(storedRemoteNode.strict()).max(REMOTE_NODE_PROFILE_LIMIT).refine(nodes => new Set(nodes.map(node => node.id)).size === nodes.length),
  migration: z.object({ pendingNodes: z.number().int().min(0).max(4096), hostPending: z.boolean() }).strict().optional(),
}).strict();
export const remoteNodePrivatePayload = z.object({ version: z.literal(1), owner: remoteNodeOwner, state: stateSchema }).strict()
  .refine(payload => payload.state.nodes.every(node => node.owner_user_id === payload.owner));

export function remoteNodePayload(owner: string, state: RemoteNodeState) {
  const parsed = remoteNodePrivatePayload.safeParse({ version: 1, owner, state });
  if (!parsed.success) throw new Error('El perfil de nodos no tiene un formato o propietario válido.');
  return parsed.data;
}
export function copyRemoteNodeState(state: RemoteNodeState): RemoteNodeState {
  return { host: { ...state.host }, nodes: state.nodes.map(node => ({ ...node, ...(node.capabilities ? { capabilities: [...node.capabilities] } : {}) })),
    ...(state.migration ? { migration: { ...state.migration } } : {}) };
}
