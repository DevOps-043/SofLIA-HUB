export type GoogleToolParameterSchema = {
  type: 'OBJECT';
  properties: Record<string, unknown>;
  required?: string[];
};

export type GoogleToolDeclaration = {
  name: string;
  description: string;
  parameters: GoogleToolParameterSchema;
};

export const emptyParameters = (): GoogleToolParameterSchema => ({
  type: 'OBJECT',
  properties: {},
});
