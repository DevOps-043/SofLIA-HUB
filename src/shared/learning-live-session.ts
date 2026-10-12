export interface LearningLiveSessionReference {
  organization_slug: string;
  session_id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseLearningLiveSession(value: unknown): LearningLiveSessionReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['organization_slug', 'session_id'].includes(key))) return null;
  if (typeof input.organization_slug !== 'string' || input.organization_slug.length > 100 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.organization_slug)) return null;
  if (typeof input.session_id !== 'string' || !UUID.test(input.session_id)) return null;
  return { organization_slug: input.organization_slug, session_id: input.session_id.toLowerCase() };
}

export interface LearningLiveOpenResult {
  success: boolean;
  title?: string;
  error?: string;
  code?: 'not_ready' | 'access_denied' | 'unavailable';
}
