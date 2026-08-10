import net from 'node:net';

/**
 * Descarga de una imagen para la presentacion.
 *
 * El modelo elige la URL, asi que main hace de frontera: una peticion salida
 * del proceso principal alcanzaria la red local y los servicios de metadatos
 * de la nube. De ahi las guardas: solo HTTPS, sin destinos privados, sin
 * seguir redirecciones a ciegas, con limite de tamano y de tiempo.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export type FetchedImage = { ok: true; data: Buffer; extension: string } | { ok: false; error: string };

export async function fetchPresentationImage(
  rawUrl: string,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<FetchedImage> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;

  let actual = rawUrl;
  for (let salto = 0; salto <= MAX_REDIRECTS; salto += 1) {
    const validacion = validateUrl(actual);
    if (!validacion.ok) return { ok: false, error: validacion.error };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // `redirect: 'manual'` para revalidar cada destino: si no, una URL
      // publica podria redirigir a `169.254.169.254` y la guarda se saltaria.
      const response = await fetchImpl(actual, { signal: controller.signal, redirect: 'manual' });

      if (response.status >= 300 && response.status < 400) {
        const destino = response.headers.get('location');
        if (!destino) return { ok: false, error: 'La descarga redirige a un destino vacio.' };
        actual = new URL(destino, actual).toString();
        continue;
      }

      if (!response.ok) return { ok: false, error: `El servidor respondio ${response.status}.` };

      const mime = String(response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
      const extension = mime ? EXTENSION_BY_MIME[mime] : undefined;
      if (!extension) return { ok: false, error: `El recurso no es una imagen admitida (${mime || 'sin tipo'}).` };

      const declarado = Number(response.headers.get('content-length') ?? '0');
      if (declarado > MAX_BYTES) return { ok: false, error: 'La imagen es demasiado grande.' };

      const data = Buffer.from(await response.arrayBuffer());
      if (data.byteLength === 0) return { ok: false, error: 'La descarga llego vacia.' };
      if (data.byteLength > MAX_BYTES) return { ok: false, error: 'La imagen es demasiado grande.' };

      return { ok: true, data, extension };
    } catch (error) {
      const motivo = error instanceof Error && error.name === 'AbortError'
        ? 'La descarga tardo demasiado.'
        : 'No se pudo descargar la imagen.';
      return { ok: false, error: motivo };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: 'La descarga encadeno demasiadas redirecciones.' };
}

function validateUrl(candidate: string): { ok: true } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: 'La direccion no es una URL valida.' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Solo se descargan imagenes por HTTPS.' };
  }
  if (isPrivateHost(url.hostname)) {
    return { ok: false, error: 'No se descargan imagenes de direcciones internas.' };
  }
  return { ok: true };
}

/**
 * Rechaza localhost, rangos privados y enlace-local (incluido el 169.254.x.x
 * de los metadatos de nube). Un nombre de dominio que resuelva a una IP
 * privada no se detecta aqui; la defensa completa exigiria resolver el DNS y
 * fijar la IP, que es mas de lo que este caso justifica.
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }

  const version = net.isIP(host);
  if (version === 4) {
    const [a, b] = host.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (version === 6) {
    return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80');
  }
  return false;
}
