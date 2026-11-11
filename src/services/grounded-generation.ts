import { GROUNDED_RESPONSE_BYTES, jsonObject, type GroundedGenerateInput, type GroundedGenerationApi } from '../shared/grounded-generation';
declare global { interface Window { aiGrounding?: GroundedGenerationApi } }
export class GroundingBridgeError extends Error {
  constructor() { super('No se pudo autorizar o completar la investigación desde la aplicación.'); }
}

function groundingRuntime() {
  return typeof window === 'undefined' ? undefined : window as Window & {
    ipcRenderer?: { invoke?: (channel: string, ...args: unknown[]) => Promise<unknown> };
    appRuntime?: unknown;
  };
}

export function hasNativeGroundingRuntime(): boolean {
  const native = groundingRuntime();
  return Boolean(native?.aiGrounding || native?.ipcRenderer || native?.appRuntime);
}

/** null sólo indica navegador independiente; un puente Electron roto falla cerrado. */
export async function requestNativeGrounding(input: GroundedGenerateInput, signal: AbortSignal): Promise<Record<string, unknown> | null> {
  if (!hasNativeGroundingRuntime()) return null;
  const native = groundingRuntime();
  const api = native?.aiGrounding;
  const invoke = native?.ipcRenderer?.invoke;
  if (signal.aborted) throw new DOMException('Investigación cancelada.', 'AbortError');
  if (!api?.generate && !invoke) throw new GroundingBridgeError();
  if (api && (typeof api.generate !== 'function' || typeof api.cancel !== 'function')) throw new GroundingBridgeError();
  const requestId = crypto.randomUUID();
  const abort = () => { void Promise.resolve().then(() => api?.cancel ? api.cancel(requestId) : invoke?.('ai:cancel-grounded', requestId)).catch(() => undefined); };
  let rejectAbort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => { rejectAbort = () => { abort(); reject(new DOMException('Investigación cancelada.', 'AbortError')); }; });
  signal.addEventListener('abort', rejectAbort, { once: true });
  try {
    const request = { modelName: input.modelName, body: input.body, requestId };
    const pending = api?.generate ? api.generate(request) : invoke!('ai:generate-grounded', request);
    const result: unknown = await Promise.race([pending, cancelled]);
    if (signal.aborted) throw new DOMException('Investigación cancelada.', 'AbortError');
    if (!jsonObject(result) || typeof result.success !== 'boolean') throw new GroundingBridgeError();
    if (result.success) {
      if (!jsonObject(result.payload) || new TextEncoder().encode(JSON.stringify(result.payload)).byteLength > GROUNDED_RESPONSE_BYTES) throw new GroundingBridgeError();
      return result.payload;
    }
    if (result.code === 'PROVIDER_FAILED') throw new Error('El proveedor no completó la investigación.');
    if (result.code === 'CANCELLED') throw new DOMException('Investigación cancelada.', 'AbortError');
    throw new GroundingBridgeError();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' || error instanceof GroundingBridgeError) throw error;
    if (error instanceof Error && error.message === 'El proveedor no completó la investigación.') throw error;
    throw new GroundingBridgeError();
  } finally { signal.removeEventListener('abort', rejectAbort); }
}
