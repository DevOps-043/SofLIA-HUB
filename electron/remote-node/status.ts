import { REMOTE_NODE_CAPABILITIES } from './constants';
import type { RemoteNodeServer, RemoteNodeState } from './types';
import type { RemoteNodeHostStatus } from '../../src/shared/remote-node';

export function buildHostStatus(
  state: RemoteNodeState,
  server: RemoteNodeServer,
  getListeningUrl: () => string,
): RemoteNodeHostStatus {
  return {
    success: true,
    enabled: state.host.enabled,
    bind_address: state.host.bindAddress,
    port: state.host.port,
    node_name: state.host.nodeName,
    advertise_url: state.host.advertiseUrl || null,
    local_url: getListeningUrl(),
    running: !!server?.listening,
    token: state.host.token,
    capabilities: [...REMOTE_NODE_CAPABILITIES],
    registered_nodes: state.nodes.length,
    ...(state.migration && (state.migration.hostPending || state.migration.pendingNodes > 0) ? {
      legacy_pending_nodes: state.migration.pendingNodes,
      migration_notice: 'La configuración anterior está preservada cifrada. No se importaron el host anterior ni los nodos sin propietario válido: vuelve a emparejar los equipos que sigas usando.',
    } : {}),
  };
}
