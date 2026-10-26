import { BrowserWindow } from 'electron';
import http from 'node:http';
import { URL } from 'node:url';
import { OAUTH_REDIRECT_PORT } from './constants';

export function openOAuthWindow(authUrl: string, title: string, options: { state?: string; signal?: AbortSignal; parent?: BrowserWindow } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let server: http.Server | null = null;

    server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost:${OAUTH_REDIRECT_PORT}`);
      if (options.state && (url.pathname !== '/callback' || url.searchParams.get('state') !== options.state || options.signal?.aborted)) {
        res.writeHead(400); res.end('La autorización no corresponde a esta solicitud.'); return;
      }
      const code = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html><body style="font-family:system-ui;text-align:center;padding:60px;background:#1a1a2e;color:white">
          <h2>${code ? 'Conectado exitosamente' : 'Error de conexion'}</h2>
          <p>${code ? 'Puedes cerrar esta ventana.' : 'No se pudo obtener autorizacion.'}</p>
          <script>setTimeout(() => window.close(), 2000)</script>
        </body></html>
      `);
      if (!resolved) {
        resolved = true;
        resolve(code || null);
      }
      setTimeout(() => {
        server?.close();
        authWin?.close();
      }, 1000);
    });

    server.listen(OAUTH_REDIRECT_PORT, '127.0.0.1');
    const authWin = new BrowserWindow({
      ...(options.parent ? { parent: options.parent, modal: true } : {}),
      width: 600,
      height: 700,
      title: `Conectar ${title}`,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    authWin.loadURL(authUrl);
    const abort = () => { if (!authWin.isDestroyed()) authWin.close(); };
    options.signal?.addEventListener('abort', abort, { once: true });
    authWin.on('closed', () => {
      options.signal?.removeEventListener('abort', abort);
      if (!resolved) {
        resolved = true;
        resolve(null);
        server?.close();
      }
    });
    server.on('error', () => { if (!resolved) { resolved = true; resolve(null); } abort(); });
    if (options.signal?.aborted) abort();
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
        server?.close();
        authWin?.close();
      }
    }, 300000);
  });
}
