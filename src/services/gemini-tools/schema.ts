import type { GeminiParameterSchema } from './types';

export const emptyParams = (): GeminiParameterSchema => ({
  type: 'OBJECT',
  properties: {},
});

export const objectParams = (
  properties: Record<string, GeminiParameterSchema>,
  required?: string[],
): GeminiParameterSchema => ({
  type: 'OBJECT',
  properties,
  ...(required ? { required } : {}),
});

export const stringProp = (description: string): GeminiParameterSchema => ({
  type: 'STRING',
  description,
});

export const booleanProp = (description: string): GeminiParameterSchema => ({
  type: 'BOOLEAN',
  description,
});

export const numberProp = (description: string): GeminiParameterSchema => ({
  type: 'NUMBER',
  description,
});

export const stringArrayProp = (description: string): GeminiParameterSchema => ({
  type: 'ARRAY',
  items: { type: 'STRING' },
  description,
});
