import type http from 'node:http';
import type { DesktopAgentService } from '../desktop-agent-service';

export type RemoteNodeCapability =
  | 'open_application'
  | 'run_background_command'
  | 'desktop_execute_task'
  | 'process_sessions'
  | 'take_screenshot';

export interface RemoteNodeRecord {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
  enabled: boolean;
  owner_user_id?: string | null;
  organization_id?: string | null;
  visibility?: 'personal' | 'organization';
  createdAt: string;
  updatedAt: string;
  lastHealthAt?: string | null;
  lastError?: string | null;
  capabilities?: RemoteNodeCapability[];
}

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
}

export interface RemoteNodeDeps {
  desktopAgent: DesktopAgentService;
}

export interface RemoteNodeHostUpdates {
  enabled?: boolean;
  bind_address?: string;
  port?: number;
  node_name?: string;
  advertise_url?: string | null;
  rotate_token?: boolean;
}

export interface RemoteNodeServerContext {
  state: RemoteNodeState;
  deps: RemoteNodeDeps | null;
  getListeningUrl: () => string;
}

export type RemoteNodeServer = http.Server | null;
