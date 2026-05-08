import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import { generateUniqueProjectKey, normalizeProjectKey } from '../../shared/iris-resolution';
import { sofiaAuth } from '../sofia-auth';
import { getProjects } from './projects';
import { resolveTeamReference } from './team-resolution';
import type { MutationResult } from './types';
import { ensureUserExistsInIris } from './user-sync';

export async function createProject(data: {
  name: string;
  key?: string;
  description?: string;
  team_id?: string;
  team_name?: string;
}): Promise<MutationResult> {
  try {
    if (!irisSupa || !isIrisConfigured()) return { success: false, error: 'Database not configured' };
    const projectName = data.name?.trim();
    if (!projectName) return { success: false, error: 'El proyecto necesita un nombre valido.' };

    const session = await sofiaAuth.getSession();
    let userId = session?.user?.id;
    if (!userId) userId = (await irisSupa.auth.getUser()).data.user?.id;
    if (!userId) return { success: false, error: 'Usuario no autenticado en el sistema.' };

    const warnings: string[] = [];
    const teamResult = await resolveTeamReference(
      { teamId: data.team_id, teamName: data.team_name },
      { allowSingleTeamDefault: true, missingMessage: 'Debes indicar el equipo donde se va a crear el proyecto.' },
    );
    if (!teamResult.success) return { success: false, error: teamResult.error };
    warnings.push(...teamResult.warnings);

    await ensureUserExistsInIris(userId);
    const existingProjects = await getProjects(teamResult.value.team_id);
    const requestedKey = normalizeProjectKey(data.key);
    const projectKey = generateUniqueProjectKey(projectName, existingProjects.map((project) => project.project_key), data.key);
    if (!requestedKey) warnings.push(`Se genero automaticamente la clave del proyecto: ${projectKey}.`);
    else if (projectKey !== requestedKey) warnings.push(`La clave ${requestedKey} ya estaba en uso y se genero ${projectKey}.`);

    const { data: projectRecord, error } = await irisSupa
      .from('pm_projects')
      .insert({
        project_name: projectName,
        project_key: projectKey,
        project_description: data.description?.trim() || '',
        team_id: teamResult.value.team_id,
        created_by_user_id: userId,
        project_status: 'planning',
        health_status: 'none',
        priority_level: 'medium',
        completion_percentage: 0,
        is_public: true,
        is_template: false,
      })
      .select('*')
      .single();

    if (error) return { success: false, error: error.message, warnings: warnings.length ? warnings : undefined };
    return { success: true, data: projectRecord, warnings: warnings.length ? warnings : undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
