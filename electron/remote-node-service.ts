import { EventEmitter } from 'node:events';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { app } from 'electron';
import type { DesktopAgentService } from './desktop-agent-service';
import { executeToolDirect } from './computer-use-handlers';

type RemoteNodeCapability =
  | 'open_application'
  | 'run_background_command'
  | 'desktop_execute_task'
  | 'process_sessions';

interface RemoteNodeRecord {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastHealthAt?: string | null;
  lastError?: string | null;
  capabilities?: RemoteNodeCapability[];
}

interface RemoteNodeHostConfig {
  enabled: boolean;
  bindAddress: string;
  port: number;
  token: string;
  nodeName: string;
  advertiseUrl?: string | null;
}

interface RemoteNodeState {
  host: RemoteNodeHostConfig;
  nodes: RemoteNodeRecord[];
}

interface RemoteNodeDeps {
  desktopAgent: DesktopAgentService;
}

const DEFAULT_PORT = 47825;
const REMOTE_NODE_CAPABILITIES: RemoteNodeCapability[] = [
  'open_application',
  'run_background_command',
  'desktop_execute_task',
  'process_sessions',
];

function generateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function safeNow(): string {
  return new Date().toISOString();
}

function normalizeBaseUrl(baseUrl: string): string {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function sanitizeNodeId(value: string): string {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return cleaned || `node-${Date.now().toString(36)}`;
}

function buildDefaultState(): RemoteNodeState {
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

export class RemoteNodeService extends EventEmitter {
  private initialized = false;
  private deps: RemoteNodeDeps | null = null;
  private server: http.Server | null = null;
  private state: RemoteNodeState = buildDefaultState();

  private getStatePath(): string {
    try {
      return path.join(app.getPath('userData'), 'remote-node-state.json');
    } catch {
      return path.join(process.cwd(), 'remote-node-state.json');
    }
  }

  async initialize(deps: RemoteNodeDeps): Promise<void> {
    this.deps = deps;
    if (!this.initialized) {
      this.loadState();
      this.initialized = true;
    }
    await this.syncServerState();
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.deps) {
      throw new Error('RemoteNodeService no inicializado.');
    }
  }

  private loadState(): void {
    const statePath = this.getStatePath();
    try {
      if (!fs.existsSync(statePath)) {
        this.saveState();
        return;
      }

      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Partial<RemoteNodeState>;
      const fallback = buildDefaultState();
      this.state = {
        host: {
          enabled: parsed.host?.enabled ?? fallback.host.enabled,
          bindAddress: parsed.host?.bindAddress || fallback.host.bindAddress,
          port: parsed.host?.port || fallback.host.port,
          token: parsed.host?.token || fallback.host.token,
          nodeName: parsed.host?.nodeName || fallback.host.nodeName,
          advertiseUrl: parsed.host?.advertiseUrl || null,
        },
        nodes: Array.isArray(parsed.nodes)
          ? parsed.nodes.map((node) => ({
              ...node,
              id: sanitizeNodeId(node.id || node.name || node.baseUrl),
              baseUrl: normalizeBaseUrl(node.baseUrl),
              enabled: node.enabled !== false,
              createdAt: node.createdAt || safeNow(),
              updatedAt: node.updatedAt || safeNow(),
              capabilities: Array.isArray(node.capabilities) && node.capabilities.length > 0
                ? node.capabilities
                : [...REMOTE_NODE_CAPABILITIES],
            }))
          : [],
      };
    } catch (error) {
      console.error('[RemoteNodeService] No se pudo cargar el estado:', error);
      this.state = buildDefaultState();
      this.saveState();
    }
  }

  private saveState(): void {
    const statePath = this.getStatePath();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  private getListeningUrl(): string {
    const host = this.state.host.bindAddress === '0.0.0.0' ? '127.0.0.1' : this.state.host.bindAddress;
    return `http://${host}:${this.state.host.port}`;
  }

  async getHostStatus(): Promise<any> {
    this.ensureInitialized();
    return {
      success: true,
      enabled: this.state.host.enabled,
      bind_address: this.state.host.bindAddress,
      port: this.state.host.port,
      node_name: this.state.host.nodeName,
      advertise_url: this.state.host.advertiseUrl || null,
      local_url: this.getListeningUrl(),
      running: !!this.server?.listening,
      token: this.state.host.token,
      capabilities: [...REMOTE_NODE_CAPABILITIES],
      registered_nodes: this.state.nodes.length,
    };
  }

  async updateHostConfig(updates: Partial<{
    enabled: boolean;
    bind_address: string;
    port: number;
    node_name: string;
    advertise_url: string | null;
    rotate_token: boolean;
  }>): Promise<any> {
    this.ensureInitialized();

    if (typeof updates.enabled === 'boolean') {
      this.state.host.enabled = updates.enabled;
    }
    if (typeof updates.bind_address === 'string' && updates.bind_address.trim()) {
      this.state.host.bindAddress = updates.bind_address.trim();
    }
    if (typeof updates.port === 'number' && Number.isFinite(updates.port) && updates.port > 0 && updates.port < 65536) {
      this.state.host.port = Math.round(updates.port);
    }
    if (typeof updates.node_name === 'string' && updates.node_name.trim()) {
      this.state.host.nodeName = updates.node_name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'advertise_url')) {
      this.state.host.advertiseUrl = updates.advertise_url ? normalizeBaseUrl(updates.advertise_url) : null;
    }
    if (updates.rotate_token) {
      this.state.host.token = generateToken();
    }

    this.saveState();
    await this.syncServerState();
    return this.getHostStatus();
  }

  async listNodes(): Promise<any[]> {
    this.ensureInitialized();
    return this.state.nodes
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((node) => ({ ...node }));
  }

  async registerNode(input: {
    id?: string;
    name: string;
    base_url: string;
    token: string;
    enabled?: boolean;
  }): Promise<any> {
    this.ensureInitialized();
    const baseUrl = normalizeBaseUrl(input.base_url);
    if (!baseUrl) {
      throw new Error('base_url es obligatorio.');
    }
    if (!input.token?.trim()) {
      throw new Error('token es obligatorio.');
    }

    const id = sanitizeNodeId(input.id || input.name || baseUrl);
    const now = safeNow();
    const existingIndex = this.state.nodes.findIndex((node) => node.id === id);
    const next: RemoteNodeRecord = {
      id,
      name: input.name?.trim() || id,
      baseUrl,
      token: input.token.trim(),
      enabled: input.enabled !== false,
      createdAt: existingIndex >= 0 ? this.state.nodes[existingIndex].createdAt : now,
      updatedAt: now,
      lastHealthAt: existingIndex >= 0 ? this.state.nodes[existingIndex].lastHealthAt || null : null,
      lastError: existingIndex >= 0 ? this.state.nodes[existingIndex].lastError || null : null,
      capabilities: existingIndex >= 0 && this.state.nodes[existingIndex].capabilities?.length
        ? this.state.nodes[existingIndex].capabilities
        : [...REMOTE_NODE_CAPABILITIES],
    };

    if (existingIndex >= 0) this.state.nodes[existingIndex] = next;
    else this.state.nodes.push(next);

    this.saveState();
    return { success: true, node: next };
  }

  async removeNode(nodeId: string): Promise<any> {
    this.ensureInitialized();
    const initialLength = this.state.nodes.length;
    this.state.nodes = this.state.nodes.filter((node) => node.id !== nodeId);
    this.saveState();
    return {
      success: true,
      removed: initialLength !== this.state.nodes.length,
      node_id: nodeId,
    };
  }

  async testNode(nodeId: string): Promise<any> {
    const result = await this.requestNode(nodeId, 'GET', '/health');
    return {
      success: true,
      node_id: nodeId,
      health: result,
    };
  }

  async openApplicationOnNode(nodeId: string, args: Record<string, any>): Promise<any> {
    return this.requestNode(nodeId, 'POST', '/v1/open-application', { path: args.path });
  }

  async runBackgroundCommandOnNode(nodeId: string, args: Record<string, any>): Promise<any> {
    return this.requestNode(nodeId, 'POST', '/v1/run-background-command', {
      command: args.command,
      working_directory: args.working_directory,
      title: args.title,
    });
  }

  async executeDesktopTaskOnNode(nodeId: string, args: Record<string, any>): Promise<any> {
    return this.requestNode(nodeId, 'POST', '/v1/desktop/execute-task', {
      task: args.task,
      max_steps: args.max_steps,
      backend: args.backend,
      start_url: args.start_url,
      browser_profile: args.browser_profile,
      browser_isolated: args.browser_isolated,
      reset_browser_profile: args.reset_browser_profile,
    });
  }

  async listProcessSessionsOnNode(nodeId: string): Promise<any> {
    return this.requestNode(nodeId, 'GET', '/v1/process-sessions');
  }

  async pollProcessSessionOnNode(nodeId: string, sessionId: string): Promise<any> {
    return this.requestNode(nodeId, 'GET', `/v1/process-sessions/${encodeURIComponent(sessionId)}`);
  }

  async killProcessSessionOnNode(nodeId: string, sessionId: string): Promise<any> {
    return this.requestNode(nodeId, 'DELETE', `/v1/process-sessions/${encodeURIComponent(sessionId)}`);
  }

  private getNodeOrThrow(nodeId: string): RemoteNodeRecord {
    this.ensureInitialized();
    const node = this.state.nodes.find((candidate) => candidate.id === nodeId && candidate.enabled !== false);
    if (!node) {
      throw new Error(`No existe un nodo remoto activo con id "${nodeId}".`);
    }
    return node;
  }

  private async requestNode(nodeId: string, method: string, routePath: string, body?: Record<string, any>): Promise<any> {
    const node = this.getNodeOrThrow(nodeId);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${node.token}`,
    };

    let payload: string | undefined;
    if (body && method !== 'GET') {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(`${node.baseUrl}${routePath}`, {
        method,
        headers,
        body: payload,
      });
    } catch (error: any) {
      node.lastError = error.message || 'No se pudo contactar el nodo remoto.';
      node.updatedAt = safeNow();
      this.saveState();
      throw error;
    }

    const text = await response.text();
    let parsed: any = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { success: response.ok, raw: text };
    }

    node.updatedAt = safeNow();
    if (response.ok) {
      node.lastHealthAt = safeNow();
      node.lastError = null;
      if (Array.isArray(parsed?.capabilities)) {
        node.capabilities = parsed.capabilities;
      } else if (Array.isArray(parsed?.health?.capabilities)) {
        node.capabilities = parsed.health.capabilities;
      }
    } else {
      node.lastError = parsed?.error || `HTTP ${response.status}`;
    }
    this.saveState();

    if (!response.ok) {
      throw new Error(parsed?.error || `El nodo remoto devolvio HTTP ${response.status}.`);
    }

    return parsed;
  }

  private async syncServerState(): Promise<void> {
    if (this.state.host.enabled) {
      await this.startServer();
      return;
    }
    await this.stopServer();
  }

  private async startServer(): Promise<void> {
    if (this.server?.listening) {
      const address = this.server.address();
      if (address && typeof address === 'object' && address.port === this.state.host.port) {
        return;
      }
      await this.stopServer();
    }

    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.state.host.port, this.state.host.bindAddress, () => {
        this.server!.off('error', reject);
        resolve();
      });
    });
  }

  private async stopServer(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (!this.isAuthorized(req)) {
        this.sendJson(res, 401, { success: false, error: 'Token de nodo remoto invalido.' });
        return;
      }

      const requestUrl = new URL(req.url || '/', this.getListeningUrl());
      const method = req.method || 'GET';

      if (method === 'GET' && requestUrl.pathname === '/health') {
        this.sendJson(res, 200, {
          success: true,
          node_name: this.state.host.nodeName,
          local_url: this.getListeningUrl(),
          advertise_url: this.state.host.advertiseUrl || null,
          capabilities: [...REMOTE_NODE_CAPABILITIES],
        });
        return;
      }

      if (method === 'POST' && requestUrl.pathname === '/v1/open-application') {
        const body = await this.readJsonBody(req);
        const result = await executeToolDirect('open_application', { path: body.path });
        this.sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && requestUrl.pathname === '/v1/run-background-command') {
        const body = await this.readJsonBody(req);
        const result = await executeToolDirect('run_background_command', {
          command: body.command,
          working_directory: body.working_directory,
          title: body.title,
        });
        this.sendJson(res, 200, result);
        return;
      }

      if (method === 'POST' && requestUrl.pathname === '/v1/desktop/execute-task') {
        if (!this.deps?.desktopAgent) {
          this.sendJson(res, 503, { success: false, error: 'Desktop Agent no disponible en este nodo.' });
          return;
        }
        const body = await this.readJsonBody(req);
        const message = await this.deps.desktopAgent.executeTask(String(body.task || ''), {
          maxSteps: body.max_steps,
          backend: body.backend,
          startUrl: body.start_url,
          browserProfile: body.browser_profile,
          browserIsolated: body.browser_isolated,
          resetBrowserProfile: body.reset_browser_profile,
        });
        this.sendJson(res, 200, {
          success: true,
          message,
          status: this.deps.desktopAgent.getStatus(),
        });
        return;
      }

      if (method === 'GET' && requestUrl.pathname === '/v1/process-sessions') {
        const result = await executeToolDirect('list_process_sessions', {});
        this.sendJson(res, 200, result);
        return;
      }

      const sessionMatch = requestUrl.pathname.match(/^\/v1\/process-sessions\/([^/]+)$/);
      if (sessionMatch && method === 'GET') {
        const sessionId = decodeURIComponent(sessionMatch[1]);
        const result = await executeToolDirect('poll_process_session', { session_id: sessionId });
        this.sendJson(res, 200, result);
        return;
      }

      if (sessionMatch && method === 'DELETE') {
        const sessionId = decodeURIComponent(sessionMatch[1]);
        const result = await executeToolDirect('kill_process_session', { session_id: sessionId });
        this.sendJson(res, 200, result);
        return;
      }

      this.sendJson(res, 404, { success: false, error: 'Ruta remota no soportada.' });
    } catch (error: any) {
      this.sendJson(res, 500, { success: false, error: error.message || 'Error interno del nodo remoto.' });
    }
  }

  private isAuthorized(req: IncomingMessage): boolean {
    const authHeader = String(req.headers.authorization || '').trim();
    const tokenHeader = String(req.headers['x-soflia-node-token'] || '').trim();
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : tokenHeader;
    return !!token && token === this.state.host.token;
  }

  private async readJsonBody(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString('utf-8').trim();
    return text ? JSON.parse(text) : {};
  }

  private sendJson(res: ServerResponse, statusCode: number, payload: any): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  }
}

export const remoteNodeService = new RemoteNodeService();
