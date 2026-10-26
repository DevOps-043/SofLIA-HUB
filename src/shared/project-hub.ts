import { projectManagementInputs, projectPage, projectTaskFilters } from './project-management';
import { z } from 'zod';
import { taskResource, taskStage } from './task-workflow';

export const PROJECT_HUB_IPC_MAX_BYTES = 2 * 1024 * 1024;
export const PROJECT_HUB_IPC_MAX_DEPTH = 12;
export const PROJECT_HUB_IPC_MAX_NODES = 20_000;
const uuid = z.string().uuid();
const priority = z.enum(['urgent', 'high', 'medium', 'low', 'none']);
export const projectHubRole = z.enum(['owner', 'admin', 'member', 'viewer', 'guest']);
const hash = z.string().regex(/^[a-fA-F0-9]{64}$/);
const metadata = z.record(z.string(), z.unknown());
const text = (max: number) => z.string().trim().min(1).max(max);
const date = z.iso.date();
const tags = z.array(text(50)).max(25);
const datesOrdered = (value: { start_date?: string | null; target_date?: string | null }) => !value.start_date || !value.target_date || value.start_date <= value.target_date;
const notEmpty = (value: object) => Object.values(value).some(field => field !== undefined);
const sourceUrl = z.string().url().max(4000).refine(value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
});

// Derivado del contrato local v1 del servidor; no describe un despliegue observado.
export const projectHubProjectCreate = z.object({
  name: text(255), description: z.string().trim().max(20_000).nullable().optional(),
  team_id: uuid.optional(), lead_user_id: uuid.optional(), priority: priority.optional(),
  start_date: date.optional(), target_date: date.optional(), tags: tags.optional(),
}).strict().refine(datesOrdered);
export const projectHubProjectUpdate = z.object({
  name: text(255).optional(), description: z.string().trim().max(20_000).nullable().optional(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived']).optional(),
  priority: priority.optional(), health: z.enum(['on_track', 'at_risk', 'off_track', 'none']).optional(),
  lead_user_id: uuid.nullable().optional(), start_date: date.nullable().optional(), target_date: date.nullable().optional(), tags: tags.optional(),
}).strict().refine(datesOrdered).refine(notEmpty);
export const projectHubTaskCreate = z.object({
  title: text(500), description: z.string().max(50_000).nullable().optional(), status_id: uuid.optional(),
  status_stage: taskStage.optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  external_links: z.array(taskResource).max(50).optional(),
  priority_id: uuid.nullable().optional(), assignee_id: uuid.nullable().optional(), due_date: date.nullable().optional(),
  label_ids: z.array(uuid).max(50).optional(),
  cycle_id: uuid.nullable().optional(), parent_issue_id: uuid.nullable().optional(),
  estimate_points: z.number().min(0).max(10000).nullable().optional(), estimate_hours: z.number().min(0).max(100000).nullable().optional(),
  evidence_id: uuid.optional(), evidence_item_id: uuid.optional(),
}).strict();
export const projectHubTaskUpdate = projectHubTaskCreate.partial().omit({ evidence_id: true, evidence_item_id: true }).extend({ expected_updated_at: z.iso.datetime({ offset: true }).optional() }).refine(value => Object.keys(value).some(key => key !== 'expected_updated_at'));
const evidenceItemFields = {
  position: z.number().int().min(0), title: z.string().max(500).optional(), content: z.string().max(51_200).optional(),
  source_url: sourceUrl.optional(), source_hash: hash.optional(), metadata: metadata.optional(),
};
const evidenceItem = z.object({ ...evidenceItemFields, type: z.enum(['tab', 'decision', 'agreement', 'risk', 'question', 'excerpt']) }).strict();
export const projectHubEvidenceCreate = z.object({
  type: z.enum(['browser_collection', 'drive_file', 'link']), source_system: text(50), external_reference: text(500).optional(),
  version: z.number().int().positive().optional(), title: text(500), summary: z.string().max(20_000).optional(),
  content_hash: hash.optional(), metadata: metadata.optional(), items: z.array(evidenceItem).max(100).optional(),
}).strict();
export const projectHubCollection = z.object({
  name: text(255), external_reference: text(500), version: z.number().int().positive(), summary: z.string().max(20_000).optional(),
  tabs: z.array(z.object({ ...evidenceItemFields, type: z.literal('tab') }).strict()).min(1).max(50),
}).strict();
export const projectHubMeeting = z.object({
  approved: z.literal(true), evidence: z.object({
    external_reference: text(500), version: z.number().int().positive().optional(), title: text(500),
    summary: z.string().max(20_000), content_hash: hash, metadata: metadata.optional(),
  }).strict(), items: z.array(evidenceItem).max(200).optional(),
  tasks: z.array(z.object({
    mode: z.enum(['create', 'link', 'ignore']), issue_id: uuid.optional(), title: text(500).optional(),
    description: z.string().max(50_000).optional(), assignee_id: uuid.optional(), due_date: date.optional(),
    evidence_item_position: z.number().int().min(0).optional(),
  }).strict().refine(value => value.mode === 'ignore' || (value.mode === 'link' ? Boolean(value.issue_id) : Boolean(value.title)))).max(100).optional(),
}).strict();
const target = z.object({ workspaceId: uuid, projectId: uuid }).strict();
export const projectHubInputs = {
  ...projectManagementInputs,
  listProjects: z.object({ workspaceId: uuid, search: z.string().max(255).optional(), cursor: z.string().max(2000).optional() }).strict(),
  createProject: z.object({ workspaceId: uuid, project: projectHubProjectCreate }).strict(),
  getProject: target, updateProject: target.extend({ updates: projectHubProjectUpdate }), listTasks: target.extend(projectTaskFilters.shape),
  createTask: target.extend({ task: projectHubTaskCreate }), updateTask: target.extend({ taskId: uuid, updates: projectHubTaskUpdate }),
  listMembers: target.extend(projectPage.shape), addMember: target.extend({ userId: uuid, role: projectHubRole }),
  updateMember: target.extend({ memberId: uuid, role: projectHubRole }), removeMember: target.extend({ memberId: uuid }),
  listEvidence: target.extend(projectPage.shape), getEvidence: target.extend({ evidenceId: uuid }), addEvidence: target.extend({ evidence: projectHubEvidenceCreate }),
  getAnalytics: target, createBrowserCollection: target.extend({ collection: projectHubCollection }),
  importMeeting: target.extend({ idempotencyKey: z.string().min(8).max(200).regex(/^[!-~]+$/u), meeting: projectHubMeeting }),
};
export type ProjectHubInputs = { [K in keyof typeof projectHubInputs]: z.input<(typeof projectHubInputs)[K]> };
export type ProjectHubRole = z.infer<typeof projectHubRole>;

/** Acota antes de parsear schemas recursivos y separa el objeto aprobado del emisor. */
export function projectHubSnapshot(input: unknown): unknown {
  let nodes = 0, bytes = 0;
  const active = new Set<object>(); const encoder = new TextEncoder();
  const fail = () => { throw new Error('Payload Project Hub inválido o excesivo.'); };
  const charge = (size: number) => { bytes += size; if (bytes > PROJECT_HUB_IPC_MAX_BYTES) fail(); };
  const stringBytes = (value: string) => {
    if (value.length > PROJECT_HUB_IPC_MAX_BYTES) fail();
    return encoder.encode(JSON.stringify(value)).byteLength;
  };
  const copy = (value: unknown, depth: number): unknown => {
    if (++nodes > PROJECT_HUB_IPC_MAX_NODES || depth > PROJECT_HUB_IPC_MAX_DEPTH) return fail();
    if (value === null || typeof value === 'boolean') { charge(5); return value; }
    if (typeof value === 'number' && Number.isFinite(value)) { charge(String(value).length); return value; }
    if (typeof value === 'string') { charge(stringBytes(value)); return value; }
    if (!value || typeof value !== 'object' || active.has(value)) return fail();
    active.add(value); charge(2);
    try {
      if (Array.isArray(value)) {
        if (value.length > PROJECT_HUB_IPC_MAX_NODES) return fail();
        return Array.from({ length: value.length }, (_, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, index);
          if (!descriptor || !('value' in descriptor)) return fail();
          charge(1); return copy(descriptor.value, depth + 1);
        });
      }
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return fail();
      const keys = Reflect.ownKeys(value); if (keys.length > PROJECT_HUB_IPC_MAX_NODES) return fail();
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) return fail();
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!('value' in descriptor)) return fail();
        if (descriptor.value === undefined) continue;
        charge(stringBytes(key) + 2); result[key] = copy(descriptor.value, depth + 1);
      }
      return result;
    } finally { active.delete(value); }
  };
  return copy(input, 0);
}
