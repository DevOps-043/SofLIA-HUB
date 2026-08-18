import {
  EXTRACTION_OUTPUT_TOKENS,
  MEMORY_THINKING_LEVEL,
  MIN_SUMMARY_CHARS,
  SUMMARY_OUTPUT_TOKENS,
} from './constants';

/**
 * Configuracion de generacion de las llamadas al modelo que MANTIENEN la memoria
 * (resumen de sesion, extraccion de hechos y aprendizaje de skills).
 *
 * El modelo de memoria es de razonamiento: los tokens de pensamiento se cobran
 * contra `maxOutputTokens`. Un tope pensado para el texto visible deja la
 * respuesta truncada y la memoria se llena de fragmentos. Aqui se baja el nivel
 * de pensamiento y se deja margen suficiente para pensamiento + respuesta.
 *
 * Modulo PURO/testeable: no habla con el proveedor ni con Electron.
 */

export type MemoryGenerationConfig = {
  maxOutputTokens: number;
  thinkingConfig: { thinkingLevel: string };
  responseMimeType?: string;
};

/** Config del resumidor de sesion (texto Markdown libre). */
export function buildSummaryGenerationConfig(): MemoryGenerationConfig {
  return {
    maxOutputTokens: SUMMARY_OUTPUT_TOKENS,
    thinkingConfig: { thinkingLevel: MEMORY_THINKING_LEVEL },
  };
}

/** Config de los extractores (hechos y skills): responden JSON estricto. */
export function buildExtractionGenerationConfig(): MemoryGenerationConfig {
  return {
    maxOutputTokens: EXTRACTION_OUTPUT_TOKENS,
    thinkingConfig: { thinkingLevel: MEMORY_THINKING_LEVEL },
    responseMimeType: 'application/json',
  };
}

/**
 * ¿Este resumen se puede guardar? Una respuesta cortada por tope de tokens no es
 * una Memory Card: guardarla contamina permanentemente el contexto inyectado y
 * deja sin material a los extractores. Se descarta y la sesion se resume mas
 * adelante, cuando la llamada complete.
 */
export function isUsableSummary(text: string | null | undefined, finishReason?: string): boolean {
  const clean = String(text ?? '').trim();
  if (!clean || clean.length < MIN_SUMMARY_CHARS) return false;
  return finishReason !== 'MAX_TOKENS';
}
