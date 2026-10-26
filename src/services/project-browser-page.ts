import { projectHubApi, type ProjectHubResult } from './project-hub-api';
import { safeWebUrl } from './project-web-url';

export async function saveProjectBrowserPage(workspaceId: string, projectId: string, title: string, url: string): Promise<ProjectHubResult> {
  const valid = safeWebUrl(url);
  if (!valid) return Promise.resolve({ success: false, error: 'Esta página no se puede guardar.' });
  const result = await projectHubApi.addEvidence(workspaceId, projectId, {
    type: 'link', source_system: 'soflia-browser',
    title: (title || new URL(valid).hostname).slice(0, 500),
    external_reference: valid.slice(0, 500),
    metadata: { url: valid, saved_from: 'browser' }, items: [],
  });
  if (!result.success && ['DATABASE_FORBIDDEN', 'DATABASE_SCHEMA_UNAVAILABLE'].includes(result.code || '')) return { ...result, error: 'No se pudo guardar la página. El almacenamiento de este proyecto todavía no está habilitado.' };
  return result;
}
