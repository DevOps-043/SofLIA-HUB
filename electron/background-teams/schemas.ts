import { z } from 'zod';
import { BACKGROUND_LIMITS, BACKGROUND_MODELS } from '../../src/shared/background-teams';

export const contextSchema = z.object({ organizationId: z.string().uuid().nullable() }).strict();
export const startSchema = z.object({
  requestId: z.string().uuid(), conversationId: z.string().trim().min(1).max(160),
  task: z.string().trim().min(1).max(8000), source: z.string().max(BACKGROUND_LIMITS.sourceChars),
  model: z.enum(BACKGROUND_MODELS), effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']),
  allowResearch: z.boolean(),
  expectedOwnerId: z.string().min(1).max(100), expectedOrganizationId: z.string().uuid().nullable(),
  messageId: z.string().uuid(),
}).strict();
export const controlSchema = z.object({ jobId: z.string().uuid(), action: z.enum(['pause', 'resume', 'cancel']) }).strict();
export const openSchema = z.object({ jobId: z.string().uuid(), artifactId: z.string().uuid() }).strict();
export const attachSchema = z.object({ jobId: z.string().uuid(), messageId: z.string().uuid(), conversationId: z.string().uuid() }).strict();
export const artifactSchema = z.object({
  id: z.string().uuid(), role: z.string().regex(/^[a-z-]+$/), name: z.string().regex(/^[a-zA-Z0-9_-]{1,80}\.(md|txt|csv|docx|pptx|xlsx)$/),
  format: z.enum(['md', 'txt', 'csv', 'docx', 'pptx', 'xlsx']), bytes: z.number().int().min(1).max(BACKGROUND_LIMITS.artifactBytes),
  hash: z.string().regex(/^[a-f0-9]{64}$/), verified: z.boolean(),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const storedJobSchema = startSchema.extend({
  messageId: z.string().uuid().optional(),
  id: z.string().uuid(), scope: z.object({ userId: z.string().min(1).max(100), organizationId: z.string().uuid().nullable(), dataUserId: z.string().max(100).nullable() }).strict(),
  status: z.enum(['queued', 'running', 'verifying', 'paused', 'completed', 'failed', 'cancelled', 'interrupted']),
  agents: z.array(z.object({
    role: z.string().regex(/^[a-z-]+$/), instruction: z.string().max(4000),
    status: z.enum(['pending', 'running', 'completed', 'failed']), operation: z.string().max(160), output: z.string().max(16000), calls: z.number().int().min(0).max(BACKGROUND_LIMITS.calls),
  }).strict()).min(3).max(3),
  artifacts: z.array(artifactSchema).max(BACKGROUND_LIMITS.artifacts),
  sources: z.array(z.object({ uri: z.url().max(2000), title: z.string().max(180), role: z.string().regex(/^[a-z-]+$/) }).strict()).max(50),
  actions: z.array(z.object({ id: z.string().uuid(), role: z.string().regex(/^[a-z-]+$/), tool: z.string().max(80),
    status: z.enum(['running', 'completed', 'failed', 'cancelled']), at: z.string().datetime(), artifactId: z.string().uuid().optional() }).strict()).max(60).default([]),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), sequence: z.number().int().min(1),
  calls: z.number().int().min(0).max(BACKGROUND_LIMITS.calls), tools: z.number().int().min(0).max(BACKGROUND_LIMITS.tools),
  tokens: z.number().int().min(0), activeMs: z.number().min(0), summary: z.string().max(16000), error: z.string().max(300).nullable(),
}).strict();

