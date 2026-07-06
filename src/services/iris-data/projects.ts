import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import { resolveTeamReference } from './team-resolution';
import type { IrisProject } from './types';

/**
 * @param teamRef  Filtra por un equipo especifico (por id o nombre).
 * @param teamIds  Restringe a los equipos de la organizacion activa. Si es un arreglo vacio,
 *   devuelve [] (la org no tiene equipos). Si es undefined, no restringe (compat).
 */
export async function getProjects(teamRef?: string, teamIds?: string[]): Promise<IrisProject[]> {
  try {
    if (!irisSupa || !isIrisConfigured()) return [];
    if (teamIds && teamIds.length === 0) return [];
    let resolvedTeamId: string | null = null;
    if (teamRef?.trim()) {
      const teamResult = await resolveTeamReference(
        { teamId: teamRef, teamName: teamRef },
        { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo solicitado para filtrar proyectos.' },
      );
      if (!teamResult.success) return [];
      resolvedTeamId = teamResult.value.team_id;
    }

    let query = irisSupa.from('pm_projects').select('*').order('updated_at', { ascending: false });
    if (resolvedTeamId) query = query.eq('team_id', resolvedTeamId);
    else if (teamIds) query = query.in('team_id', teamIds);
    const { data, error } = await query;
    return error ? [] : ((data || []) as IrisProject[]);
  } catch {
    return [];
  }
}

export async function deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!irisSupa || !isIrisConfigured()) return { success: false, error: 'Database not configured' };
    await irisSupa.from('task_issues').delete().eq('project_id', projectId);
    await irisSupa.from('pm_project_members').delete().eq('project_id', projectId);
    await irisSupa.from('project_members').delete().eq('project_id', projectId);
    const { error } = await irisSupa.from('pm_projects').delete().eq('project_id', projectId);
    return error ? { success: false, error: error.message } : { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
