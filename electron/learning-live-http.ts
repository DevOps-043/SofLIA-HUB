/** Solo rutas del contrato académico; jamás un origen recibido por IPC. */
export function learningLiveEndpoint(base: string, action: 'access' | 'workspace' | 'catalog'): string | null {
  try {
    const url = new URL(base);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return null;
    return new URL(`/api/auth/live/${action}`, url).toString();
  } catch { return null; }
}

export async function readLearningResponse(response: Response, limit: number): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Respuesta sin cuerpo');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      const value = chunk.value;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new Error('Respuesta fuera de límites'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
