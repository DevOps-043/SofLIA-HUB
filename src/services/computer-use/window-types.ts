import type { ComputerUseApi } from '../../shared/computer-use';
import type { DesktopAgentApi } from '../../shared/desktop-agent';
import type { RemoteNodeApi } from '../../shared/remote-node';

declare global {
  interface Window {
    computerUse?: ComputerUseApi;
    desktopAgent?: DesktopAgentApi;
    remoteNode?: RemoteNodeApi;
  }
}

export {};
