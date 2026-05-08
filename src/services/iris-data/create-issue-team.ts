import { getTeams } from './teams';
import { resolveProjectReference } from './project-resolution';
import { resolveTeamReference } from './team-resolution';
import type { IrisProject, IrisTeam, MutationResult } from './types';

export async function resolveIssueTeam(data: {
  team_id?: string;
  team_name?: string;
  project_id?: string;
  project_name?: string;
  warnings: string[];
}): Promise<MutationResult<{ team: IrisTeam; project: IrisProject | null }>> {
  let explicitTeam: IrisTeam | null = null;
  if (data.team_id?.trim() || data.team_name?.trim()) {
    const teamResult = await resolveTeamReference(
      { teamId: data.team_id, teamName: data.team_name },
      { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo indicado para crear la tarea.' },
    );
    if (!teamResult.success) return { success: false, error: teamResult.error };
    explicitTeam = teamResult.value;
    data.warnings.push(...teamResult.warnings);
  }

  const projectResult = await resolveProjectReference({ projectId: data.project_id, projectName: data.project_name, scopedTeamId: explicitTeam?.team_id });
  if (!projectResult.success) return { success: false, error: projectResult.error, warnings: data.warnings.length ? data.warnings : undefined };
  data.warnings.push(...projectResult.warnings);

  const effectiveTeam = await resolveEffectiveTeam(explicitTeam, projectResult.value, data);
  if (!effectiveTeam.success) {
    return { success: false, error: effectiveTeam.error, warnings: effectiveTeam.warnings };
  }
  return { success: true, data: { team: effectiveTeam.data!, project: projectResult.value }, warnings: data.warnings.length ? data.warnings : undefined };
}

async function resolveEffectiveTeam(
  explicitTeam: IrisTeam | null,
  project: IrisProject | null,
  data: { team_id?: string; team_name?: string; warnings: string[] },
): Promise<MutationResult<IrisTeam>> {
  if (project?.team_id) {
    const projectTeam = (await getTeams()).find((team) => team.team_id === project.team_id) || null;
    if (!projectTeam) return { success: false, error: 'El proyecto seleccionado no tiene un equipo valido en IRIS.' };
    if (explicitTeam && explicitTeam.team_id !== projectTeam.team_id) {
      return { success: false, error: `El proyecto "${project.project_name}" pertenece al equipo "${projectTeam.name}" y no al equipo "${explicitTeam.name}".` };
    }
    return { success: true, data: projectTeam };
  }
  if (explicitTeam) return { success: true, data: explicitTeam };

  const teamResult = await resolveTeamReference(
    { teamId: data.team_id, teamName: data.team_name },
    { allowSingleTeamDefault: true, missingMessage: 'Debes indicar el equipo donde se va a crear la tarea.' },
  );
  if (!teamResult.success) return { success: false, error: teamResult.error, warnings: data.warnings.length ? data.warnings : undefined };
  data.warnings.push(...teamResult.warnings);
  return { success: true, data: teamResult.value };
}
