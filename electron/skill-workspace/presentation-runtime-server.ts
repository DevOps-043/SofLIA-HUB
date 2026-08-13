import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { formatDeckValidationError, parsePresentationDeck } from '../../src/shared/presentations/deck-schema';
import type { SkillWorkspaceService } from './service';

type RuntimeOptions = { rendererDist: string; devServerUrl?: string };

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const CSP = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*", "object-src 'none'", "base-uri 'none'"].join('; ');

/** Servidor loopback del reproductor React; nunca publica rutas absolutas. */
export class PresentationRuntimeServer {
  private server: http.Server | null = null;
  private origin: string | null = null;
  private starting: Promise<string> | null = null;
  private readonly tokensByWorkspace = new Map<string, string>();
  private readonly workspacesByToken = new Map<string, string>();

  constructor(private readonly service: SkillWorkspaceService, private readonly options: RuntimeOptions) {}

  async getUrl(workspaceId: string): Promise<string> {
    const workspace = await this.service.getWorkspace(workspaceId);
    if (!workspace || workspace.skillId !== 'sistema:presentaciones') throw new Error('La presentacion no existe o ya se cerro.');
    const deckPath = await this.service.resolveAbsolutePath(workspaceId, 'deck.json');
    if (!deckPath) throw new Error('La presentacion todavia no esta lista: falta deck.json.');
    try { parsePresentationDeck(JSON.parse(await fs.readFile(deckPath, 'utf8'))); }
    catch (error) {
      throw Object.assign(
        new Error(`deck.json no cumple el contrato de presentacion:\n${formatDeckValidationError(error)}`),
        { cause: error },
      );
    }
    const origin = await this.start();
    let token = this.tokensByWorkspace.get(workspaceId);
    if (!token) {
      token = randomUUID();
      this.tokensByWorkspace.set(workspaceId, token);
      this.workspacesByToken.set(token, workspaceId);
    }
    return `${origin}/presentacion/${token}/`;
  }

  async start(): Promise<string> {
    if (this.origin) return this.origin;
    if (this.starting) return this.starting;
    this.starting = new Promise<string>((resolve, reject) => {
      const server = http.createServer((request, response) => { void this.handle(request, response); });
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') return reject(new Error('No pude asignar un puerto local al reproductor.'));
        this.server = server;
        this.origin = `http://127.0.0.1:${address.port}`;
        resolve(this.origin);
      });
    }).finally(() => { this.starting = null; });
    return this.starting;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.origin = null;
    this.tokensByWorkspace.clear();
    this.workspacesByToken.clear();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') return this.send(response, 405, 'Metodo no permitido');
      const url = new URL(request.url ?? '/', this.origin ?? 'http://127.0.0.1');
      if (url.pathname.startsWith('/assets/')) return this.serveRendererFile(url.pathname.slice(1), response);
      if (url.pathname === '/favicon.ico') return this.serveRendererFile('assets/icono.ico', response);
      const match = url.pathname.match(/^\/presentacion\/([a-f0-9-]+)\/(.*)$/i);
      if (!match) return this.send(response, 404, 'No encontrado');
      const workspaceId = this.workspacesByToken.get(match[1]);
      if (!workspaceId) return this.send(response, 404, 'Sesion no encontrada');
      const relative = decodeURIComponent(match[2] || '');
      if (!relative) {
        if (this.options.devServerUrl) {
          const target = new URL(this.options.devServerUrl);
          target.searchParams.set('view', 'presentation');
          target.searchParams.set('deck', `${this.origin}${url.pathname}deck.json`);
          target.searchParams.set('assets', `${this.origin}${url.pathname}assets/`);
          target.searchParams.set('brand', `${this.origin}${url.pathname}estilos/marca.css`);
          response.writeHead(302, { Location: target.toString(), 'Cache-Control': 'no-store' });
          response.end();
          return;
        }
        return this.serveRendererFile('index.html', response);
      }
      if (!isAllowedWorkspaceResource(relative)) return this.send(response, 404, 'No encontrado');
      const absolute = await this.service.resolveAbsolutePath(workspaceId, relative);
      if (!absolute) return this.send(response, 404, 'No encontrado');
      return this.serveAbsolute(absolute, response);
    } catch (error) {
      return this.send(response, 500, error instanceof Error ? error.message : 'Fallo del reproductor.');
    }
  }

  private async serveRendererFile(relative: string, response: ServerResponse) {
    const root = path.resolve(this.options.rendererDist);
    const absolute = path.resolve(root, relative);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return this.send(response, 404, 'No encontrado');
    return this.serveAbsolute(absolute, response);
  }

  private async serveAbsolute(absolute: string, response: ServerResponse) {
    try {
      const body = await fs.readFile(absolute);
      response.writeHead(200, { 'Content-Type': MIME[path.extname(absolute).toLowerCase()] ?? 'application/octet-stream', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      response.end(body);
    } catch { this.send(response, 404, 'No encontrado'); }
  }

  private send(response: ServerResponse, status: number, body: string) {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(body);
  }
}

function isAllowedWorkspaceResource(relative: string): boolean {
  const normalized = relative.replace(/\\/g, '/');
  return normalized === 'deck.json' || normalized === 'estilos/marca.css'
    || (/^assets\/[a-z0-9][a-z0-9._/-]*$/i.test(normalized) && !normalized.split('/').includes('..'));
}

export const PRESENTATION_RUNTIME_CSP = CSP;


