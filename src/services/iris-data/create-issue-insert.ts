import { irisSupa } from '../../lib/iris-client';
import { getNextIssueNumber } from './issues';
import type { IrisIssue, MutationResult } from './types';

export async function insertIssueWithRetry(
  insertBase: Record<string, any>,
  teamId: string,
  warnings: string[],
): Promise<MutationResult<IrisIssue>> {
  let lastError: any = null;
  let collisionWarningAdded = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const issueNumber = await getNextIssueNumber(teamId);
    const response = await irisSupa!
      .from('task_issues')
      .insert({ ...insertBase, issue_number: issueNumber })
      .select('*, status:task_statuses(*), priority:task_priorities(*)')
      .single();
    if (!response.error) {
      return { success: true, data: response.data as IrisIssue, warnings: warnings.length ? warnings : undefined };
    }
    lastError = response.error;
    const duplicateIssueNumber =
      response.error.code === '23505' &&
      `${response.error.message || ''} ${response.error.details || ''}`.toLowerCase().includes('issue_number');
    if (!duplicateIssueNumber || attempt >= 3) {
      return { success: false, error: response.error.message, warnings: warnings.length ? warnings : undefined };
    }
    if (!collisionWarningAdded) {
      warnings.push('Hubo una colision temporal al asignar el numero de issue y se reintento la creacion.');
      collisionWarningAdded = true;
    }
  }
  return { success: false, error: lastError?.message || 'No se pudo crear la tarea en IRIS.', warnings: warnings.length ? warnings : undefined };
}
