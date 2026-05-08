import {
  resolveAssigneeReference,
  resolvePriorityReference,
  resolveProjectReference,
  resolveStatusReference,
  resolveTeamReference,
} from './resolvers';
import { getTeams } from './teams';
import type { IrisTeam } from './types';
import type { CreateIssueParams, IssueContextResult } from './operations-write-types';

export async function resolveIssueWriteContext(params: CreateIssueParams): Promise<IssueContextResult> {
  const warnings: string[] = [];
  const explicitTeam = await resolveExplicitTeam(params, warnings);
  if (!explicitTeam.success) return explicitTeam;

  const projectResult = await resolveProjectReference({
    projectId: params.projectId,
    projectName: params.projectName,
    scopedTeamId: explicitTeam.value?.team_id,
  });
  if (!projectResult.success) return { success: false, error: projectResult.error, warnings };
  warnings.push(...projectResult.warnings);

  const teamResult = await resolveEffectiveTeam(params, explicitTeam.value, projectResult.value, warnings);
  if (!teamResult.success) return teamResult;

  const statusResult = await resolveStatusReference({
    statusId: params.statusId,
    statusName: params.statusName,
    teamId: teamResult.value.team_id,
  });
  if (!statusResult.success) return { success: false, error: statusResult.error, warnings };
  warnings.push(...statusResult.warnings);

  const priorityResult = await resolvePriorityReference({
    priorityId: params.priorityId,
    priorityName: params.priorityName,
  });
  if (!priorityResult.success) return { success: false, error: priorityResult.error, warnings };
  warnings.push(...priorityResult.warnings);

  const assigneeResult = await resolveAssigneeReference({
    assigneeId: params.assigneeId,
    assigneeQuery: params.assigneeQuery,
    teamId: teamResult.value.team_id,
  });
  if (!assigneeResult.success) return { success: false, error: assigneeResult.error, warnings };
  warnings.push(...assigneeResult.warnings);

  return {
    success: true,
    value: {
      effectiveTeam: teamResult.value,
      resolvedProject: projectResult.value,
      status: statusResult.value,
      priority: priorityResult.value,
      assignee: assigneeResult.value,
      warnings,
    },
  };
}

async function resolveExplicitTeam(params: CreateIssueParams, warnings: string[]) {
  if (!params.teamId?.trim() && !params.teamName?.trim()) return { success: true as const, value: null };
  const teamResult = await resolveTeamReference(
    { teamId: params.teamId, teamName: params.teamName },
    { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo indicado para crear la tarea.' },
  );
  if (!teamResult.success) return { success: false as const, error: teamResult.error, warnings };
  warnings.push(...teamResult.warnings);
  return { success: true as const, value: teamResult.value };
}

async function resolveEffectiveTeam(
  params: CreateIssueParams,
  explicitTeam: IrisTeam | null,
  project: { project_name?: string; team_id?: string } | null,
  warnings: string[],
): Promise<{ success: true; value: IrisTeam } | { success: false; error: string; warnings?: string[] }> {
  if (project?.team_id) return resolveProjectTeam(project, explicitTeam, warnings);
  if (explicitTeam) return { success: true, value: explicitTeam };

  const teamResult = await resolveTeamReference(
    { teamId: params.teamId, teamName: params.teamName },
    { allowSingleTeamDefault: true, missingMessage: 'Debes indicar el equipo donde se va a crear la tarea.' },
  );
  if (!teamResult.success) return { success: false, error: teamResult.error, warnings };
  warnings.push(...teamResult.warnings);
  return { success: true, value: teamResult.value };
}

async function resolveProjectTeam(
  project: { project_name?: string; team_id?: string },
  explicitTeam: IrisTeam | null,
  warnings: string[],
) {
  const projectTeam = (await getTeams()).find((team) => team.team_id === project.team_id) || null;
  if (!projectTeam) return { success: false as const, error: 'El proyecto seleccionado no tiene un equipo valido en IRIS.', warnings };
  if (explicitTeam && explicitTeam.team_id !== projectTeam.team_id) {
    const error = `El proyecto "${project.project_name}" pertenece al equipo "${projectTeam.name}" y no al equipo "${explicitTeam.name}".`;
    return { success: false as const, error, warnings };
  }
  return { success: true as const, value: projectTeam };
}
