// Generado desde el contrato Learning. Sincronizar con scripts/quality/sync-learning-workspace-contract.mjs.
import { z } from 'zod';

const uuid = z.string().uuid();
const content = z.string().trim().min(1).max(2000);
const skill = uuid.nullable().optional();
const httpsLink = z.string().max(2048).url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443');
}, 'Comparte un enlace HTTPS sin credenciales');
const faq = z.object({ question: z.string().trim().min(1).max(200), answer: z.string().trim().min(1).max(1000) }).strict();
export const workspaceCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('post'), kind: z.enum(['chat','question','practice','help']), content, link: httpsLink.nullable().optional(), room: z.string().trim().min(1).max(80).nullable().optional(), skill_id: skill }).strict(),
  z.object({ type: z.literal('review'), parent_id: uuid, content }).strict(),
  z.object({ type: z.literal('vote'), post_id: uuid }).strict(),
  z.object({ type: z.literal('resolve'), post_id: uuid }).strict(),
  z.object({ type: z.literal('publish_pulse'), question: z.string().trim().min(1).max(300), options: z.array(z.string().trim().min(1).max(120)).min(2).max(6).refine((items) => new Set(items).size === items.length), skill_id: skill }).strict(),
  z.object({ type: z.literal('answer_pulse'), pulse_id: uuid, answer: z.number().int().min(0).max(5) }).strict(),
  z.object({ type: z.literal('close_pulse'), pulse_id: uuid }).strict(),
  z.object({ type: z.literal('settings'), rules: content, faq: z.array(faq).max(10) }).strict(),
  z.object({ type: z.literal('consent'), policy_version: z.number().int().positive(), ai_enabled: z.boolean(), telemetry_enabled: z.boolean() }).strict(),
  z.object({ type: z.literal('policy'), ai_enabled: z.boolean(), telemetry_enabled: z.boolean(), retention_days: z.number().int().min(1).max(90) }).strict(),
]);
export type WorkspaceCommand = z.infer<typeof workspaceCommandSchema>;
export const workspaceOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('snapshot') }).strict(),
  z.object({ type: z.literal('command'), id: uuid, command: workspaceCommandSchema }).strict(),
  z.object({ type: z.literal('assist'), post_id: uuid }).strict(),
  z.object({ type: z.literal('suggest_pulse') }).strict(),
]);
export type WorkspaceOperation = z.infer<typeof workspaceOperationSchema>;
export const workspaceRequestSchema = z.object({
  organization_slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  session_id: uuid, operation: workspaceOperationSchema,
}).strict();

export const workspaceSnapshotSchema = z.object({
  version: z.literal(1), user_id: uuid, can_manage: z.boolean(), is_admin: z.boolean(),
  session: z.object({ id: uuid, title: z.string().max(160), description: z.string().max(8000), status: z.enum(['scheduled','live','ended','cancelled']), starts_at: z.string(), session_type: z.enum(['meeting','webinar']) }),
  settings: z.object({ rules: content, faq: z.array(faq).max(10) }),
  policy: z.object({ version: z.number().int().positive(), ai_enabled: z.boolean(), telemetry_enabled: z.boolean(), retention_days: z.number().int().min(1).max(90) }),
  consent: z.object({ policy_version: z.number().int(), ai_enabled: z.boolean(), telemetry_enabled: z.boolean(), updated_at: z.string() }).nullable(),
  audit: z.array(z.object({ action: z.enum(['policy','consent']), actor: z.string().max(160), policy_version: z.number().int(), created_at: z.string() })).max(20),
  skills: z.array(z.object({ id: uuid, name: z.string().max(200) })).max(100),
  posts: z.array(z.object({ id: uuid, user_id: uuid, author_name: z.string().max(160), kind: z.enum(['chat','question','practice','review','help']), content, parent_id: uuid.nullable(), room: z.string().nullable(), link: httpsLink.nullable(), skill_id: uuid.nullable(), resolved: z.boolean(), created_at: z.string(), votes: z.number().int().nonnegative(), voted: z.boolean() })).max(100),
  pulses: z.array(z.object({ id: uuid, question: z.string().max(300), options: z.array(z.string().max(120)).min(2).max(6), closed: z.boolean(), skill_id: uuid.nullable(), created_at: z.string(), answer: z.number().int().min(0).max(5).nullable(), counts: z.array(z.number().int().nonnegative()).max(6).nullable() })).max(5),
});
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export const pulseSuggestionSchema = z.object({ question: z.string().trim().min(1).max(300), options: z.array(z.string().trim().min(1).max(120)).min(2).max(6).refine((items) => new Set(items).size === items.length) }).strict();
export const workspaceResponseSchema = z.object({ snapshot: workspaceSnapshotSchema.optional(), private_answer: z.string().max(2000).optional(), pulse_suggestion: pulseSuggestionSchema.optional() }).strict();
export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;
