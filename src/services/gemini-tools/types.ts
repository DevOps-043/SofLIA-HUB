export type GeminiSchemaType = 'OBJECT' | 'STRING' | 'BOOLEAN' | 'NUMBER' | 'ARRAY';

export interface GeminiParameterSchema {
  type: GeminiSchemaType;
  description?: string;
  properties?: Record<string, GeminiParameterSchema>;
  required?: string[];
  items?: GeminiParameterSchema;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: GeminiParameterSchema;
}

export interface GeminiToolGroup {
  functionDeclarations: GeminiFunctionDeclaration[];
}
