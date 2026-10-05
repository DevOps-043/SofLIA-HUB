/**
 * Modelo predeterminado de conversación y modelo fijo de Computer Use.
 *
 * El selector conversacional puede ofrecer otros modelos, pero ninguna acción
 * de Computer Use debe degradar silenciosamente a otro modelo.
 */
export const SOFLIA_RUNTIME_MODEL = 'gemini-3.8-flash' as const;

/**
 * Escalon ligero: tareas de fondo de alto volumen y baja exigencia (resumen
 * diario, resumen de URLs) y la opcion "SofLIA Lite" del selector.
 *
 * Vive aqui y no repetido en cada punto de uso porque asi fue como derivo:
 * el catalogo se actualizo a 3.5 y los flujos de fondo se quedaron en 3.1.
 * No se sube al modelo principal a proposito: estas rutas se eligen por costo
 * y latencia, no por capacidad.
 */
export const SOFLIA_LITE_MODEL = 'gemini-3.5-flash-lite' as const;

/** Identificadores OpenAI compartidos entre el selector y el ruteo del chat. */
export const SOFLIA_MAX_MODEL = 'gpt-6.1-sol' as const;
export const SOFLIA_PRO_MODEL = 'gpt-5.6-luna' as const;
