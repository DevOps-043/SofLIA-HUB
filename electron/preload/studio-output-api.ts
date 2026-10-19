import type { StudioOutputApi, StudioOutputReceiverApi } from '../../src/shared/studio-program';
import type { PreloadBridge, SafeIpc } from './types';
export function exposeStudioOutputApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: StudioOutputApi = { open: (offer) => ipc.safeInvoke('studio-output:open', offer), close: () => ipc.safeInvoke('studio-output:close'), onState: (callback) => ipc.safeOn('studio-output:event', callback) };
  bridge.exposeInMainWorld('studioOutput', api);
}
export function exposeStudioOutputReceiverApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: StudioOutputReceiverApi = { offer: () => ipc.safeInvoke('studio-output:offer'), answer: (payload) => ipc.safeInvoke('studio-output:answer', payload), state: (payload) => ipc.safeInvoke('studio-output:state', payload) };
  bridge.exposeInMainWorld('studioOutputReceiver', api);
}
