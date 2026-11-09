import type { OpenAIRuntimeApi } from '../../src/shared/openai-runtime';
import type { PreloadBridge, SafeIpc } from './types';

export function exposeOpenAIRuntime(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: OpenAIRuntimeApi = {
    open: () => ipc.safeInvoke('ai:openai-open'),
    start: (scopeId, requestId, body, retries) => ipc.safeInvoke('ai:openai-start', scopeId, requestId, body, retries),
    pull: (scopeId, requestId, cursor) => ipc.safeInvoke('ai:openai-pull', scopeId, requestId, cursor),
    cancel: (scopeId, requestId) => ipc.safeInvoke('ai:openai-cancel', scopeId, requestId),
  };
  bridge.exposeInMainWorld('openaiRuntime', api);
}
