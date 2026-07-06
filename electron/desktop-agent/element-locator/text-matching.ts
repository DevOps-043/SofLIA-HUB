/**
 * Coincidencia de texto visible tolerante a como "ve" cada fuente:
 * sin acentos, sin mayusculas, espacios colapsados. El OCR ademas confunde
 * puntuacion, por lo que el matching nunca exige igualdad estricta de simbolos.
 */

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export function normalizeVisibleText(value: string): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Colapsa a tokens alfanumericos separados por un espacio. Hace el matching
 * robusto a puntuacion, que el OCR agrega/omite/confunde con frecuencia
 * ("MINECRAFT: JAVA EDITION" vs "minecraft java edition").
 */
function toAlphanumeric(value: string): string {
  return normalizeVisibleText(value).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Puntua que tan bien `candidato` corresponde a `objetivo` (ambos textos
 * visibles al usuario). 0 = sin relacion. Mas alto = mejor:
 *   3 exacto, 2 prefijo, 1 contiene (en cualquier direccion).
 * Compara tanto la forma normalizada como la alfanumerica y toma el mejor,
 * para tolerar diferencias de puntuacion entre lo buscado y lo leido.
 */
export function scoreTextMatch(candidato: string, objetivo: string): number {
  const directo = compareForms(normalizeVisibleText(candidato), normalizeVisibleText(objetivo));
  const alfanumerico = compareForms(toAlphanumeric(candidato), toAlphanumeric(objetivo));
  return Math.max(directo, alfanumerico);
}

/** Un fragmento demasiado corto genera falsos positivos (un "-" o "a" en pantalla). */
const MIN_PREFIX_LEN = 2;
const MIN_FRAGMENT_LEN = 4;
const MIN_FRAGMENT_RATIO = 0.5;

function compareForms(cand: string, target: string): number {
  if (!cand || !target) return 0;
  if (cand === target) return 3;
  // Prefijo: el lado mas corto debe ser sustancial.
  if ((cand.startsWith(target) || target.startsWith(cand)) && Math.min(cand.length, target.length) >= MIN_PREFIX_LEN) {
    return 2;
  }
  // El candidato contiene TODO el objetivo (label mas largo, p.ej. "Reproducir todo" busca "reproducir").
  if (cand.includes(target) && target.length >= MIN_PREFIX_LEN) return 1;
  // El objetivo contiene al candidato: solo si el candidato es sustancial, para
  // no clickear un simbolo o letra suelta que casualmente aparece en lo buscado.
  if (target.includes(cand) && cand.length >= MIN_FRAGMENT_LEN && cand.length >= target.length * MIN_FRAGMENT_RATIO) {
    return 1;
  }
  return 0;
}
