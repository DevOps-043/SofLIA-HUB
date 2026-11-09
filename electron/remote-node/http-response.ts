export const REMOTE_NODE_REQUEST_MS = 60_000;
/** La ruta de tareas espera su finalización; admite trabajo superior a un minuto. */
export const REMOTE_NODE_TASK_REQUEST_MS = 15 * 60_000;
export const REMOTE_NODE_RESPONSE_BYTES = 20 * 1024 * 1024;

/** Acota memoria real aunque el proveedor omita o falsee Content-Length. */
export async function remoteResponseText(response: Response, signal: AbortSignal): Promise<string> {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > REMOTE_NODE_RESPONSE_BYTES)) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error('La respuesta del nodo remoto excede el límite permitido.');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const aborted = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', aborted, { once: true });
  try {
    if (signal.aborted) throw new Error('Solicitud remota cancelada.');
    while (true) {
      const part = await reader.read();
      if (signal.aborted) throw new Error('Solicitud remota cancelada.');
      if (part.done) break;
      size += part.value.byteLength;
      if (size > REMOTE_NODE_RESPONSE_BYTES) throw new Error('La respuesta del nodo remoto excede el límite permitido.');
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } finally {
    signal.removeEventListener('abort', aborted);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
