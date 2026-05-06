/**
 * Repositorio de issues/tareas IRIS.
 *
 * Funciones raw — sin resolución de refs humanas.
 */

import { getIrisClient } from './clients';
import type { IrisIssue } from './types';

export interface IssueFilters {
  teamId?: string;
  projectId?: string;
  assigneeId?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 30;

export async function fetchIssues(filters?: IssueFilters): Promise<IrisIssue[]> {
  const iris = getIrisClient();
  if (!iris) return [];

  try {
    let query = iris
      .from('task_issues')
      .select('*, status:task_statuses(*), priority:task_priorities(*)')
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    if (filters?.teamId) query = query.eq('team_id', filters.teamId);
    if (filters?.projectId) query = query.eq('project_id', filters.projectId);
    if (filters?.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
    query = query.limit(filters?.limit || DEFAULT_LIMIT);

    const { data, error } = await query;
    if (error) {
      console.error('[IRIS-Main] fetchIssues error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] fetchIssues exception:', err);
    return [];
  }
}

/**
 * Devuelve el siguiente `issue_number` disponible para un equipo.
 *
 * El campo NO es auto-incremental en la BD — debe asignarlo la app.
 * Hay un riesgo conocido de colisión bajo concurrencia alta; el caller
 * debe reintentar si ve error 23505 con violation en (team_id, issue_number).
 */
export async function getNextIssueNumber(teamId: string): Promise<number> {
  const iris = getIrisClient();
  if (!iris) return 1;

  const { data } = await iris
    .from('task_issues')
    .select('issue_number')
    .eq('team_id', teamId)
    .order('issue_number', { ascending: false })
    .limit(1);

  return data && data.length > 0 ? data[0].issue_number + 1 : 1;
}
