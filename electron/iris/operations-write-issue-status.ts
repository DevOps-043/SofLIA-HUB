import { getIrisClient } from './clients';
import { fetchStatusesByTeamId } from './statuses';

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
    const issueRef = await resolveIssueRef(iris, params);
    if (!issueRef.issueId) return { success: false, error: 'No se encontró la tarea especificada.' };

    const statusId = await resolveTargetStatus(params, issueRef.teamId);
    if (!statusId) return { success: false, error: 'No se encontró el estado especificado.' };

    const updateData = await buildIssueStatusUpdate(statusId, issueRef.teamId);
    const { data, error } = await iris
      .from('task_issues')
      .update(updateData)
      .eq('issue_id', issueRef.issueId)
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

async function resolveIssueRef(iris: any, params: { issueId?: string; issueNumber?: number; teamId?: string }) {
  let issueId = params.issueId;
  let teamId = params.teamId;

  if (!issueId && params.issueNumber) {
    let query = iris.from('task_issues').select('issue_id, team_id').eq('issue_number', params.issueNumber);
    if (teamId) query = query.eq('team_id', teamId);
    const { data: found } = await query.limit(1).single();
    if (found) {
      issueId = found.issue_id;
      teamId = found.team_id;
    }
  }

  return { issueId, teamId };
}

async function resolveTargetStatus(
  params: { newStatusId?: string; newStatusName?: string },
  teamId?: string,
): Promise<string | undefined> {
  if (params.newStatusId) return params.newStatusId;
  if (!params.newStatusName || !teamId) return undefined;

  const target = params.newStatusName.toLowerCase();
  const match = (await fetchStatusesByTeamId(teamId)).find(
    (status) => status.name.toLowerCase() === target || status.status_type.toLowerCase() === target,
  );
  return match?.status_id;
}

async function buildIssueStatusUpdate(statusId: string, teamId?: string): Promise<Record<string, unknown>> {
  const updateData: Record<string, unknown> = { status_id: statusId, updated_at: new Date().toISOString() };
  if (!teamId) return updateData;

  const targetStatus = (await fetchStatusesByTeamId(teamId)).find((status) => status.status_id === statusId);
  if (targetStatus?.status_type === 'done') updateData.completed_at = new Date().toISOString();
  if (targetStatus?.status_type === 'in_progress' || targetStatus?.status_type === 'in_review') {
    updateData.started_at = new Date().toISOString();
  }
  return updateData;
}
