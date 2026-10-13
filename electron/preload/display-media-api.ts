import type { PreloadBridge, SafeIpc } from './types';
import type { DisplayMediaPickerApi } from '../../src/shared/display-media';
export function exposeDisplayMediaPickerApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: DisplayMediaPickerApi = {
    list: () => ipc.safeInvoke('display-media:list'),
    select: (input) => ipc.safeInvoke('display-media:select', input),
    cancel: () => ipc.safeInvoke('display-media:cancel'),
  };
  bridge.exposeInMainWorld('displayMediaPicker', api);
}
