import { z } from 'zod';
import { AGENT_LIMITS } from '../../src/shared/agent-runtime';
export const startSchema = z.object({
  title: z.string().trim().min(1).max(AGENT_LIMITS.titleChars),
  source: z.string().trim().min(10).max(AGENT_LIMITS.sourceChars),
  provider: z.enum(['gemini', 'codex']),
}).strict();
const identifier = z.string().min(1).max(200);
const tokens = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const storedRunSchema = startSchema.extend({
  id: identifier,
  scope: z.object({ userId: identifier, organizationId: identifier.nullable() }).strict(),
  status: z.enum(['running', 'review', 'cancelled', 'failed', 'interrupted', 'publishing', 'published', 'uncertain']),
  steps: z.array(z.object({
    role: z.enum(['acuerdos', 'evidencia', 'coordinador']),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
    output: z.string().max(AGENT_LIMITS.outputChars),
    inputTokens: tokens, outputTokens: tokens,
    toolCalls: z.number().int().nonnegative().max(AGENT_LIMITS.maxToolsPerStep + 1),
  }).strict()).length(3).refine(steps => steps.map(step => step.role).join(',') === 'acuerdos,evidencia,coordinador'),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  error: z.string().max(1000).nullable(),
  digest: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  approvalExpiresAt: tokens.nullable(),
  meetingRunId: identifier.nullable(), parentRunId: identifier.nullable(),
}).strict();
