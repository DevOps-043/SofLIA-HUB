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
}

export function prepareToolResult(raw: string): ToolResultPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // El texto siempre sale como JSON de objeto: quien lo consume lo parsea
    // para reconstruir la respuesta de la herramienta.
    return { text: safeStringify({ result: truncate(raw) }), images: [] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { text: safeStringify({ result: parsed }), images: [] };
  }

  const images: string[] = [];
  const campos = extractImages(parsed as Record<string, unknown>, images);
  return { text: fitBudget(campos), images: images.slice(0, MAX_IMAGES) };
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
    salida[clave] = valor;
  }
  return salida;
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
