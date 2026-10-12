import http, { type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { VIEWER_LIMITS } from '../../src/shared/artifact-viewer';
import { isolatedPreviewHtml } from '../../src/shared/artifact-preview-html';

// CSP no gobierna STUN/WebRTC. El preámbulo se ejecuta antes del archivo y cierra
// ambos constructores sin afectar las reuniones del chat ni permitir restaurarlos.
const ISOLATION_BOOTSTRAP = `<script>for(const name of ['RTCPeerConnection','webkitRTCPeerConnection']){let target=globalThis;while(target){if(Object.prototype.hasOwnProperty.call(target,name)){Object.defineProperty(target,name,{value:undefined,writable:false,configurable:false});}target=Object.getPrototypeOf(target);}Object.defineProperty(globalThis,name,{value:undefined,writable:false,configurable:false});}</script>`;

/** Origen independiente para que los scripts locales no hereden la CSP del chat. */
export class ArtifactHtmlServer {
  private server?: Server;
  private starting?: Promise<string>;
  private origin = '';
  private entries = new Map<string, { text: string; token: number; interactive: boolean }>();
  constructor(private readonly guard: (token: number) => Promise<unknown>) {}
  async publish(text: string, token: number, interactive = true): Promise<string> {
    if (!this.starting) {
      const server = http.createServer((request, response) => { void this.respond(request, response); });
      this.server = server;
      this.starting = new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          if (this.server !== server) { server.close(); reject(new Error('Visor cerrado.')); return; }
          const address = server.address();
          if (!address || typeof address === 'string') { reject(new Error('Visor no disponible.')); return; }
          this.origin = 'http://127.0.0.1:' + address.port;
          resolve(this.origin);
        });
      });
    }
    const starting = this.starting;
    const origin = await starting;
    await this.guard(token);
    if (this.starting !== starting) throw new Error('Visor cerrado.');
    const id = randomUUID();
    if (this.entries.size >= VIEWER_LIMITS.tabs) this.entries.delete(this.entries.keys().next().value!);
    // El documento ya está acotado; reservar su envoltura evita truncar texto sin aviso.
    const limit = VIEWER_LIMITS.textChars + (interactive ? 0 : isolatedPreviewHtml('', false).length);
    this.entries.set('/' + id, { text: text.slice(0, limit), token, interactive });
    return origin + '/' + id;
  }
  matches(url: string): boolean { return Boolean(this.origin && url.startsWith(this.origin + '/')); }
  private async respond(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    const entry = this.entries.get(request.url ?? '');
    if (request.method !== 'GET' || request.headers.host !== this.origin.slice(7) || !entry) { response.writeHead(404).end(); return; }
    try {
      await this.guard(entry.token);
      if (this.entries.get(request.url!) !== entry) { response.writeHead(410).end(); return; }
      // El encabezado se aplica antes del contenido y no puede relajarse con HTML del archivo.
      response.setHeader('Content-Security-Policy', 'sandbox' + (entry.interactive ? ' allow-scripts' : '') + "; default-src 'none'; script-src " + (entry.interactive ? "'unsafe-inline'" : "'none'") + "; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' http://localhost:* http://127.0.0.1:* file:");
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), display-capture=()');
      response.writeHead(200).end('<!doctype html><meta charset="utf-8">' + (entry.interactive ? ISOLATION_BOOTSTRAP : '') + entry.text);
    } catch { this.entries.delete(request.url!); response.writeHead(403).end(); }
  }
  clear(): void {
    this.entries.clear(); this.origin = ''; this.starting = undefined;
    this.server?.close(); this.server?.closeAllConnections(); this.server = undefined;
  }
}
