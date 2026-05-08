import { EventEmitter } from 'node:events';
import { syncRemoteNodeServer } from './host-server';
import { buildRemoteNodeAction, buildProcessSessionRoute } from './node-actions';
import { requestRemoteNode } from './node-client';
import { getActiveRemoteNode, listRemoteNodes, registerRemoteNode, removeRemoteNode } from './node-registry';
import { buildHostStatus } from './status';
import { applyHostUpdates, buildDefaultState } from './state-utils';
import { loadRemoteNodeState, saveRemoteNodeState } from './state-store';
import type { RemoteNodeDeps, RemoteNodeHostUpdates, RemoteNodeServer, RemoteNodeState } from './types';

export class RemoteNodeService extends EventEmitter {
  private initialized = false;
  private deps: RemoteNodeDeps | null = null;
  private server: RemoteNodeServer = null;
  private state: RemoteNodeState = buildDefaultState();
  async initialize(deps: RemoteNodeDeps): Promise<void> {
    this.deps = deps;
    if (!this.initialized) {
      this.state = loadRemoteNodeState((state) => saveRemoteNodeState(state));
      this.initialized = true;
    }
    await this.syncServerState();
  }
  async getHostStatus(): Promise<any> {
    this.ensureInitialized();
    return buildHostStatus(this.state, this.server, () => this.getListeningUrl());
  }
  async updateHostConfig(updates: RemoteNodeHostUpdates): Promise<any> {
    this.ensureInitialized();
    applyHostUpdates(this.state, updates);
    this.saveState();
    await this.syncServerState();
    return this.getHostStatus();
  }
  async listNodes(): Promise<any[]> {
    this.ensureInitialized();
    return listRemoteNodes(this.state);
  }
  async registerNode(input: Parameters<typeof registerRemoteNode>[1]): Promise<any> {
    this.ensureInitialized();
    const node = registerRemoteNode(this.state, input);
    this.saveState();
    return { success: true, node };
  }
  async removeNode(nodeId: string): Promise<any> {
    this.ensureInitialized();
    const removed = removeRemoteNode(this.state, nodeId);
    this.saveState();
    return { success: true, removed, node_id: nodeId };
  }
  async testNode(nodeId: string): Promise<any> {
    return { success: true, node_id: nodeId, health: await this.requestNode(nodeId, 'GET', '/health') };
  }
  async openApplicationOnNode(nodeId: string, args: Record<string, any>): Promise<any> { return this.requestAction(nodeId, 'open_application', args); }
  async runBackgroundCommandOnNode(nodeId: string, args: Record<string, any>): Promise<any> { return this.requestAction(nodeId, 'run_background_command', args); }
  async executeDesktopTaskOnNode(nodeId: string, args: Record<string, any>): Promise<any> { return this.requestAction(nodeId, 'desktop_execute_task', args); }
  async listProcessSessionsOnNode(nodeId: string): Promise<any> { return this.requestAction(nodeId, 'list_process_sessions'); }
  async takeScreenshotOnNode(nodeId: string, args: Record<string, any>): Promise<any> { return this.requestAction(nodeId, 'take_screenshot', args); }
  async pollProcessSessionOnNode(nodeId: string, sessionId: string): Promise<any> {
    const route = buildProcessSessionRoute('poll', sessionId);
    return this.requestNode(nodeId, route.method, route.routePath);
  }
  async killProcessSessionOnNode(nodeId: string, sessionId: string): Promise<any> {
    const route = buildProcessSessionRoute('kill', sessionId);
    return this.requestNode(nodeId, route.method, route.routePath);
  }
  private ensureInitialized(): void {
    if (!this.initialized || !this.deps) throw new Error('RemoteNodeService no inicializado.');
  }
  private getListeningUrl(): string {
    const host = this.state.host.bindAddress === '0.0.0.0' ? '127.0.0.1' : this.state.host.bindAddress;
    return `http://${host}:${this.state.host.port}`;
  }
  private saveState(): void {
    saveRemoteNodeState(this.state);
  }
  private async requestNode(nodeId: string, method: string, routePath: string, body?: Record<string, any>): Promise<any> {
    this.ensureInitialized();
    return requestRemoteNode(getActiveRemoteNode(this.state, nodeId), method, routePath, () => this.saveState(), body);
  }
  private async requestAction(nodeId: string, action: Parameters<typeof buildRemoteNodeAction>[0], args = {}): Promise<any> {
    const request = buildRemoteNodeAction(action, args);
    return this.requestNode(nodeId, request.method, request.routePath, request.body);
  }
  private async syncServerState(): Promise<void> {
    this.server = await syncRemoteNodeServer(this.server, {
      state: this.state,
      deps: this.deps,
      getListeningUrl: () => this.getListeningUrl(),
    });
  }
}

export const remoteNodeService = new RemoteNodeService();
