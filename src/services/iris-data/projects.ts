import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import { resolveTeamReference } from './team-resolution';
import type { IrisProject } from './types';

export async function getProjects(teamRef?: string): Promise<IrisProject[]> {
  try {
    if (!irisSupa || !isIrisConfigured()) return [];
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
