import type { BackgroundTeamsBridge } from '../../src/shared/background-teams';
import type { PreloadBridge, SafeIpc } from './types';
export function exposeBackgroundTeamsApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: BackgroundTeamsBridge = {
    context: input => ipc.safeInvoke('background-teams:context', input),
    release: () => ipc.safeInvoke('background-teams:release'),
    state: () => ipc.safeInvoke('background-teams:state'),
    start: input => ipc.safeInvoke('background-teams:start', input),
    control: input => ipc.safeInvoke('background-teams:control', input),
    open: input => ipc.safeInvoke('background-teams:open', input),
    attachLegacy: input => ipc.safeInvoke('background-teams:attach-legacy', input),
    onChanged: listener => ipc.safeOn('background-teams:changed', listener),
  };
  bridge.exposeInMainWorld('backgroundTeams', api);
}

