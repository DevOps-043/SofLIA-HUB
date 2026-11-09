import type { NativeFlowApi } from '../../src/shared/native-flow';
import type { PreloadBridge, SafeIpc } from './types';
export function exposeFlowInferenceApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: NativeFlowApi = { generate: request => ipc.safeInvoke('ai:flow-inference', request) };
  bridge.exposeInMainWorld('flowInference', api);
}
