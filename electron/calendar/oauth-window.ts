import { BrowserWindow } from 'electron';
import http from 'node:http';
import { URL } from 'node:url';
import { OAUTH_REDIRECT_PORT } from './constants';

export function openOAuthWindow(authUrl: string, title: string): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let server: http.Server | null = null;

    server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost:${OAUTH_REDIRECT_PORT}`);
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
      width: 600,
      height: 700,
      title: `Conectar ${title}`,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    authWin.loadURL(authUrl);
    authWin.on('closed', () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
        server?.close();
      }
    });
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
