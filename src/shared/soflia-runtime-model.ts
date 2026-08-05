/**
 * Modelo predeterminado de conversación y modelo fijo de Computer Use.
 *
 * El selector conversacional puede ofrecer otros modelos, pero ninguna acción
 * de Computer Use debe degradar silenciosamente a otro modelo.
 */
export const SOFLIA_RUNTIME_MODEL = 'gemini-3.6-flash' as const;
