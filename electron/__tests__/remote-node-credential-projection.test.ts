import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RemoteNodeHostStatus, RemoteNodeRecord } from '../../src/shared/remote-node';
import { publicRemoteHostStatus, publicRemoteNodeRecord } from '../../src/shared/remote-node-public';
import { executeRemoteNodeTool as executeMain } from '../wa-executor/handlers/remote-nodes';
import { executeRemoteNodeTool as executeRenderer } from '../../src/services/computer-use/remote-tools';

const service = vi.hoisted(() => ({
  getHostStatus: vi.fn(), updateHostConfig: vi.fn(), listNodes: vi.fn(), registerNode: vi.fn(),
}));
vi.mock('../remote-node-service', () => ({ remoteNodeService: service }));

const host: RemoteNodeHostStatus = {
  success: true, enabled: false, bind_address: '127.0.0.1', port: 9876,
  node_name: 'Host ficticio', advertise_url: null, local_url: 'http://127.0.0.1:9876',
  running: false, token: 'credencial-ficticia-de-prueba', capabilities: [], registered_nodes: 1,
};
const node: RemoteNodeRecord = {
  id: 'nodo-ficticio', name: 'Nodo de prueba', baseUrl: 'https://node.invalid',
  token: 'otra-credencial-ficticia', enabled: false, createdAt: '2026-10-26', updatedAt: '2026-10-26',
};
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe('Credenciales de nodos fuera del contexto del modelo', () => {
  it.each(['', 'credencial-ficticia'])('proyecta sin mutar host ni registro (%s)', token => {
    const originalHost = Object.freeze({ ...host, token });
    const originalNode = Object.freeze({ ...node, token });
    for (const result of [publicRemoteHostStatus(originalHost), publicRemoteNodeRecord(originalNode)]) {
      expect(result).not.toHaveProperty('token');
      expect(result.token_configured).toBe(Boolean(token));
    }
    expect(originalHost.token).toBe(token); expect(originalNode.token).toBe(token);
  });

  const cases = [
    ['get_remote_node_host_status', 'getHostStatus'],
    ['configure_remote_node_host', 'updateHostConfig'],
    ['list_remote_nodes', 'listNodes'],
    ['register_remote_node', 'registerNode'],
  ] as const;
  it.each(cases)('retira el token en main/WhatsApp: %s', async (tool, method) => {
    service.getHostStatus.mockResolvedValue(host); service.updateHostConfig.mockResolvedValue(host);
    service.listNodes.mockResolvedValue([node]); service.registerNode.mockResolvedValue({ success: true, node });
    const response = await executeMain(tool, { name: node.name, base_url: node.baseUrl, token: node.token });
    const data = response?.functionResponse.response;
    expect(service[method]).toHaveBeenCalledOnce();
    expect(data).toBeDefined();
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain(host.token); expect(serialized).not.toContain(node.token);
    expect(serialized).toContain('"token_configured":true');
    expect(host.token).toBe('credencial-ficticia-de-prueba');
  });
  it.each(cases)('retira el token en herramientas renderer: %s', async (tool, method) => {
    const api = {
      getHostStatus: vi.fn().mockResolvedValue(host), updateHostConfig: vi.fn().mockResolvedValue(host),
      listNodes: vi.fn().mockResolvedValue({ success: true, nodes: [node] }),
      registerNode: vi.fn().mockResolvedValue({ success: true, node }),
    };
    vi.stubGlobal('window', { remoteNode: api });
    const data = await executeRenderer(tool, tool === 'configure_remote_node_host' ? { enabled: false } : { name: node.name, base_url: node.baseUrl, token: node.token });
    expect(api[method]).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain(host.token); expect(serialized).not.toContain(node.token);
    expect(serialized).toContain('"token_configured":true');
    expect(await api.getHostStatus()).toBe(host);
    expect((await api.listNodes()).nodes[0]).toBe(node);
  });
  it('conserva errores de la API manual sin inventar registros', async () => {
    vi.stubGlobal('window', { remoteNode: {
      listNodes: vi.fn().mockResolvedValue({ success: false, error: 'Sin conexión' }),
      registerNode: vi.fn().mockResolvedValue({ success: false, error: 'Registro rechazado' }),
    } });
    expect(await executeRenderer('list_remote_nodes', {})).toEqual({ success: false, error: 'Sin conexión' });
    expect(await executeRenderer('register_remote_node', { name: node.name, base_url: node.baseUrl, token: node.token })).toEqual({ success: false, error: 'Registro rechazado' });
  });
});
