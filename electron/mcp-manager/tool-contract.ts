import { createHash } from 'node:crypto';
import { z } from 'zod';
import { compileJsonSchema, jsonSchemaNodeSchema, parseClosedObjectSchema } from './schema-validation';
import type { ExecutableToolSchema, RuntimeToolPolicy, ToolSchema } from './types';

const runtimeToolPolicySchema = z.object({
  owner: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/),
  risk: z.enum(['read', 'write', 'critical']),
  allowedAgents: z.array(z.enum(['whatsapp-agent', 'desktop-agent', 'meeting-agent'])).min(1),
  hitl: z.enum(['never', 'required']),
  allowInGroups: z.boolean(),
  timeoutMs: z.number().int().min(100).max(60_000),
  audit: z.literal(true),
}).strict().superRefine((policy, ctx) => {
  if (policy.risk !== 'read' && policy.hitl !== 'required') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Las herramientas write/critical requieren HITL.' });
  }
  if (policy.risk !== 'read' && policy.allowInGroups) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Las herramientas write/critical no pueden habilitarse en grupos.' });
  }
});

const toolSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_-]{2,63}$/),
  description: z.string().min(8).max(1_000),
  inputSchema: jsonSchemaNodeSchema,
  outputSchema: jsonSchemaNodeSchema.optional(),
  runtime: runtimeToolPolicySchema.optional(),
  handler: z.custom<ToolSchema['handler']>((value) => typeof value === 'function').optional(),
}).strict();

export function parseToolContract(value: unknown): ToolSchema {
  const parsed = toolSchema.parse(value) as ToolSchema;
  if (typeof parsed.handler !== 'function') return parsed;

  parsed.inputSchema = parseClosedObjectSchema(parsed.inputSchema, 'inputSchema', { allowOpaqueNodes: false });
  parsed.outputSchema = parseClosedObjectSchema(parsed.outputSchema, 'outputSchema', { allowOpaqueNodes: true });
  parsed.runtime = runtimeToolPolicySchema.parse(parsed.runtime) as RuntimeToolPolicy;
  compileJsonSchema(parsed.inputSchema);
  compileJsonSchema(parsed.outputSchema);
  return parsed as ExecutableToolSchema;
}

export function isExecutableTool(tool: ToolSchema): tool is ExecutableToolSchema {
  return Boolean(tool.handler && tool.outputSchema && tool.runtime);
}

export function getToolContractFingerprint(tool: ExecutableToolSchema): string {
  const contract = {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    runtime: tool.runtime,
  };
  return createHash('sha256').update(stableStringify(contract)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
