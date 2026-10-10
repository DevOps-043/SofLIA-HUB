import type { AgentActivityBridge } from '../../src/shared/agent-activity';
import type { PreloadBridge, SafeIpc } from './types';
export function exposeAgentActivityApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: AgentActivityBridge = {
    snapshot: () => ipc.safeInvoke('agent-activity:snapshot'),
    publish: value => ipc.safeInvoke('agent-activity:publish', value),
    onChanged: callback => ipc.safeOn('agent-activity:changed', callback),
  };
  bridge.exposeInMainWorld('agentActivity', api);
}
