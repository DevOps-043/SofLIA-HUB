import type { NativeFlowApi, NativeFlowRequest } from '../../shared/native-flow';
declare global { interface Window { flowInference?: NativeFlowApi } }
export class NativeFlowRevokedError extends Error {}
/** undefined indica navegador autónomo; Electron sin puente falla cerrado. */
export async function generateNativeFlow(request: NativeFlowRequest): Promise<string> {
  if (window.flowInference) {
    const result = await window.flowInference.generate(request);
    if (!result.success) { if (result.code === 'revoked') throw new NativeFlowRevokedError(result.error); throw new Error(result.error); }
    return result.text;
  }
  if ('ipcRenderer' in window) throw new Error('Flow nativo no está disponible.');
  throw new Error('Flow requiere la aplicación de escritorio.');
}
