import type { Rectangle } from 'electron';

// El limite acota la memoria de una direccion, no decide si es segura: eso lo
// resuelve la allowlist de protocolos. Con 2 KB los flujos de autenticacion de
// Google quedaban fuera, porque encadenan `TL`, `ifkv` y `continue` anidados y
// superan ese tamaño con facilidad; la redireccion legitima de la verificacion
// en dos pasos se bloqueaba como si fuera un protocolo prohibido. Se alinea con
// el maximo practico que acepta la barra de direcciones de Chrome.
const MAX_TARGET_LENGTH = 32_768;
const MIN_VIEWPORT_WIDTH = 160;
const MIN_VIEWPORT_HEIGHT = 120;
const EXPLICIT_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const DOMAIN_OR_LOCALHOST = /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[\p{L}\d-]+\.)+[\p{L}]{2,})(?::\d{1,5})?(?:[/?#].*)?$/iu;

export class IntegratedBrowserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegratedBrowserValidationError';
  }
}

export function normalizeBrowserTarget(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new IntegratedBrowserValidationError('La direccion debe ser texto.');
  }
  const target = raw.trim();
  if (!target) throw new IntegratedBrowserValidationError('Escribe una direccion o busqueda.');
  if (target.length > MAX_TARGET_LENGTH) {
    throw new IntegratedBrowserValidationError('La direccion excede el limite permitido.');
  }
  if (target === 'about:blank') return target;

  if (EXPLICIT_SCHEME.test(target)) {
    return assertAllowedUrl(target);
  }

  if (DOMAIN_OR_LOCALHOST.test(target)) {
    return assertAllowedUrl(`https://${target}`);
  }

  return `https://www.google.com/search?q=${encodeURIComponent(target)}`;
}

export function isAllowedBrowserUrl(raw: unknown): boolean {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_TARGET_LENGTH) return false;
  if (raw === 'about:blank') return true;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Describe un destino rechazado para el registro tecnico. Un bloqueo sin rastro
 * deja al usuario con un aviso y sin forma de saber que se corto, pero la URL
 * completa de un flujo de autenticacion lleva tokens de sesion: se conservan
 * protocolo, host y tamaño, que es lo que permite distinguir un protocolo
 * prohibido de una direccion demasiado larga.
 */
export function describeBlockedUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return 'destino vacio';
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host || '(sin host)'} (${raw.length} caracteres)`;
  } catch {
    const scheme = EXPLICIT_SCHEME.exec(raw)?.[0] ?? '(sin protocolo)';
    return `${scheme} no interpretable (${raw.length} caracteres)`;
  }
}

function assertAllowedUrl(raw: string): string {
  if (raw === 'about:blank') return raw;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new IntegratedBrowserValidationError('La direccion no es valida.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new IntegratedBrowserValidationError(`El protocolo ${parsed.protocol || 'indicado'} no esta permitido.`);
  }
  if (!parsed.hostname) throw new IntegratedBrowserValidationError('La direccion no contiene un host valido.');
  return parsed.toString();
}

export function parseBrowserViewport(raw: unknown, contentBounds: Rectangle): Rectangle {
  if (!raw || typeof raw !== 'object') {
    throw new IntegratedBrowserValidationError('El viewport del navegador es invalido.');
  }
  const candidate = raw as Partial<Rectangle>;
  const values = [candidate.x, candidate.y, candidate.width, candidate.height];
  if (!values.every((value) => typeof value === 'number' && Number.isSafeInteger(value))) {
    throw new IntegratedBrowserValidationError('Las coordenadas del navegador deben ser enteros.');
  }

  const x = candidate.x as number;
  const y = candidate.y as number;
  const width = candidate.width as number;
  const height = candidate.height as number;
  if (x < 0 || y < 0 || width < MIN_VIEWPORT_WIDTH || height < MIN_VIEWPORT_HEIGHT) {
    throw new IntegratedBrowserValidationError('El viewport del navegador esta fuera de rango.');
  }
  if (x >= contentBounds.width || y >= contentBounds.height) {
    throw new IntegratedBrowserValidationError('El viewport queda fuera de la ventana principal.');
  }

  const clampedWidth = Math.min(width, contentBounds.width - x);
  const clampedHeight = Math.min(height, contentBounds.height - y);
  if (clampedWidth < MIN_VIEWPORT_WIDTH || clampedHeight < MIN_VIEWPORT_HEIGHT) {
    throw new IntegratedBrowserValidationError('El espacio disponible para el navegador es insuficiente.');
  }
  return { x, y, width: clampedWidth, height: clampedHeight };
}
