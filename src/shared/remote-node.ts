/** DTO de nodos remotos: datos puros, sin dependencias de main o Electron. */
import type { RemoteBackgroundCommandInput, RemoteDesktopTaskInput, RemoteOpenApplicationInput, RemoteScreenshotInput } from './remote-node-input';
export interface RemoteNodeOperationResult { success: boolean; error?: string; code?: string; cancelled?: boolean; uncertain?: boolean }
export type RemoteNodeCapability = 'open_application' | 'run_background_command' | 'desktop_execute_task' | 'process_sessions' | 'take_screenshot';
export interface RemoteNodeRecord {
  id: string; name: string; baseUrl: string; token: string; enabled: boolean;
  owner_user_id?: string | null; organization_id?: string | null;
  visibility?: 'personal' | 'organization'; createdAt: string; updatedAt: string;
  lastHealthAt?: string | null; lastError?: string | null; capabilities?: string[];
}
export interface RemoteNodeHostStatus {
  success: boolean; enabled: boolean; bind_address: string; port: number;
  node_name: string; advertise_url: string | null; local_url: string; running: boolean;
  token: string; capabilities: string[]; registered_nodes: number;
  migration_notice?: string; legacy_pending_nodes?: number;
}
export interface RemoteNodeHostUpdates {
  enabled?: boolean; bind_address?: string; port?: number; node_name?: string;
  advertise_url?: string | null; rotate_token?: boolean;
}
export interface RegisterRemoteNodeInput {
  id?: string; name: string; base_url: string; token: string; enabled?: boolean;
  owner_user_id?: string | null; organization_id?: string | null; visibility?: 'personal' | 'organization';
}
/** El protocolo de herramientas es extensible; comprobar valores antes de usarlos. */
export type RemoteNodePayload = Record<string, unknown>;
export interface RemoteNodeHealthResult extends RemoteNodeOperationResult { node_id?: string; health?: RemoteNodePayload }
export interface RemoteNodeScreenshotResult extends RemoteNodeOperationResult { image?: string; axTree?: unknown }
export interface RemoteNodeApi {
  getHostStatus(): Promise<RemoteNodeHostStatus>;
  updateHostConfig(updates: RemoteNodeHostUpdates): Promise<RemoteNodeHostStatus>;
  listNodes(): Promise<RemoteNodeOperationResult & { nodes?: RemoteNodeRecord[] }>;
  registerNode(node: RegisterRemoteNodeInput): Promise<RemoteNodeOperationResult & { node?: RemoteNodeRecord }>;
  removeNode(nodeId: string): Promise<RemoteNodeOperationResult & { removed?: boolean; node_id?: string }>;
  testNode(nodeId: string): Promise<RemoteNodeHealthResult>;
  openApplication(nodeId: string, args: RemoteOpenApplicationInput): Promise<RemoteNodePayload>;
  runBackgroundCommand(nodeId: string, args: RemoteBackgroundCommandInput): Promise<RemoteNodePayload>;
  executeTask(nodeId: string, args: RemoteDesktopTaskInput): Promise<RemoteNodePayload>;
  takeScreenshot(nodeId: string, args?: RemoteScreenshotInput): Promise<RemoteNodePayload>;
  listProcessSessions(nodeId: string): Promise<RemoteNodePayload>;
  pollProcessSession(nodeId: string, sessionId: string): Promise<RemoteNodePayload>;
  killProcessSession(nodeId: string, sessionId: string): Promise<RemoteNodePayload>;
}
