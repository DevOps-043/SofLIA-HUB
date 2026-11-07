import { GEMINI_GROUNDING_API } from './gemini-grounding-config';
import { GROUNDED_RESPONSE_BYTES, jsonObject, type GroundedGenerateInput, type JsonObject } from './grounded-generation';

export class GroundedProviderError extends Error {
  constructor(readonly status?: number) { super('No se pudo completar la investigación con el proveedor.'); }
}
let physicalRequests = 0;
/** Transporte común main/web; sólo acepta endpoint fijo y no refleja errores remotos. */
export async function fetchGroundedContent(input: GroundedGenerateInput, apiKey: string, signal: AbortSignal): Promise<JsonObject> {
  if (physicalRequests >= 4) throw new GroundedProviderError();
  physicalRequests++;
  let response: Response | undefined;
  try {
    if (signal.aborted || !/^[\x21-\x7e]{1,512}$/.test(apiKey)) throw new GroundedProviderError();
    response = await fetch(`${GEMINI_GROUNDING_API.generateContentBaseUrl}/${input.modelName}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(input.body), signal, redirect: 'error',
    });
    if (signal.aborted || response.redirected || !response.ok) throw new GroundedProviderError(response.status);
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > GROUNDED_RESPONSE_BYTES)) throw new GroundedProviderError();
    if (!response.body) throw new GroundedProviderError();
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    let closing: Promise<void> | undefined;
    const close = () => closing ??= reader.cancel().catch(() => undefined);
    const abort = () => { void close(); };
    signal.addEventListener('abort', abort, { once: true });
    let raw: string;
    try {
      while (true) {
        if (signal.aborted) throw new GroundedProviderError();
        const part = await reader.read(); if (signal.aborted) throw new GroundedProviderError();
        if (part.done) break;
        size += part.value.byteLength; if (size > GROUNDED_RESPONSE_BYTES) throw new GroundedProviderError();
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      raw = new TextDecoder().decode(bytes);
    } finally {
      signal.removeEventListener('abort', abort);
      await close();
      reader.releaseLock();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!jsonObject(parsed)) throw new GroundedProviderError();
    return parsed as JsonObject;
  } catch (error) {
    if (error instanceof GroundedProviderError) throw error;
    throw new GroundedProviderError();
  } finally {
    try { await response?.body?.cancel(); } catch { /* No convertir un fallo de cierre en datos del proveedor. */ }
    physicalRequests--;
  }
}
