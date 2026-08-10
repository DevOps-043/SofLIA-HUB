import fs from 'node:fs/promises';
import path from 'node:path';
import type { SkillWorkspaceService } from './service';

/**
 * Exportacion de la presentacion a UN SOLO archivo HTML autocontenido.
 *
 * Sustituye a la exportacion en PDF: imprimir la presentacion aplana justo lo
 * que le da valor —transiciones, animaciones de entrada, profundidad— y la
 * convierte en imagenes estaticas. Un HTML con los estilos incrustados y las
 * imagenes en `data:` se abre en cualquier navegador conservando todo eso, y
 * viaja como un archivo unico por correo o WhatsApp.
 */

/** Cota del archivo final: por encima deja de ser comodo de compartir. */
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

export async function exportPresentationToHtml(
  service: SkillWorkspaceService,
  workspaceId: string,
  entryFile = 'index.html',
): Promise<{ ok: true; htmlPath: string } | { ok: false; error: string }> {
  const entryAbsolute = await service.resolveAbsolutePath(workspaceId, entryFile);
  if (!entryAbsolute) {
    return { ok: false, error: 'La presentacion todavia no tiene un documento que exportar.' };
  }

  const workspace = await service.getWorkspace(workspaceId);
  const root = path.dirname(entryAbsolute);

  try {
    const original = await fs.readFile(entryAbsolute, 'utf-8');
    const conEstilos = await inlineStylesheets(original, root);
    const conGuiones = await inlineScripts(conEstilos, root);
    const autocontenido = await inlineImages(conGuiones, root);

    const bytes = Buffer.byteLength(autocontenido, 'utf-8');
    if (bytes > MAX_OUTPUT_BYTES) {
      return { ok: false, error: `La presentacion pesa ${Math.round(bytes / (1024 * 1024))} MB y no se puede compartir como archivo unico.` };
    }

    const outputPath = path.join(root, `${slugify(workspace?.title) || 'presentacion'}.html`);
    await fs.writeFile(outputPath, autocontenido, 'utf-8');
    return { ok: true, htmlPath: outputPath };
  } catch (error) {
    return { ok: false, error: `No se pudo exportar: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Sustituye cada `<link rel="stylesheet" href="...">` local por su contenido
 * dentro de un `<style>`. Conserva el ORDEN original, que es lo que decide
 * que regla gana: `marca.css` debe seguir yendo antes que los estilos propios.
 */
async function inlineStylesheets(html: string, root: string): Promise<string> {
  const pattern = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi;
  const enlaces = html.match(pattern) ?? [];
  let resultado = html;

  for (const enlace of enlaces) {
    const href = /href=["']([^"']+)["']/i.exec(enlace)?.[1];
    // Un `href` remoto no deberia existir (la regla lo prohibe), pero si
    // aparece se descarta en vez de dejar el archivo dependiendo de la red.
    if (!href || isRemote(href)) {
      resultado = resultado.replace(enlace, '');
      continue;
    }

    const contenido = await readLocalAsset(root, href, 'utf-8');
    resultado = resultado.replace(
      enlace,
      contenido === null ? '' : `<style>\n/* ${href} */\n${contenido}\n</style>`,
    );
  }

  return resultado;
}

/**
 * Incrusta los guiones locales. El archivo exportado viaja solo: si el
 * `<script src>` se quedara apuntando a `guion-base.js`, la presentacion
 * llegaria sin las animaciones de entrada, que es justo lo que la distingue.
 */
async function inlineScripts(html: string, root: string): Promise<string> {
  const pattern = /<script[^>]*\ssrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  const etiquetas = html.match(pattern) ?? [];
  let resultado = html;

  for (const etiqueta of etiquetas) {
    const src = /src=["']([^"']+)["']/i.exec(etiqueta)?.[1];
    if (!src || isRemote(src)) {
      resultado = resultado.replace(etiqueta, '');
      continue;
    }
    const contenido = await readLocalAsset(root, src, 'utf-8');
    resultado = resultado.replace(
      etiqueta,
      contenido === null ? '' : `<script>
/* ${src} */
${contenido}
</script>`,
    );
  }

  return resultado;
}

/**
 * Convierte las imagenes locales a `data:`. Cubre tanto `src=` de HTML como
 * `url(...)` de CSS ya incrustado, que es donde vive el logo de marca.
 */
async function inlineImages(html: string, root: string): Promise<string> {
  const referencias = new Set<string>();

  for (const match of html.matchAll(/src=["']([^"']+)["']/gi)) referencias.add(match[1]);
  for (const match of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) referencias.add(match[1]);

  let resultado = html;
  for (const referencia of referencias) {
    if (isRemote(referencia) || referencia.startsWith('data:')) continue;

    const extension = path.extname(referencia.split('?')[0]).toLowerCase();
    const mime = MIME_BY_EXTENSION[extension];
    if (!mime) continue;

    const buffer = await readLocalAsset(root, referencia, null);
    if (buffer === null) continue;

    const dataUri = `data:${mime};base64,${(buffer as Buffer).toString('base64')}`;
    resultado = resultado.split(referencia).join(dataUri);
  }

  return resultado;
}

/**
 * Lee un recurso del workspace. Rechaza cualquier ruta que salga de la
 * carpeta: la exportacion no es una via para incrustar archivos del equipo.
 */
async function readLocalAsset(root: string, reference: string, encoding: 'utf-8' | null): Promise<string | Buffer | null> {
  const limpia = reference.split('?')[0].split('#')[0];
  if (path.isAbsolute(limpia)) return null;

  const destino = path.resolve(root, limpia);
  const relativa = path.relative(root, destino);
  if (relativa.startsWith('..') || path.isAbsolute(relativa)) return null;

  try {
    return encoding ? await fs.readFile(destino, encoding) : await fs.readFile(destino);
  } catch {
    return null;
  }
}

function isRemote(reference: string): boolean {
  return /^(https?:)?\/\//i.test(reference);
}

function slugify(value: string | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}
