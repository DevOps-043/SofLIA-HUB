export const GEMINI_GROUNDING_API = {
  generateContentBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  maxRequestBytes: 320_000,
  modelNamePattern: /^[a-z0-9._:-]+$/i,
} as const;

export const GEMINI_GROUNDING_MODELS = {
  preferredFallbacks: [SOFLIA_RUNTIME_MODEL],
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

/**
 * Tool config obligatoria cuando la peticion mezcla una tool INTEGRADA del
 * servidor (ejecucion de codigo, busqueda) con function calling propio. Sin
 * ella la API responde 400:
 *
 *   Please enable tool_config.include_server_side_tool_invocations
 *   to use Built-in tools with Function calling
 *
 * Solo hace falta con la mezcla: una tool integrada sola, o declaraciones de
 * funcion solas, no la requieren. Por eso se decide sobre el arreglo de tools
 * ya construido y no sobre el nombre del modelo: quien arma el catalogo puede
 * no ser quien hace la llamada.
 *
 * Devuelve la forma estructural: en `@google/genai` encaja directo con
 * `ToolConfig`, y en el SDK legado —cuyo `ToolConfig` solo declara
 * `functionCallingConfig`— el llamador la castea. Ambos reenvian `toolConfig`
 * verbatim al cuerpo REST, que acepta camelCase.
 */
export function buildServerSideToolInvocationsConfig(
  tools: unknown[] | undefined,
): { includeServerSideToolInvocations: true } | undefined {
  if (!tools?.length) return undefined;
  const hasBuiltInTool = tools.some((tool) => hasKey(tool, 'codeExecution') || hasKey(tool, 'googleSearch'));
  const hasFunctionCalling = tools.some((tool) => hasKey(tool, 'functionDeclarations'));
  if (!hasBuiltInTool || !hasFunctionCalling) return undefined;
  return { includeServerSideToolInvocations: true };
}

function hasKey(value: unknown, key: string): boolean {
  return Boolean(value) && typeof value === 'object' && key in (value as Record<string, unknown>);
}

import { SOFLIA_RUNTIME_MODEL } from './soflia-runtime-model';
