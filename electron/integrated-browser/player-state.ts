import type { WebContents } from 'electron';
import type { BrowserPlayerState } from './types';

/**
 * Lectura del reproductor de la pestaña activa.
 *
 * Solo observa: no reproduce, no pausa, no navega y no toca el registro de
 * referencias del DOM. Un turno que analiza un video no debe alterar lo que el
 * usuario esta viendo.
 */
export async function readPlayerState(contents: WebContents): Promise<BrowserPlayerState> {
  try {
    const raw = await contents.executeJavaScript(PLAYER_STATE_SCRIPT, true) as Record<string, unknown>;
    return normalize(raw);
  } catch {
    return emptyPlayerState();
  }
}

export function emptyPlayerState(): BrowserPlayerState {
  return { hasVideo: false, currentTimeSeconds: null, durationSeconds: null, paused: true, publicVideoUrl: null };
}

function normalize(raw: Record<string, unknown> | null): BrowserPlayerState {
  if (!raw || typeof raw !== 'object') return emptyPlayerState();
  return {
    hasVideo: raw.hasVideo === true,
    currentTimeSeconds: finiteOrNull(raw.currentTimeSeconds),
    durationSeconds: finiteOrNull(raw.durationSeconds),
    paused: raw.paused !== false,
    publicVideoUrl: resolvePublicVideoUrl(raw.pageUrl),
  };
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * ¿La pagina corresponde a un video publico que el proveedor puede descargar?
 *
 * Se acota a destinos publicos reconocibles y se normaliza a su forma canonica.
 * Un video autenticado o de reproductor propietario no entra por aqui: su
 * evidencia es el muestreo de cuadros, declarado como tal.
 */
export function resolvePublicVideoUrl(pageUrl: unknown): string | null {
  if (typeof pageUrl !== 'string' || !pageUrl) return null;
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const videoId = readYoutubeVideoId(url, host);
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function readYoutubeVideoId(url: URL, host: string): string | null {
  const isYoutube = host === 'youtube.com' || host.endsWith('.youtube.com');
  if (isYoutube) {
    if (url.pathname === '/watch') return validId(url.searchParams.get('v'));
    const shorts = url.pathname.match(/^\/shorts\/([^/]+)/);
    if (shorts) return validId(shorts[1]);
    const embed = url.pathname.match(/^\/embed\/([^/]+)/);
    if (embed) return validId(embed[1]);
    return null;
  }
  if (host === 'youtu.be') return validId(url.pathname.slice(1));
  return null;
}

function validId(value: string | null): string | null {
  return value && /^[A-Za-z0-9_-]{6,20}$/.test(value) ? value : null;
}

/**
 * Lee el elemento de video mas relevante del documento: el de mayor area
 * visible. Una pagina puede tener varios (anuncios, miniaturas con
 * previsualizacion) y el que importa es el que el usuario esta mirando.
 */
const PLAYER_STATE_SCRIPT = `(() => {
  const resultado = { hasVideo: false, currentTimeSeconds: null, durationSeconds: null, paused: true, pageUrl: location.href };
  const videos = Array.from(document.querySelectorAll('video'));
  if (!videos.length) return resultado;
  let elegido = null;
  let mayorArea = 0;
  for (const video of videos) {
    const caja = video.getBoundingClientRect();
    const area = Math.max(0, caja.width) * Math.max(0, caja.height);
    if (area > mayorArea) { mayorArea = area; elegido = video; }
  }
  if (!elegido) return resultado;
  resultado.hasVideo = true;
  resultado.paused = !!elegido.paused;
  if (Number.isFinite(elegido.currentTime)) resultado.currentTimeSeconds = elegido.currentTime;
  if (Number.isFinite(elegido.duration)) resultado.durationSeconds = elegido.duration;
  return resultado;
})()`;
