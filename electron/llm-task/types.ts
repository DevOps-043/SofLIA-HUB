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
