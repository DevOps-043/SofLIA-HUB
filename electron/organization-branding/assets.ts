import fs from 'node:fs/promises';
import path from 'node:path';
import type { LocalBrandAssets, OrganizationBranding } from './types';

/**
 * Descarga acotada de los recursos graficos de marca al workspace.
 *
 * Reglas: solo el origen configurado de Supabase SOFIA, limite de tamano y
 * tiempo maximo por recurso. Un recurso que no cumpla se trata como ausente
 * y NUNCA bloquea la generacion del entregable: es preferible una
 * presentacion sin logo que ninguna presentacion.
 */

const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 8_000;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/gif': '.gif',
};

/**
 * Host permitido: el de la instancia SOFIA configurada. Se compara el host
 * completo, no un sufijo, para que `sofia.supabase.co.atacante.com` no pase.
 */
export function allowedBrandingHost(): string | null {
  const raw = process.env.VITE_SOFIA_SUPABASE_URL || '';
  try {
    return raw ? new URL(raw).host.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function isAllowedBrandingUrl(candidate: string, allowedHost: string | null): boolean {
  if (!allowedHost) return false;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return false;
    return url.host.toLowerCase() === allowedHost;
  } catch {
    return false;
  }
}

/**
 * Descarga logo y banner a `<workspace>/assets/` y devuelve rutas relativas.
 * Los recursos descartados se listan en `missing` para informar al usuario.
 */
export async function downloadBrandAssets(
  workspaceRoot: string,
  branding: OrganizationBranding,
  deps: { fetchImpl?: typeof fetch; allowedHost?: string | null } = {},
): Promise<LocalBrandAssets> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const allowedHost = deps.allowedHost !== undefined ? deps.allowedHost : allowedBrandingHost();
  const missing: string[] = [];

  if (!branding.enabled) return { logo: null, banner: null, missing, logoAbsolutePath: null };

  const assetsDir = path.join(workspaceRoot, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });

  const [logo, banner] = await Promise.all([
    downloadOne(assetsDir, branding.logoUrl, 'logo', { fetchImpl, allowedHost, missing }),
    downloadOne(assetsDir, branding.bannerUrl, 'banner', { fetchImpl, allowedHost, missing }),
  ]);

  return {
    logo,
    banner,
    missing,
    // Ruta absoluta solo para uso interno de main (extraccion de paleta).
    // Nunca sale al renderer ni al modelo.
    logoAbsolutePath: logo ? path.join(workspaceRoot, logo) : null,
  };
}

async function downloadOne(
  assetsDir: string,
  url: string | null,
  baseName: string,
  context: { fetchImpl: typeof fetch; allowedHost: string | null; missing: string[] },
): Promise<string | null> {
  if (!url) return null;

  if (!isAllowedBrandingUrl(url, context.allowedHost)) {
    console.warn(`[BrandAssets] Origen no permitido para ${baseName}; se omite el recurso.`);
    context.missing.push(baseName);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await context.fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      context.missing.push(baseName);
      return null;
    }

    // Se rechaza por cabecera antes de leer el cuerpo cuando el servidor la
    // declara; el tamano real se vuelve a comprobar tras la lectura.
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_ASSET_BYTES) {
      context.missing.push(baseName);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_ASSET_BYTES) {
      context.missing.push(baseName);
      return null;
    }

    const extension = resolveExtension(response.headers.get('content-type'), url);
    if (!extension) {
      context.missing.push(baseName);
      return null;
    }

    const fileName = `${baseName}${extension}`;
    await fs.writeFile(path.join(assetsDir, fileName), buffer);
    return `assets/${fileName}`;
  } catch {
    // Timeout, red caida o respuesta invalida: recurso ausente, sin bloquear.
    context.missing.push(baseName);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveExtension(contentType: string | null, url: string): string | null {
  const mime = String(contentType ?? '').split(';')[0]?.trim().toLowerCase();

  // Si el servidor DECLARA un tipo, manda: un `text/html` servido desde una
  // URL terminada en `.png` no es una imagen, y caer a la extension de la URL
  // escribiria ese contenido en el workspace como si lo fuera.
  if (mime) return EXTENSION_BY_MIME[mime] ?? null;

  // Sin cabecera se acepta la extension de la URL, restringida a la misma
  // lista: nunca se escribe una extension arbitraria en el workspace.
  try {
    const extension = path.extname(new URL(url).pathname).toLowerCase();
    return Object.values(EXTENSION_BY_MIME).includes(extension) ? extension : null;
  } catch {
    return null;
  }
}
