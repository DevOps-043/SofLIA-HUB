import type { GroundedGenerationApi } from '../../src/shared/grounded-generation';
import type { PreloadBridge, SafeIpc } from './types';

export function exposeGroundingApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: GroundedGenerationApi = {
    generate: input => ipc.safeInvoke('ai:generate-grounded', input),
    cancel: id => ipc.safeInvoke('ai:cancel-grounded', id),
  };
  bridge.exposeInMainWorld('aiGrounding', api);
}
