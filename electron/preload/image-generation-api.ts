import type { ImageGenerationApi } from '../../src/shared/image-generation';
import type { PreloadBridge, SafeIpc } from './types';
export function exposeImageGenerationApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: ImageGenerationApi = { generate: prompt => ipc.safeInvoke('ai:image-generation', prompt) };
  bridge.exposeInMainWorld('imageGeneration', api);
}
