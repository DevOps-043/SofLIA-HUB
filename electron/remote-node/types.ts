import type { RemoteNodeRecord } from '../../src/shared/remote-node';
export type { RemoteNodeCapability, RemoteNodeRecord, RemoteNodeHostUpdates } from '../../src/shared/remote-node';
import type http from 'node:http';
import type { DesktopAgentService } from '../desktop-agent-service';

export interface RemoteNodeHostConfig {
  enabled: boolean;
  bindAddress: string;
  port: number;
  token: string;
  nodeName: string;
  advertiseUrl?: string | null;
}

export interface RemoteNodeState {
  host: RemoteNodeHostConfig;
  nodes: RemoteNodeRecord[];
  migration?: { pendingNodes: number; hostPending: boolean };
}

export interface RemoteNodeDeps {
  desktopAgent: DesktopAgentService;
}

export interface RemoteNodeServerContext {
  state: RemoteNodeState;
  deps: RemoteNodeDeps | null;
  getListeningUrl: () => string;
  assertCurrent: () => void;
  signal: AbortSignal;
}

export type RemoteNodeServer = http.Server | null;
