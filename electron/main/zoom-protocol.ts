import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CustomScheme, Session } from 'electron';

export const ZOOM_RUNTIME_SCHEME: CustomScheme = { scheme: 'soflia-zoom', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } };
export const ZOOM_FRAME_URL = 'soflia-zoom://meeting/index.html';
export function zoomRuntimePath(root: string, value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'soflia-zoom:' || url.hostname !== 'meeting' || url.username || url.password || url.port || url.search) return null;
    const pathname = decodeURIComponent(url.pathname);
    if (pathname !== '/index.html' && !/^\/assets\/[a-zA-Z0-9_.-]+\.(?:js|css|wasm)$/.test(pathname)) return null;
    const resolved = path.resolve(root, `.${pathname}`);
    if (!path.relative(root, resolved).startsWith('..')) return resolved;
  } catch { /* Petición no válida; no se interpreta como ruta del sistema. */ }
  return null;
}
export async function installZoomProtocol(target: Session, runtimeRoot: string) {
  if (await target.protocol.isProtocolHandled('soflia-zoom')) return;
  target.protocol.handle('soflia-zoom', async (request) => {
    const file = request.method === 'GET' ? zoomRuntimePath(runtimeRoot, request.url) : null;
    if (!file) return new Response('Recurso no disponible', { status: 404 });
    try {
      const content = await readFile(file);
      const mime = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript';
      return new Response(content, { headers: { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self' blob: https://source.zoom.us 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.zoom.us https://*.zoom.com; connect-src 'self' https://*.zoom.us https://*.zoom.com https://*.zoomcdn.net wss://*.zoom.us wss://*.zoom.com; media-src 'self' blob:; worker-src 'self' blob: https://source.zoom.us; font-src 'self' data:; frame-src 'self' https://*.zoom.us" } });
    } catch { return new Response('No se pudo cargar Meeting SDK', { status: 503 }); }
  });
}
