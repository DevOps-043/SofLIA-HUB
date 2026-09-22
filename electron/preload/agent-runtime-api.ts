import type { AgentRuntimeBridge } from '../../src/shared/agent-runtime';
import type { PreloadBridge, SafeIpc } from './types';
export function exposeAgentRuntimeApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: AgentRuntimeBridge = {
    releaseContext: () => ipc.safeInvoke('agent-runtime:release'),
    setContext: input => ipc.safeInvoke('agent-runtime:context', input),
    getState: () => ipc.safeInvoke('agent-runtime:state'),
    start: input => ipc.safeInvoke('agent-runtime:start', input),
    cancel: input => ipc.safeInvoke('agent-runtime:cancel', input),
    recover: input => ipc.safeInvoke('agent-runtime:recover', input),
    publish: input => ipc.safeInvoke('agent-runtime:publish', input),
    configureCodex: () => ipc.safeInvoke('agent-runtime:configure-codex'),
    setCodexKey: input => ipc.safeInvoke('agent-runtime:codex-key', input),
    onChanged: callback => ipc.safeOn('agent-runtime:changed', callback),
  };
  bridge.exposeInMainWorld('agentRuntime', api);
}
