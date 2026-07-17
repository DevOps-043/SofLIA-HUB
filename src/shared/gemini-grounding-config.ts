export const GEMINI_GROUNDING_API = {
  generateContentBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  maxRequestBytes: 320_000,
  modelNamePattern: /^[a-z0-9._:-]+$/i,
} as const;

export const GEMINI_GROUNDING_MODELS = {
  preferredFallbacks: ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-pro'],
} as const;

export const GEMINI_GROUNDING_TOOLS = {
  googleSearch: 'google_search',
  urlContext: 'url_context',
  codeExecution: 'code_execution',
} as const;

/**
 * ¿El modelo soporta combinar ejecucion de codigo con otras herramientas
 * (busqueda, function calling)? Solo Gemini 3 en adelante; en los 2.x la
 * combinacion invalida la peticion completa.
 */
export function supportsCodeExecutionCombo(modelName: string): boolean {
  return /^gemini-(3|[4-9]|\d{2,})/.test(modelName.replace(/^models\//, '').trim());
}
