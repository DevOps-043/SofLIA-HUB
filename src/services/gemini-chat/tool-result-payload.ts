/**
 * Preparacion del resultado de una herramienta antes de devolverselo al modelo.
 *
 * Un resultado de herramienta viaja como TEXTO dentro del contexto y se
 * reenvia en cada iteracion del turno. Eso convierte dos cosas en una bomba:
 *
 * - Una captura de pantalla en `data:image/...`: en base64 son megabytes de
 *   texto. Como tokens de texto cuesta cientos de miles; como imagen de verdad,
 *   un par de miles. Aqui se extrae para adjuntarla como imagen.
 * - Un volcado estructural grande (un arbol de accesibilidad completo, un
 *   listado enorme): no cabe y ademas no aporta al orquestador, que decide con
 *   el resultado, no con el volcado.
 *
 * Sin esta frontera un solo `take_screenshot` producia una peticion de ~400 000
 * tokens contra un limite de 200 000: el turno moria y ningun reintento podia
 * salvarlo, porque el problema no era la capacidad sino el tamano.
 */

import type { MediaRef } from '../../shared/multimodal-input';

/** Presupuesto de texto por resultado de herramienta. */
const MAX_RESULT_CHARS = 24_000;
/** Mas de dos imagenes por tanda no aportan y multiplican el costo. */
const MAX_IMAGES = 2;
const DATA_URL_PREFIX = 'data:image/';

export interface ToolResultPayload {
  /** JSON del resultado, ya sin binarios ni campos desproporcionados. */
  text: string;
  /** Data URLs extraidas, para adjuntarlas como imagen y no como texto. */
  images: string[];
  /** Medios que viajan como parte propia (video por URI, archivo remoto). */
  media: MediaRef[];
}

export function prepareToolResult(raw: string): ToolResultPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // El texto siempre sale como JSON de objeto: quien lo consume lo parsea
    // para reconstruir la respuesta de la herramienta.
    return { text: safeStringify({ result: truncate(raw) }), images: [], media: [] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { text: safeStringify({ result: parsed }), images: [], media: [] };
  }

  const images: string[] = [];
  const { media, rest } = extractToolMedia(parsed as Record<string, unknown>);
  const campos = extractImages(rest, images);
  return { text: fitBudget(campos), images: images.slice(0, MAX_IMAGES), media };
}

/**
 * Sustituye las data URL de imagen por una nota. La nota importa: sin ella el
 * modelo cree que la herramienta no devolvio nada y vuelve a llamarla.
 */
function extractImages(result: Record<string, unknown>, images: string[]): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(result)) {
    if (typeof valor === 'string' && valor.startsWith(DATA_URL_PREFIX)) {
      if (images.length < MAX_IMAGES) images.push(valor);
      salida[clave] = 'La imagen va adjunta a este resultado, no en este campo.';
      continue;
    }
    // Un muestreo de cuadros llega como lista de data URL. Sin este caso, la
    // lista entera viajaba dentro del JSON y consumia el contexto del turno.
    if (Array.isArray(valor) && valor.some((item) => typeof item === 'string' && item.startsWith(DATA_URL_PREFIX))) {
      let adjuntadas = 0;
      for (const item of valor) {
        if (typeof item !== 'string' || !item.startsWith(DATA_URL_PREFIX)) continue;
        if (images.length >= MAX_IMAGES) break;
        images.push(item);
        adjuntadas += 1;
      }
      salida[clave] = `${adjuntadas} imagenes van adjuntas a este resultado, no en este campo.`;
      continue;
    }
    salida[clave] = valor;
  }
  return salida;
}

/**
 * Campo reservado con el que una herramienta entrega medios que no son
 * imagenes en linea —un video por URI, un archivo remoto— para que el turno
 * los envie como partes propias en vez de dentro del JSON del resultado.
 */
export const TOOL_MEDIA_FIELD = '__media';

export function extractToolMedia(result: Record<string, unknown>): {
  media: MediaRef[];
  rest: Record<string, unknown>;
} {
  const bruto = result[TOOL_MEDIA_FIELD];
  if (!Array.isArray(bruto) || !bruto.length) return { media: [], rest: result };
  const { [TOOL_MEDIA_FIELD]: _descartado, ...rest } = result;
  return { media: bruto.filter(isMediaRef), rest };
}

function isMediaRef(value: unknown): value is MediaRef {
  const kind = (value as { kind?: unknown } | null)?.kind;
  return kind === 'inline' || kind === 'remote' || kind === 'public-video' || kind === 'frames';
}

/**
 * Recorta hasta caber. Se descartan los campos mas pesados primero, uno a uno,
 * dejando constancia de cada omision: un resultado silenciosamente mutilado
 * lleva al modelo a conclusiones falsas sobre lo que vio.
 */
function fitBudget(result: Record<string, unknown>): string {
  let serializado = safeStringify(result);
  if (serializado.length <= MAX_RESULT_CHARS) return serializado;

  const restante: Record<string, unknown> = { ...result };
  const porPeso = Object.keys(restante)
    .map((clave) => ({ clave, peso: safeStringify(restante[clave]).length }))
    .sort((a, b) => b.peso - a.peso);

  for (const { clave, peso } of porPeso) {
    restante[clave] = `[omitido: ${peso} caracteres que no caben en el contexto]`;
    serializado = safeStringify(restante);
    if (serializado.length <= MAX_RESULT_CHARS) return serializado;
  }

  // Ni vaciando todos los campos cabe: solo puede pasar con un objeto de
  // claves desproporcionadas. Se responde con el motivo, no con un recorte
  // que dejaria un JSON invalido.
  return safeStringify({
    success: false,
    error: 'El resultado de la herramienta es demasiado grande para el contexto. Pide una porcion mas acotada.',
  });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value ?? '');
  }
}

function truncate(value: string): string {
  if (value.length <= MAX_RESULT_CHARS) return value;
  return `${value.slice(0, MAX_RESULT_CHARS)}… [recortado: ${value.length} caracteres]`;
}
