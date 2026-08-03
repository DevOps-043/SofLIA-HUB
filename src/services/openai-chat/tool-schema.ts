import type { GeminiParameterSchema, GeminiToolGroup } from '../gemini-tools/types';

/** Herramienta de funcion en el formato que espera la Responses API. */
export interface OpenAIFunctionTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: false;
}

/**
 * Las declaraciones de herramientas del producto estan escritas en el dialecto
 * de Gemini (tipos en MAYUSCULAS). Se traducen a JSON Schema estandar para no
 * mantener dos catalogos de herramientas en paralelo: la fuente sigue siendo
 * `src/services/gemini-tools`.
 *
 * `strict: false` es deliberado: el modo estricto exige `additionalProperties:
 * false` y que todas las propiedades esten en `required`, y varias herramientas
 * del catalogo tienen argumentos opcionales.
 */
export function toOpenAITools(groups: any[]): OpenAIFunctionTool[] {
  const tools: OpenAIFunctionTool[] = [];
  for (const group of groups) {
    const declarations = (group as GeminiToolGroup)?.functionDeclarations;
    if (!Array.isArray(declarations)) continue;
    for (const declaration of declarations) {
      tools.push({
        type: 'function',
        name: declaration.name,
        description: declaration.description,
        parameters: toJsonSchema(declaration.parameters),
        strict: false,
      });
    }
  }
  return tools;
}

function toJsonSchema(schema?: GeminiParameterSchema): Record<string, unknown> {
  if (!schema) return { type: 'object', properties: {} };

  const converted: Record<string, unknown> = { type: schema.type.toLowerCase() };
  if (schema.description) converted.description = schema.description;

  if (schema.properties) {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      properties[key] = toJsonSchema(value);
    }
    converted.properties = properties;
  } else if (converted.type === 'object') {
    converted.properties = {};
  }

  if (schema.items) converted.items = toJsonSchema(schema.items);
  if (schema.required?.length) converted.required = schema.required;

  return converted;
}
