import { REMOTE_NODE_CAPABILITIES } from './constants';
import type { RemoteNodeServer, RemoteNodeState } from './types';

export function buildHostStatus(
  state: RemoteNodeState,
  server: RemoteNodeServer,
  getListeningUrl: () => string,
): any {
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
  };
}
