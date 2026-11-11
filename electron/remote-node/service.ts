import type { RemoteNodeHostStatus, RemoteNodePayload, RemoteNodeRecord } from '../../src/shared/remote-node';
import { EventEmitter } from 'node:events';
import { remoteHostUpdates, remoteNodeRegistration } from '../../src/shared/remote-node-input';
import { syncRemoteNodeServer } from './host-server';
import { buildRemoteNodeAction, buildProcessSessionRoute } from './node-actions';
import { requestRemoteNode } from './node-client';
import { getActiveRemoteNode, listRemoteNodes, registerRemoteNode, removeRemoteNode } from './node-registry';
import { buildHostStatus } from './status';
import { applyHostUpdates } from './state-utils';
import { RemoteNodeSessionState } from './session-state';
import { createLogger } from '../utils/logger';
import type { RemoteNodeDeps, RemoteNodeHostUpdates, RemoteNodeServer, RemoteNodeState } from './types';
import type { RemoteNodeOperationContext } from './operation-context';

const log = createLogger('nodos-remotos-servicio');
function listeningUrl(state: RemoteNodeState): string {
  const address = state.host.bindAddress === '0.0.0.0' ? '127.0.0.1' : state.host.bindAddress;
  return 'http://' + (address.includes(':') ? '[' + address + ']' : address) + ':' + state.host.port;
}
export class RemoteNodeService extends EventEmitter {
  private initialized = false;
  private deps: RemoteNodeDeps | null = null;
  private server: RemoteNodeServer = null;
  private serverSync: Promise<void> | null = null;
  private readonly session = new RemoteNodeSessionState();
  async initialize(deps: RemoteNodeDeps): Promise<void> {
    this.deps = deps; this.initialized = true;
    await this.session.start(revoked => {
      if (revoked) this.server?.closeAllConnections();
      void this.syncServerState().catch(() => { log.warn('No se pudo reconciliar el host remoto.'); });
    });
    await this.syncServerState();
  }
  async dispose(): Promise<void> {
    this.initialized = false; this.session.dispose(); this.deps = null; await this.syncServerState();
  }
  async getHostStatus(): Promise<RemoteNodeHostStatus> {
    this.ensureInitialized(); const identity = await this.session.identity();
    await this.syncServerState(); identity.assertCurrent();
    return buildHostStatus(identity.state, this.server, () => listeningUrl(identity.state));
  }
  async captureConfigurationReview(context: RemoteNodeOperationContext): Promise<RemoteNodeOperationContext> {
    this.ensureInitialized(); return this.session.review(context);
  }
  async updateHostConfig(updates: RemoteNodeHostUpdates, context?: RemoteNodeOperationContext): Promise<RemoteNodeHostStatus> {
    this.ensureInitialized(); const identity = await this.session.identity();
    const parsed = remoteHostUpdates.safeParse(updates);
    if (!parsed.success) throw new Error('Configuración de host remoto no válida.');
    await this.session.mutate(next => applyHostUpdates(next, parsed.data), context);
    this.server?.closeAllConnections(); await this.syncServerState(); identity.assertCurrent();
    return buildHostStatus(identity.state, this.server, () => listeningUrl(identity.state));
  }
  async listNodes(): Promise<RemoteNodeRecord[]> {
    this.ensureInitialized(); const identity = await this.session.identity(); identity.assertCurrent(); return listRemoteNodes(identity.state);
  }
  async registerNode(input: Parameters<typeof registerRemoteNode>[1], context?: RemoteNodeOperationContext): Promise<{ success: boolean; node: RemoteNodeRecord }> {
    this.ensureInitialized();
    const parsed = remoteNodeRegistration.safeParse(input);
    if (!parsed.success) throw new Error('Registro de nodo remoto no válido.');
    return this.session.mutate((next, owner) => {
      if (parsed.data.owner_user_id && parsed.data.owner_user_id !== owner) throw new Error('Propietario de nodo no válido.');
      const node = registerRemoteNode(next, { ...parsed.data, owner_user_id: owner });
      return { success: true, node: { ...node, capabilities: node.capabilities ? [...node.capabilities] : undefined } };
    }, context);
  }
  async removeNode(nodeId: string, context?: RemoteNodeOperationContext): Promise<{ success: boolean; removed: boolean; node_id: string }> {
    this.ensureInitialized();
    return this.session.mutate(next => ({ success: true, removed: removeRemoteNode(next, nodeId), node_id: nodeId }), context);
  }
  async testNode(nodeId: string, context?: RemoteNodeOperationContext): Promise<{ success: boolean; node_id: string; health: RemoteNodePayload }> {
    return { success: true, node_id: nodeId, health: await this.requestNode(nodeId, 'GET', '/health', undefined, context) };
  }
  async openApplicationOnNode(nodeId: string, args: Record<string, unknown>, context?: RemoteNodeOperationContext): Promise<RemoteNodePayload> { return this.requestAction(nodeId, 'open_application', args, context); }
  async runBackgroundCommandOnNode(nodeId: string, args: Record<string, unknown>, context?: RemoteNodeOperationContext): Promise<RemoteNodePayload> { return this.requestAction(nodeId, 'run_background_command', args, context); }
  async executeDesktopTaskOnNode(nodeId: string, args: Record<string, unknown>, context?: RemoteNodeOperationContext): Promise<RemoteNodePayload> { return this.requestAction(nodeId, 'desktop_execute_task', args, context); }
  async listProcessSessionsOnNode(nodeId: string, context?: RemoteNodeOperationContext): Promise<RemoteNodePayload> { return this.requestAction(nodeId, 'list_process_sessions', {}, context); }
  async takeScreenshotOnNode(nodeId: string, args: Record<string, unknown>, context?: RemoteNodeOperationContext): Promise<RemoteNodePayload> { return this.requestAction(nodeId, 'take_screenshot', args, context); }
  async pollProcessSessionOnNode(nodeId: string, sessionId: string, context?: RemoteNodeOperationContext): Promise<RemoteNodePayload> {
    const route = buildProcessSessionRoute('poll', sessionId); return this.requestNode(nodeId, route.method, route.routePath, undefined, context);
  }
  async killProcessSessionOnNode(nodeId: string, sessionId: string, context?: RemoteNodeOperationContext): Promise<RemoteNodePayload> {
    const route = buildProcessSessionRoute('kill', sessionId); return this.requestNode(nodeId, route.method, route.routePath, undefined, context);
  }
  private ensureInitialized(): void { if (!this.initialized || !this.deps) throw new Error('Servicio de nodos no inicializado.'); }
  private async requestNode(nodeId: string, method: string, routePath: string, body?: Record<string, unknown>, context?: RemoteNodeOperationContext): Promise<RemoteNodePayload> {
    this.ensureInitialized(); const review = await this.session.review(context);
    const source = getActiveRemoteNode(review.state, nodeId);
    const node = { ...source, capabilities: source.capabilities ? [...source.capabilities] : undefined };
    const save = async () => {
      await this.session.mutate(next => {
        const current = getActiveRemoteNode(next, nodeId);
        current.updatedAt = node.updatedAt; current.lastHealthAt = node.lastHealthAt; current.lastError = node.lastError;
        current.capabilities = node.capabilities ? [...node.capabilities] : undefined;
      }, review, false);
    };
    return requestRemoteNode(node, method, routePath, save, body, review);
  }
  private async requestAction(nodeId: string, action: Parameters<typeof buildRemoteNodeAction>[0], args = {}, context?: RemoteNodeOperationContext): Promise<RemoteNodePayload> {
    const request = buildRemoteNodeAction(action, args); return this.requestNode(nodeId, request.method, request.routePath, request.body, context);
  }
  private syncServerState(): Promise<void> {
    if (this.serverSync) return this.serverSync;
    this.serverSync = (async () => {
      let version: number;
      do {
        version = this.session.version;
        const identity = this.session.peek();
        try {
          this.server = await syncRemoteNodeServer(this.server, {
            state: identity.state, deps: this.deps, getListeningUrl: () => listeningUrl(identity.state),
            assertCurrent: identity.assertCurrent, signal: identity.signal!,
          });
        } catch (error) { if (version === this.session.version) throw error; }
      } while (version !== this.session.version);
    })().finally(() => { this.serverSync = null; });
    return this.serverSync;
  }
}
export const remoteNodeService = new RemoteNodeService();
