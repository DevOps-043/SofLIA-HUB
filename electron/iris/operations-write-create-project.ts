import {
  generateUniqueProjectKey,
  normalizeProjectKey,
} from '../../src/shared/iris-resolution';
import { getIrisClient } from './clients';
import { fetchProjectsByTeamId } from './projects';
import { resolveTeamReference } from './resolvers';
import { ensureUserExistsInIris } from './user-sync';

export async function createProject(params: {
  projectName: string;
  projectKey?: string;
  createdByUserId: string;
  teamId?: string;
  teamName?: string;
  description?: string;
  priorityLevel?: string;
  startDate?: string;
  targetDate?: string;
}): Promise<{ success: boolean; project?: unknown; error?: string; warnings?: string[] }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no está disponible.' };

  try {
    const projectName = params.projectName?.trim();
    if (!projectName) return { success: false, error: 'El proyecto necesita un nombre valido.' };
    const warnings: string[] = [];
    const teamResult = await resolveTeamReference(
      { teamId: params.teamId, teamName: params.teamName },
      {
        allowSingleTeamDefault: true,
        missingMessage: 'Debes indicar el equipo donde se va a crear el proyecto.',
      },
    );
    if (!teamResult.success) return { success: false, error: teamResult.error };
    warnings.push(...teamResult.warnings);
    await ensureUserExistsInIris(params.createdByUserId);

    const existingProjects = await fetchProjectsByTeamId(teamResult.value.team_id);
    const normalizedRequestedKey = normalizeProjectKey(params.projectKey);
    const projectKey = generateUniqueProjectKey(
      projectName,
      existingProjects.map((project) => project.project_key),
      params.projectKey,
    );
    if (!normalizedRequestedKey) warnings.push(`Se genero automaticamente la clave del proyecto: ${projectKey}.`);
    else if (projectKey !== normalizedRequestedKey) warnings.push(`La clave ${normalizedRequestedKey} ya estaba en uso y se genero ${projectKey}.`);

    const insertData: Record<string, unknown> = {
      project_name: projectName,
      project_key: projectKey,
      created_by_user_id: params.createdByUserId,
      project_status: 'planning',
      health_status: 'none',
      priority_level: params.priorityLevel || 'medium',
      completion_percentage: 0,
      is_public: true,
      is_template: false,
      team_id: teamResult.value.team_id,
    };
    if (params.description?.trim()) insertData.project_description = params.description.trim();
    if (params.startDate?.trim()) insertData.start_date = params.startDate.trim();
    if (params.targetDate?.trim()) insertData.target_date = params.targetDate.trim();

    const { data, error } = await iris.from('pm_projects').insert(insertData).select('*').single();
    if (error) {
      console.error('[IRIS-Main] createProject error:', error);
      return { success: false, error: error.message, warnings: warnings.length > 0 ? warnings : undefined };
    }
    console.log(`[IRIS-Main] Project created: "${data.project_name}" [${data.project_key}]`);
    return { success: true, project: data, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] createProject exception:', err);
    return { success: false, error: message };
  }
}
