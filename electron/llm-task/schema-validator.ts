import type { LlmTaskSchema } from './types';

export function validateSchema(value: unknown, schema: LlmTaskSchema, path: string): string[] {
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
      return typeof value === 'number' && Number.isFinite(value) ? [] : [`${path} debe ser number.`];
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value) ? [] : [`${path} debe ser integer.`];
    case 'array':
      return validateArray(value, schema, path);
    case 'object':
      return validateObject(value, schema, path);
    default:
      return [`${path} tiene un tipo de schema no soportado.`];
  }
}

function validateArray(value: unknown, schema: LlmTaskSchema & { type: 'array' }, path: string): string[] {
  if (!Array.isArray(value)) return [`${path} debe ser array.`];
  if (!schema.items) return [];
  return value.flatMap((item, index) => validateSchema(item, schema.items as LlmTaskSchema, `${path}[${index}]`));
}

function validateObject(value: unknown, schema: LlmTaskSchema & { type: 'object' }, path: string): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path} debe ser object.`];
  }

  const record = value as Record<string, unknown>;
  const properties = schema.properties || {};
  const errors = validateRequiredKeys(record, schema.required || [], path);

  for (const [key, childSchema] of Object.entries(properties)) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      errors.push(...validateSchema(record[key], childSchema, `${path}.${key}`));
    }
  }

  if (schema.additionalProperties === false) {
    errors.push(...validateAdditionalProperties(record, properties, path));
  }

  return errors;
}

function validateRequiredKeys(record: Record<string, unknown>, required: string[], path: string): string[] {
  return required
    .filter((key) => !Object.prototype.hasOwnProperty.call(record, key))
    .map((key) => `${path}.${key} es obligatorio.`);
}

function validateAdditionalProperties(
  record: Record<string, unknown>,
  properties: Record<string, LlmTaskSchema>,
  path: string,
): string[] {
  return Object.keys(record)
    .filter((key) => !Object.prototype.hasOwnProperty.call(properties, key))
    .map((key) => `${path}.${key} no esta permitido por el schema.`);
}
