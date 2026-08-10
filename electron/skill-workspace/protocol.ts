import { protocol, session, type Protocol } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SkillWorkspaceService } from './service';

/**
 * Protocolo local que sirve los archivos de una presentacion generada.
 *
 * Es la unica forma en que el HTML escrito por el modelo llega al `iframe` y
 * a la vista a pantalla completa. Sirve EXCLUSIVAMENTE archivos del
 * workspace indicado, reutilizando la validacion de contencion del servicio
 * (`resolveAbsolutePath`) en vez de una propia: dos validaciones distintas
 * acabarian divergiendo.
 *
 * Forma de la URL: `pulse-presentacion://<workspaceId>/<ruta-relativa>`.
 */

export const PRESENTATION_SCHEME = 'pulse-presentacion';

/**
 * Particion de la vista a pantalla completa. Vive aqui, junto al registro del
 * handler, para que no pueda cambiarse en un sitio y olvidarse en el otro:
 * si la vista usara otra particion, su sesion se quedaria sin protocolo.
 */
export const PRESENTATION_PARTITION = 'persist:pulse-presentacion';

/**
 * CSP del documento servido. `script-src 'unsafe-inline'` es deliberado: la
 * navegacion entre diapositivas va en linea en el propio HTML, y el
 * documento vive en un origen opaco sin acceso a IPC, `node` ni red
 * (`connect-src 'none'`), de modo que el script no puede exfiltrar nada.
 */
const CSP = [
  // Se usan fuentes por ESQUEMA, no `'self'`. La vista previa se embebe en un
  // `iframe` con sandbox sin `allow-same-origin`, asi que el documento tiene
  // origen opaco y ahi `'self'` no coincide con nada: su propio CSS quedaria
  // bloqueado y la presentacion se veria sin estilos. El esquema propio si
  // coincide, y sigue sin permitir ningun origen remoto.
  "default-src 'none'",
  `script-src ${PRESENTATION_SCHEME}: 'unsafe-inline'`,
  `style-src ${PRESENTATION_SCHEME}: 'unsafe-inline'`,
  `img-src ${PRESENTATION_SCHEME}: data:`,
  `font-src ${PRESENTATION_SCHEME}: data:`,
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  // El guion base de la baraja lo escribe el sistema y dispara las entradas
  // al llegar cada diapositiva. Sin este tipo, el visor devolvia 404 y la
  // presentacion se veia estatica.
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

/**
 * Debe llamarse ANTES de `app.whenReady()`. Registrar el esquema como
 * privilegiado le da un origen propio y le permite usar fetch de recursos
 * relativos; sin esto el CSS y las imagenes no cargarian.
 */
export function registerPresentationScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PRESENTATION_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: false,
        corsEnabled: false,
        stream: false,
      },
    },
  ]);
}

/** Construye la URL de vista previa de un archivo del workspace. */
export function buildPresentationUrl(workspaceId: string, relativePath: string): string {
  const clean = String(relativePath ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${PRESENTATION_SCHEME}://${encodeURIComponent(workspaceId)}/${clean}`;
}

/**
 * Traduce una URL del protocolo a workspace y ruta relativa. Devuelve null
 * cuando la URL no tiene la forma esperada.
 */
export function parsePresentationUrl(rawUrl: string): { workspaceId: string; relativePath: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${PRESENTATION_SCHEME}:`) return null;

  const workspaceId = decodeURIComponent(url.hostname || '');
  if (!workspaceId) return null;

  const relativePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  return { workspaceId, relativePath: relativePath || 'index.html' };
}

/**
 * Resuelve una peticion del protocolo. Aislado de `protocol.handle` para
 * poder probarlo sin levantar Electron.
 */
export async function resolvePresentationRequest(
  service: Pick<SkillWorkspaceService, 'resolveAbsolutePath'>,
  rawUrl: string,
): Promise<{ status: 200; body: Buffer; headers: Record<string, string> } | { status: 404 }> {
  const parsed = parsePresentationUrl(rawUrl);
  if (!parsed) return { status: 404 };

  // La contencion la aplica el servicio: cualquier intento de salir del
  // workspace, incluidos enlaces simbolicos, devuelve null aqui.
  const absolutePath = await service.resolveAbsolutePath(parsed.workspaceId, parsed.relativePath);
  if (!absolutePath) return { status: 404 };

  const extension = path.extname(absolutePath).toLowerCase();
  const mime = MIME_TYPES[extension];
  // Solo se sirven tipos conocidos: un archivo con extension inesperada no
  // debe entregarse con un tipo adivinado.
  if (!mime) return { status: 404 };

  try {
    const body = await fs.readFile(absolutePath);
    return {
      status: 200,
      body,
      headers: {
        'Content-Type': mime,
        'Content-Security-Policy': CSP,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    };
  } catch {
    return { status: 404 };
  }
}

/**
 * Debe llamarse DESPUES de `app.whenReady()`.
 *
 * Registra el handler en la sesion por defecto —la del renderer, que carga la
 * vista previa en el `iframe`— Y en la particion propia de la vista a
 * pantalla completa.
 *
 * El registro por sesion es obligatorio: `protocol.handle` del modulo solo
 * afecta a la sesion por defecto. Una `WebContentsView` con `partition`
 * propia queda sin handler, Electron no reconoce el esquema y lo entrega al
 * sistema operativo, que responde con "obten una aplicacion para abrir este
 * vinculo" y deja la ventana en blanco.
 */
export function registerPresentationProtocolHandler(service: SkillWorkspaceService): void {
  const handler = async (request: { url: string }): Promise<Response> => {
    const result = await resolvePresentationRequest(service, request.url);
    if (result.status === 404) {
      return new Response('No encontrado', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response(new Uint8Array(result.body), { status: 200, headers: result.headers });
  };

  registerOn(protocol, handler);
  registerOn(session.fromPartition(PRESENTATION_PARTITION).protocol, handler);
}

/**
 * `handle` lanza si el esquema ya esta registrado en esa sesion. Un segundo
 * arranque de los handlers no debe tumbar el proceso principal.
 */
function registerOn(target: Protocol, handler: (request: { url: string }) => Promise<Response>): void {
  try {
    if (target.isProtocolHandled(PRESENTATION_SCHEME)) return;
    target.handle(PRESENTATION_SCHEME, handler);
  } catch (error) {
    console.error('[PresentationProtocol] No se pudo registrar el esquema:', error);
  }
}

export const PRESENTATION_CSP = CSP;
