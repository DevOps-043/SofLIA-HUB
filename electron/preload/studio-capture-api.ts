import type { StudioCaptureApi } from '../../src/shared/studio-capture';
import type { PreloadBridge, SafeIpc } from './types';
export function exposeStudioCaptureApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: StudioCaptureApi = {
    choose: () => ipc.safeInvoke('studio-capture:choose'),
    activate: (input) => ipc.safeInvoke('studio-capture:activate', input),
    release: (input) => ipc.safeInvoke('studio-capture:release', input),
    clear: () => ipc.safeInvoke('studio-capture:clear'),
  };
  bridge.exposeInMainWorld('studioCapture', api);
}
