import { z } from 'zod';
import type { ProjectHubApiService, ProjectHubOperationAuthorization } from './index';

const MAX_REVIEW_CHARS = 12_000;
const destination = z.object({ workspaceId: z.string().uuid(), projectId: z.string().uuid().optional() });
const projectIdentity = z.object({ project_id: z.string().uuid(), workspace_id: z.string().uuid(), project_name: z.string().min(1).max(255) });

/** Resuelve nombres con identidad vigente; el payload no elige sus etiquetas de destino. */
export async function projectHubReviewTarget(service: ProjectHubApiService, input: unknown, authorization: ProjectHubOperationAuthorization): Promise<string> {
  const target = destination.parse(input);
  authorization.assertCurrent();
  const status = await service.getStatus(authorization); authorization.assertCurrent();
  const workspace = status.workspaces.find(item => item.id.toLowerCase() === target.workspaceId.toLowerCase());
  if (!status.authenticated || !workspace) throw new Error('Vuelve a autenticar Project Hub para comprobar el workspace.');
  const heading = `Workspace: ${JSON.stringify(workspace.name)} (${workspace.id})`;
  if (!target.projectId) return heading;
  const result = await service.getProject({ workspaceId: target.workspaceId, projectId: target.projectId }, authorization); authorization.assertCurrent();
  const project = projectIdentity.safeParse(result.data);
  if (!result.success || !project.success || project.data.project_id.toLowerCase() !== target.projectId.toLowerCase()
    || project.data.workspace_id.toLowerCase() !== target.workspaceId.toLowerCase()) throw new Error('No se pudo comprobar el proyecto de destino.');
  return `${heading}\nProyecto: ${JSON.stringify(project.data.project_name)} (${project.data.project_id})`;
}

/** Resumen de alcance; no presenta extractos grandes como si fueran vista íntegra. */
export function projectHubMutationReview(operation: string, userId: string, input: unknown, destinationLabel = ''): string {
  const summarize = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string') return value.length <= 600 ? value
      : `${value.slice(0, 120)}… [texto de ${value.length} caracteres; se compartirá completo]`;
    if (Array.isArray(value)) {
      if (key === 'files') return value.map(item => summarize(item));
      return { elementos: value.length, primeros: value.slice(0, 3).map(item => summarize(item)),
        aviso: 'Se compartirá la información de todos los elementos seleccionados, incluidos sus textos y metadatos.' };
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      if (key === 'metadata') return `[metadatos adicionales: ${entries.length} campos; se compartirán completos]`;
      return Object.fromEntries(entries.map(([name, field]) => [name, summarize(field, name)]));
    }
    return value;
  };
  const preview = JSON.stringify(summarize(input), null, 2);
  return `Usuario: ${userId}\nOperación: ${operation}\n${destinationLabel}\nLa información se compartirá en el workspace/proyecto indicado abajo.\n`
    + `Resumen de la selección (los textos grandes y las listas se resumen):\n${preview.slice(0, MAX_REVIEW_CHARS)}`
    + (preview.length > MAX_REVIEW_CHARS ? '\nResumen recortado; se compartirá toda la selección.' : '');
}
