/**
 * Operaciones de escritura públicas: createIssue, updateIssueStatus,
 * createProject, updateProjectStatus.
 *
 * Cada operación:
 *  1. Resuelve refs humanas → IDs (vía `resolvers.ts`)
 *  2. Garantiza que los user IDs existan en `account_users` (FK safety)
 *  3. Construye la inserción y la ejecuta
 *  4. Reintenta con backoff si hay colisión de `issue_number` (no es atómico en BD)
 *
 * El contrato de retorno usa `{ success, error?, warnings? }` para que el
 * caller (LLM) pueda mostrar warnings al usuario sin bloquear el flujo.
 */

import {
  generateUniqueProjectKey,
  normalizeProjectKey,
} from '../../src/shared/iris-resolution';
import { getIrisClient } from './clients';
import { getNextIssueNumber } from './issues';
import {
  resolveAssigneeReference,
  resolvePriorityReference,
  resolveProjectReference,
  resolveStatusReference,
  resolveTeamReference,
} from './resolvers';
import { fetchStatusesByTeamId } from './statuses';
import { getTeams } from './teams';
import type { IrisTeam } from './types';
import { ensureUserExistsInIris } from './user-sync';
import { fetchProjectsByTeamId } from './projects';

const MAX_ISSUE_NUMBER_RETRIES = 3;

interface CreateIssueResult {
  success: boolean;
  issue?: any;
  error?: string;
  warnings?: string[];
}

export async function createIssue(params: {
  teamId?: string;
  teamName?: string;
  title: string;
  creatorId: string;
  statusId?: string;
  statusName?: string;
  priorityId?: string;
  priorityName?: string;
  projectId?: string;
  projectName?: string;
  assigneeId?: string;
  assigneeQuery?: string;
  description?: string;
  dueDate?: string;
}): Promise<CreateIssueResult> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no esta disponible.' };

  try {
    const title = params.title?.trim();
    if (!title) {
      return { success: false, error: 'La tarea necesita un titulo valido.' };
    }

    const warnings: string[] = [];

    // 1. Resolución del equipo (si se indicó explícitamente)
    let explicitTeam: IrisTeam | null = null;
    if (params.teamId?.trim() || params.teamName?.trim()) {
      const teamResolution = await resolveTeamReference(
        { teamId: params.teamId, teamName: params.teamName },
        {
          allowSingleTeamDefault: false,
          missingMessage: 'No encontre el equipo indicado para crear la tarea.',
        },
      );
      if (!teamResolution.success) {
        return { success: false, error: teamResolution.error };
      }
      explicitTeam = teamResolution.value;
      warnings.push(...teamResolution.warnings);
    }

    // 2. Resolución del proyecto y validación de coherencia con el equipo
    const projectResult = await resolveProjectReference({
      projectId: params.projectId,
      projectName: params.projectName,
      scopedTeamId: explicitTeam?.team_id,
    });
    if (!projectResult.success) {
      return { success: false, error: projectResult.error, warnings };
    }
    warnings.push(...projectResult.warnings);

    const resolvedProject = projectResult.value;
    let effectiveTeam = explicitTeam;

    if (resolvedProject?.team_id) {
      const teams = await getTeams();
      const projectTeam = teams.find((team) => team.team_id === resolvedProject.team_id) || null;
      if (!projectTeam) {
        return {
          success: false,
          error: 'El proyecto seleccionado no tiene un equipo valido en IRIS.',
          warnings,
        };
      }
      if (explicitTeam && explicitTeam.team_id !== projectTeam.team_id) {
        return {
          success: false,
          error: `El proyecto "${resolvedProject.project_name}" pertenece al equipo "${projectTeam.name}" y no al equipo "${explicitTeam.name}".`,
          warnings,
        };
      }
      effectiveTeam = projectTeam;
    }

    if (!effectiveTeam) {
      const teamResult = await resolveTeamReference(
        { teamId: params.teamId, teamName: params.teamName },
        {
          allowSingleTeamDefault: true,
          missingMessage: 'Debes indicar el equipo donde se va a crear la tarea.',
        },
      );
      if (!teamResult.success) {
        return { success: false, error: teamResult.error, warnings };
      }
      warnings.push(...teamResult.warnings);
      effectiveTeam = teamResult.value;
    }

    // 3. Resolución de status, priority y assignee
    const statusResult = await resolveStatusReference({
      statusId: params.statusId,
      statusName: params.statusName,
      teamId: effectiveTeam.team_id,
    });
    if (!statusResult.success) {
      return { success: false, error: statusResult.error, warnings };
    }
    warnings.push(...statusResult.warnings);

    const priorityResult = await resolvePriorityReference({
      priorityId: params.priorityId,
      priorityName: params.priorityName,
    });
    if (!priorityResult.success) {
      return { success: false, error: priorityResult.error, warnings };
    }
    warnings.push(...priorityResult.warnings);

    const assigneeResult = await resolveAssigneeReference({
      assigneeId: params.assigneeId,
      assigneeQuery: params.assigneeQuery,
      teamId: effectiveTeam.team_id,
    });
    if (!assigneeResult.success) {
      return { success: false, error: assigneeResult.error, warnings };
    }
    warnings.push(...assigneeResult.warnings);

    // 4. FK safety: asegurar usuarios en IRIS
    await ensureUserExistsInIris(params.creatorId);
    if (assigneeResult.value?.user_id && assigneeResult.value.user_id !== params.creatorId) {
      await ensureUserExistsInIris(assigneeResult.value.user_id);
    }

    // 5. Construir base del INSERT
    const insertBase: Record<string, unknown> = {
      team_id: effectiveTeam.team_id,
      title,
      creator_id: params.creatorId,
      status_id: statusResult.value.status_id,
    };
    if (priorityResult.value?.priority_id) insertBase.priority_id = priorityResult.value.priority_id;
    if (resolvedProject?.project_id) insertBase.project_id = resolvedProject.project_id;
    if (assigneeResult.value?.user_id) insertBase.assignee_id = assigneeResult.value.user_id;
    if (params.description?.trim()) insertBase.description = params.description.trim();
    if (params.dueDate?.trim()) insertBase.due_date = params.dueDate.trim();

    // 6. Insert con retry para colisión de issue_number
    let lastError: { code?: string; message?: string; details?: string } | null = null;
    let collisionWarningAdded = false;

    for (let attempt = 1; attempt <= MAX_ISSUE_NUMBER_RETRIES; attempt += 1) {
      const issueNumber = await getNextIssueNumber(effectiveTeam.team_id);
      const { data, error } = await iris
        .from('task_issues')
        .insert({ ...insertBase, issue_number: issueNumber })
        .select('*, status:task_statuses(*), priority:task_priorities(*)')
        .single();

      if (!error) {
        console.log(`[IRIS-Main] Issue created: #${data.issue_number} "${data.title}"`);
        return {
          success: true,
          issue: data,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }

      lastError = error;
      const duplicateIssueNumber =
        error.code === '23505' &&
        `${error.message || ''} ${error.details || ''}`.toLowerCase().includes('issue_number');

      if (duplicateIssueNumber && attempt < MAX_ISSUE_NUMBER_RETRIES) {
        if (!collisionWarningAdded) {
          warnings.push(
            'Hubo una colision temporal al asignar el numero de issue y se reintento la creacion.',
          );
          collisionWarningAdded = true;
        }
        continue;
      }

      console.error('[IRIS-Main] createIssue error:', error);
      return {
        success: false,
        error: error.message,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    return {
      success: false,
      error: lastError?.message || 'No se pudo crear la tarea en IRIS.',
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] createIssue exception:', err);
    return { success: false, error: message };
  }
}

export async function updateIssueStatus(params: {
  issueId?: string;
  issueNumber?: number;
  teamId?: string;
  newStatusId?: string;
  newStatusName?: string;
}): Promise<{ success: boolean; issue?: unknown; error?: string }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no está disponible.' };

  try {
    let issueId = params.issueId;
    let teamId = params.teamId;

    if (!issueId && params.issueNumber) {
      let query = iris
        .from('task_issues')
        .select('issue_id, team_id')
        .eq('issue_number', params.issueNumber);
      if (teamId) query = query.eq('team_id', teamId);
      const { data: found } = await query.limit(1).single();
      if (found) {
        issueId = found.issue_id;
        teamId = found.team_id;
      }
    }

    if (!issueId) {
      return { success: false, error: 'No se encontró la tarea especificada.' };
    }

    let statusId = params.newStatusId;
    if (!statusId && params.newStatusName && teamId) {
      const statuses = await fetchStatusesByTeamId(teamId);
      const target = params.newStatusName.toLowerCase();
      const match = statuses.find(
        (s) => s.name.toLowerCase() === target || s.status_type.toLowerCase() === target,
      );
      if (match) statusId = match.status_id;
    }

    if (!statusId) {
      return { success: false, error: 'No se encontró el estado especificado.' };
    }

    const updateData: Record<string, unknown> = {
      status_id: statusId,
      updated_at: new Date().toISOString(),
    };

    // Si el status target es de tipo "done", marcar completed_at; si es in_progress, started_at.
    if (teamId) {
      const statuses = await fetchStatusesByTeamId(teamId);
      const targetStatus = statuses.find((s) => s.status_id === statusId);
      if (targetStatus?.status_type === 'done') {
        updateData.completed_at = new Date().toISOString();
      } else if (
        targetStatus?.status_type === 'in_progress' ||
        targetStatus?.status_type === 'in_review'
      ) {
        updateData.started_at = new Date().toISOString();
      }
    }

    const { data, error } = await iris
      .from('task_issues')
      .update(updateData)
      .eq('issue_id', issueId)
      .select('*, status:task_statuses(*), priority:task_priorities(*)')
      .single();

    if (error) {
      console.error('[IRIS-Main] updateIssueStatus error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[IRIS-Main] Issue #${data.issue_number} status updated to "${data.status?.name}"`);
    return { success: true, issue: data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] updateIssueStatus exception:', err);
    return { success: false, error: message };
  }
}

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
    if (!projectName) {
      return { success: false, error: 'El proyecto necesita un nombre valido.' };
    }

    const warnings: string[] = [];

    const teamResult = await resolveTeamReference(
      { teamId: params.teamId, teamName: params.teamName },
      {
        allowSingleTeamDefault: true,
        missingMessage: 'Debes indicar el equipo donde se va a crear el proyecto.',
      },
    );
    if (!teamResult.success) {
      return { success: false, error: teamResult.error };
    }
    warnings.push(...teamResult.warnings);

    await ensureUserExistsInIris(params.createdByUserId);

    const existingProjects = await fetchProjectsByTeamId(teamResult.value.team_id);
    const normalizedRequestedKey = normalizeProjectKey(params.projectKey);
    const projectKey = generateUniqueProjectKey(
      projectName,
      existingProjects.map((project) => project.project_key),
      params.projectKey,
    );

    if (!normalizedRequestedKey) {
      warnings.push(`Se genero automaticamente la clave del proyecto: ${projectKey}.`);
    } else if (projectKey !== normalizedRequestedKey) {
      warnings.push(
        `La clave ${normalizedRequestedKey} ya estaba en uso y se genero ${projectKey}.`,
      );
    }

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

    const { data, error } = await iris
      .from('pm_projects')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      console.error('[IRIS-Main] createProject error:', error);
      return {
        success: false,
        error: error.message,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    console.log(`[IRIS-Main] Project created: "${data.project_name}" [${data.project_key}]`);
    return {
      success: true,
      project: data,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] createProject exception:', err);
    return { success: false, error: message };
  }
}

export async function updateProjectStatus(params: {
  projectId: string;
  newStatus: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';
}): Promise<{ success: boolean; project?: unknown; error?: string }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no está disponible.' };

  try {
    const updateData: Record<string, unknown> = {
      project_status: params.newStatus,
      updated_at: new Date().toISOString(),
    };

    if (params.newStatus === 'completed') {
      updateData.actual_end_date = new Date().toISOString().split('T')[0];
      updateData.completion_percentage = 100;
    } else if (params.newStatus === 'archived') {
      updateData.archived_at = new Date().toISOString();
    }

    const { data, error } = await iris
      .from('pm_projects')
      .update(updateData)
      .eq('project_id', params.projectId)
      .select('*')
      .single();

    if (error) {
      console.error('[IRIS-Main] updateProjectStatus error:', error);
      return { success: false, error: error.message };
    }

    console.log(
      `[IRIS-Main] Project "${data.project_name}" status updated to "${params.newStatus}"`,
    );
    return { success: true, project: data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] updateProjectStatus exception:', err);
    return { success: false, error: message };
  }
}
