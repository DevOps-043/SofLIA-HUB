import crypto from 'node:crypto';
import os from 'node:os';
import { DEFAULT_PORT, REMOTE_NODE_CAPABILITIES } from './constants';
import type { RemoteNodeHostUpdates, RemoteNodeRecord, RemoteNodeState } from './types';

export function generateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function safeNow(): string {
  return new Date().toISOString();
}

export function normalizeBaseUrl(baseUrl: string): string {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

export function sanitizeNodeId(value: string): string {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return cleaned || `node-${Date.now().toString(36)}`;
}

export function buildDefaultState(): RemoteNodeState {
  const hostname = process.env.COMPUTERNAME || os.hostname() || 'soflia-node';
  return {
    host: {
      enabled: true,
      bindAddress: '127.0.0.1',
      port: DEFAULT_PORT,
      token: generateToken(),
      nodeName: hostname,
      advertiseUrl: null,
    },
    nodes: [],
  };
}

export function normalizeRemoteNode(node: Partial<RemoteNodeRecord>): RemoteNodeRecord {
  return {
    ...node,
    id: sanitizeNodeId(node.id || node.name || node.baseUrl || ''),
    name: node.name || sanitizeNodeId(node.id || node.baseUrl || ''),
    baseUrl: normalizeBaseUrl(node.baseUrl || ''),
    token: node.token || '',
    enabled: node.enabled !== false,
    createdAt: node.createdAt || safeNow(),
    updatedAt: node.updatedAt || safeNow(),
    lastHealthAt: node.lastHealthAt || null,
    lastError: node.lastError || null,
    capabilities: Array.isArray(node.capabilities) && node.capabilities.length > 0
      ? node.capabilities
      : [...REMOTE_NODE_CAPABILITIES],
  };
}

export function applyHostUpdates(state: RemoteNodeState, updates: RemoteNodeHostUpdates): void {
  if (typeof updates.enabled === 'boolean') state.host.enabled = updates.enabled;
  if (typeof updates.bind_address === 'string' && updates.bind_address.trim()) {
    state.host.bindAddress = updates.bind_address.trim();
  }
  if (typeof updates.port === 'number' && Number.isFinite(updates.port) && updates.port > 0 && updates.port < 65536) {
    state.host.port = Math.round(updates.port);
  }
  if (typeof updates.node_name === 'string' && updates.node_name.trim()) {
    state.host.nodeName = updates.node_name.trim();
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'advertise_url')) {
    state.host.advertiseUrl = updates.advertise_url ? normalizeBaseUrl(updates.advertise_url) : null;
  }
  if (updates.rotate_token) state.host.token = generateToken();
}
