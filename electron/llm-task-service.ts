import { GoogleGenerativeAI } from '@google/generative-ai';

export type LlmTaskSchema =
  | {
      type: 'object';
      properties?: Record<string, LlmTaskSchema>;
      required?: string[];
      additionalProperties?: boolean;
      description?: string;
      enum?: unknown[];
    }
  | {
      type: 'array';
      items?: LlmTaskSchema;
      description?: string;
      enum?: unknown[];
    }
  | {
      type: 'string' | 'number' | 'integer' | 'boolean' | 'null';
      description?: string;
      enum?: unknown[];
    };

export interface LlmJsonTaskInput {
  prompt: string;
  input?: unknown;
  schema: LlmTaskSchema;
  model?: string;
}

export interface LlmJsonTaskResult<T = unknown> {
  output: T;
  rawText: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

export class LlmTaskService {
  private apiKey: string | null = null;
  private genAI: GoogleGenerativeAI | null = null;

  setApiKey(apiKey: string | null): void {
    const normalized = apiKey?.trim() || null;
    if (normalized === this.apiKey) {
      return;
    }

    this.apiKey = normalized;
    this.genAI = null;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async runJsonTask<T = unknown>(task: LlmJsonTaskInput): Promise<LlmJsonTaskResult<T>> {
    const ai = this.getClient();
    const model = ai.getGenerativeModel({
      model: task.model || DEFAULT_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const composedPrompt = [
      'Eres el motor llm-task estructurado de SofLIA.',
      'Debes devolver EXCLUSIVAMENTE JSON valido.',
      'No incluyas markdown, comentarios ni texto extra.',
      'Cumple el schema dado con precision.',
      '',
      '### TAREA',
      task.prompt.trim(),
      '',
      '### INPUT JSON',
      JSON.stringify(task.input ?? {}, null, 2),
      '',
      '### SCHEMA JSON',
      JSON.stringify(task.schema, null, 2),
    ].join('\n');

    const result = await model.generateContent(composedPrompt);
    const rawText = result.response.text().trim();
    const parsed = this.parseJson(rawText);
    const validationErrors = validateSchema(parsed, task.schema, '$');

    if (validationErrors.length > 0) {
      throw new Error(`La respuesta JSON no cumple el schema: ${validationErrors.join(' | ')}`);
    }

    return {
      output: parsed as T,
      rawText,
    };
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.apiKey) {
      throw new Error('No hay API key configurada para llm-task.');
    }

    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }

    return this.genAI;
  }

  private parseJson(rawText: string): unknown {
    const normalized = rawText
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    return JSON.parse(normalized);
  }
}

function validateSchema(value: unknown, schema: LlmTaskSchema, path: string): string[] {
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    return [`${path} debe ser uno de los valores permitidos.`];
  }

  switch (schema.type) {
    case 'null':
      return value === null ? [] : [`${path} debe ser null.`];

    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${path} debe ser boolean.`];

    case 'string':
      return typeof value === 'string' ? [] : [`${path} debe ser string.`];

    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? []
        : [`${path} debe ser number.`];

    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
        ? []
        : [`${path} debe ser integer.`];

    case 'array': {
      if (!Array.isArray(value)) {
        return [`${path} debe ser array.`];
      }

      if (!schema.items) {
        return [];
      }

      return value.flatMap((item, index) =>
        validateSchema(item, schema.items as LlmTaskSchema, `${path}[${index}]`),
      );
    }

    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [`${path} debe ser object.`];
      }

      const record = value as Record<string, unknown>;
      const properties = schema.properties || {};
      const errors: string[] = [];

      for (const requiredKey of schema.required || []) {
        if (!Object.prototype.hasOwnProperty.call(record, requiredKey)) {
          errors.push(`${path}.${requiredKey} es obligatorio.`);
        }
      }

      for (const [key, childSchema] of Object.entries(properties)) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) {
          continue;
        }

        errors.push(...validateSchema(record[key], childSchema, `${path}.${key}`));
      }

      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!Object.prototype.hasOwnProperty.call(properties, key)) {
            errors.push(`${path}.${key} no esta permitido por el schema.`);
          }
        }
      }

      return errors;
    }

    default:
      return [`${path} tiene un tipo de schema no soportado.`];
  }
}
