import { z } from 'zod';

export const liveCatalogRequestSchema = z.object({
  organization_slug: z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  page: z.number().int().min(0).max(100000).default(0),
  view: z.enum(['student', 'instructor']).default('student'),
}).strict();
export const liveCatalogResponseSchema = z.object({
  version: z.literal(1), user_id: z.string().uuid(), can_teach: z.boolean(),
  total: z.number().int().nonnegative(),
  sessions: z.array(z.object({
    id: z.string().uuid(), title: z.string().max(160), description: z.string().max(8000),
    starts_at: z.string().datetime({ offset: true }), duration_minutes: z.number().int().positive().max(1440),
    status: z.enum(['scheduled', 'live']), session_type: z.enum(['meeting', 'webinar']),
    course_title: z.string().max(300), instructor_name: z.string().max(300),
  }).strict()).max(20),
}).strict();
export type LiveCatalogRequest = z.input<typeof liveCatalogRequestSchema>;
export type LiveCatalog = z.infer<typeof liveCatalogResponseSchema>;
export type LiveCatalogSession = LiveCatalog['sessions'][number];
export type LiveCatalogResult = { success: true; catalog: LiveCatalog } | { success: false; code: 'not_ready' | 'access_denied' | 'unavailable'; error: string };
