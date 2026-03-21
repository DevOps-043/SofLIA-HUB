export interface RemoteNodeHostStatus {
  success: boolean;
  enabled: boolean;
  bind_address: string;
  port: number;
  node_name: string;
  advertise_url: string | null;
  local_url: string;
  running: boolean;
  token: string;
  capabilities: string[];
  registered_nodes: number;
}

export interface RemoteNodeRecord {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastHealthAt?: string | null;
  lastError?: string | null;
  capabilities?: string[];
}

export interface RemoteNodeHealthResult {
  success: boolean;
  node_id: string;
  health?: Record<string, unknown>;
  error?: string;
}

export interface RemoteNodeScreenshotResult {
  success: boolean;
  image?: string;
  axTree?: unknown;
  error?: string;
}

export function isRemoteNodeAvailable(): boolean {
  return !!window.remoteNode;
}

function getAPI() {
  if (!window.remoteNode) {
    throw new Error('Remote Node API no disponible. Ejecuta SofLIA dentro de Electron.');
  }
  return window.remoteNode;
}

export async function getRemoteNodeHostStatus(): Promise<RemoteNodeHostStatus> {
  return getAPI().getHostStatus();
}

export async function updateRemoteNodeHostConfig(updates: {
  enabled?: boolean;
  bind_address?: string;
  port?: number;
  node_name?: string;
  advertise_url?: string | null;
  rotate_token?: boolean;
}) {
  return getAPI().updateHostConfig(updates) as Promise<RemoteNodeHostStatus>;
}

export async function listRemoteNodes(): Promise<{ success: boolean; nodes?: RemoteNodeRecord[]; error?: string }> {
  return getAPI().listNodes();
}

export async function registerRemoteNode(node: {
  id?: string;
  name: string;
  base_url: string;
  token: string;
  enabled?: boolean;
}) {
  return getAPI().registerNode(node) as Promise<{ success: boolean; node?: RemoteNodeRecord; error?: string }>;
}

export async function removeRemoteNode(nodeId: string) {
  return getAPI().removeNode(nodeId) as Promise<{ success: boolean; removed?: boolean; node_id?: string; error?: string }>;
}

export async function testRemoteNode(nodeId: string): Promise<RemoteNodeHealthResult> {
  return getAPI().testNode(nodeId);
}

export async function takeRemoteNodeScreenshot(nodeId: string, args?: { display_id?: string }): Promise<RemoteNodeScreenshotResult> {
  return getAPI().takeScreenshot(nodeId, args || {});
}
