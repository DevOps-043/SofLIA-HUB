import { z } from 'zod';
import type { ClosedObjectSchema, JsonSchemaNode } from './types';

const primitiveValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const jsonSchemaNodeSchema: z.ZodType<JsonSchemaNode> = z.lazy(() =>
  z.object({
    type: z.enum(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']).optional(),
    description: z.string().min(1).optional(),
    // zod 4 exige declarar el tipo de clave: sin el, el valor se infiere como
    // `unknown` y el nodo deja de encajar con JsonSchemaNode.
    properties: z.record(z.string(), jsonSchemaNodeSchema).optional(),
    required: z.array(z.string().min(1)).optional(),
    additionalProperties: z.boolean().optional(),
    items: jsonSchemaNodeSchema.optional(),
    enum: z.array(primitiveValueSchema).min(1).optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
    minItems: z.number().int().nonnegative().optional(),
    maxItems: z.number().int().nonnegative().optional(),
  }).strict().superRefine((schema, ctx) => {
    if (!schema.type) {
      const structuralKeys = ['properties', 'required', 'additionalProperties', 'items'] as const;
      if (structuralKeys.some((key) => schema[key] !== undefined) || schema.enum) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Un nodo opaco no puede declarar estructura ni enum.' });
      }
      return;
    }

    if (schema.type === 'object') {
      if (!schema.properties) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Un objeto requiere properties.' });
      }
      if (schema.additionalProperties !== false) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Todo objeto debe declarar additionalProperties: false.' });
      }
      for (const requiredName of schema.required ?? []) {
        if (!schema.properties?.[requiredName]) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `La propiedad requerida ${requiredName} no está declarada.` });
        }
      }
    } else if (schema.properties || schema.required || schema.additionalProperties !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `La estructura de objeto no aplica a type=${schema.type}.` });
    }

    if (schema.type === 'array' && !schema.items) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Un array requiere items.' });
    }
    if (schema.type !== 'array' && (schema.items || schema.minItems !== undefined || schema.maxItems !== undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `La configuración de array no aplica a type=${schema.type}.` });
    }
    if (schema.type !== 'string' && (schema.minLength !== undefined || schema.maxLength !== undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `La longitud de string no aplica a type=${schema.type}.` });
    }
    if (!['number', 'integer'].includes(schema.type) && (schema.minimum !== undefined || schema.maximum !== undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Los límites numéricos no aplican a type=${schema.type}.` });
    }
  }),
);

export function parseClosedObjectSchema(
  value: unknown,
  label: string,
  options: { allowOpaqueNodes: boolean },
): ClosedObjectSchema {
  const parsed = jsonSchemaNodeSchema.parse(value);
  if (parsed.type !== 'object' || !parsed.properties || parsed.additionalProperties !== false) {
    throw new Error(`${label} debe ser un objeto cerrado con additionalProperties: false.`);
  }
  if (!options.allowOpaqueNodes) assertNoOpaqueNodes(parsed, label);
  return parsed as ClosedObjectSchema;
}

function assertNoOpaqueNodes(schema: JsonSchemaNode, path: string): void {
  if (!schema.type) throw new Error(`${path} contiene un nodo opaco; toda entrada debe declarar tipo.`);
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    assertNoOpaqueNodes(child, `${path}.properties.${name}`);
  }
  if (schema.items) assertNoOpaqueNodes(schema.items, `${path}.items`);
}

export function compileJsonSchema(schema: JsonSchemaNode): z.ZodTypeAny {
  const parsed = jsonSchemaNodeSchema.parse(schema);
  if (!parsed.type) return z.unknown();

  let validator: z.ZodTypeAny;
  switch (parsed.type) {
    case 'object': {
      const required = new Set(parsed.required ?? []);
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, child] of Object.entries(parsed.properties ?? {})) {
        const childValidator = compileJsonSchema(child);
        shape[key] = required.has(key) ? childValidator : childValidator.optional();
      }
      validator = z.object(shape).strict();
      break;
    }
    case 'array': {
      let arrayValidator = z.array(compileJsonSchema(parsed.items!));
      if (parsed.minItems !== undefined) arrayValidator = arrayValidator.min(parsed.minItems);
      if (parsed.maxItems !== undefined) arrayValidator = arrayValidator.max(parsed.maxItems);
      validator = arrayValidator;
      break;
    }
    case 'string': {
      let stringValidator = z.string();
      if (parsed.minLength !== undefined) stringValidator = stringValidator.min(parsed.minLength);
      if (parsed.maxLength !== undefined) stringValidator = stringValidator.max(parsed.maxLength);
      validator = stringValidator;
      break;
    }
    case 'number': {
      let numberValidator = z.number().finite();
      if (parsed.minimum !== undefined) numberValidator = numberValidator.min(parsed.minimum);
      if (parsed.maximum !== undefined) numberValidator = numberValidator.max(parsed.maximum);
      validator = numberValidator;
      break;
    }
    case 'integer': {
      let integerValidator = z.number().int();
      if (parsed.minimum !== undefined) integerValidator = integerValidator.min(parsed.minimum);
      if (parsed.maximum !== undefined) integerValidator = integerValidator.max(parsed.maximum);
      validator = integerValidator;
      break;
    }
    case 'boolean':
      validator = z.boolean();
      break;
    case 'null':
      validator = z.null();
      break;
  }

  if (parsed.enum) {
    const allowed = parsed.enum;
    validator = validator.refine((value) => allowed.some((candidate) => Object.is(candidate, value)), {
      message: `Valor fuera del enum permitido: ${allowed.join(', ')}`,
    });
  }
  return validator;
}
