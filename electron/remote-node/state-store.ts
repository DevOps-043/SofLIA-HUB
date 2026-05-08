import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { buildDefaultState, normalizeRemoteNode } from './state-utils';
import type { RemoteNodeState } from './types';

export function getRemoteNodeStatePath(): string {
  try {
    return path.join(app.getPath('userData'), 'remote-node-state.json');
  } catch {
    return path.join(process.cwd(), 'remote-node-state.json');
  }
}

export function loadRemoteNodeState(saveFallback: (state: RemoteNodeState) => void): RemoteNodeState {
  const statePath = getRemoteNodeStatePath();
  try {
    if (!fs.existsSync(statePath)) {
      const fallback = buildDefaultState();
      saveFallback(fallback);
      return fallback;
    }

    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Partial<RemoteNodeState>;
    const fallback = buildDefaultState();
    return {
      host: {
        enabled: parsed.host?.enabled ?? fallback.host.enabled,
        bindAddress: parsed.host?.bindAddress || fallback.host.bindAddress,
        port: parsed.host?.port || fallback.host.port,
        token: parsed.host?.token || fallback.host.token,
        nodeName: parsed.host?.nodeName || fallback.host.nodeName,
        advertiseUrl: parsed.host?.advertiseUrl || null,
      },
      nodes: Array.isArray(parsed.nodes)
        ? parsed.nodes.map((node) => normalizeRemoteNode(node))
        : [],
    };
  } catch (error) {
    console.error('[RemoteNodeService] No se pudo cargar el estado:', error);
    const fallback = buildDefaultState();
    saveFallback(fallback);
    return fallback;
  }
}

export function saveRemoteNodeState(state: RemoteNodeState): void {
  const statePath = getRemoteNodeStatePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}
