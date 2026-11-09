import type { ProjectHubApiService } from './service';
import type { ProjectHubOperationAuthorization } from './session-context';
import type { ProjectOrganization } from '../../src/shared/project-creation';

/** Nunca resuelve por nombre, slug ni posición en la lista de workspaces. */
export async function resolveProjectOrganization(
  service: Pick<ProjectHubApiService, 'getStatus'>,
  organizationId: string,
  authorization: ProjectHubOperationAuthorization,
): Promise<ProjectOrganization> {
  const status = await service.getStatus(authorization);
  authorization.assertCurrent();
  if (!status.authenticated || status.enabled === false || !status.workspaces.length) throw new Error('Inicia sesión para crear proyectos en tu organización.');
  const { getIrisClient } = await import('../iris/clients');
  const client = getIrisClient();
  if (!client) throw new Error('No se puede comprobar la organización del proyecto.');
  // Lectura de directorio existente, restringida a workspaces ya autorizados.
  // No amplía grants/RLS ni escribe negocio mediante el cliente heredado.
  const { data, error } = await client.from('workspaces').select('workspace_id')
    .eq('sofia_org_id', organizationId).in('workspace_id', status.workspaces.map(item => item.id))
    .limit(2).abortSignal(AbortSignal.any([AbortSignal.timeout(15_000), ...(authorization.signal ? [authorization.signal] : [])]));
  authorization.assertCurrent();
  if (error || !data || data.length !== 1) throw new Error('No se pudo vincular la organización activa con su espacio de proyectos. Reintenta la conexión.');
  const workspace = status.workspaces.find(item => item.id === data[0].workspace_id);
  if (!workspace) throw new Error('No tienes acceso a los proyectos de esta organización.');
  return { workspaceId: workspace.id, name: workspace.name, role: workspace.role };
}
