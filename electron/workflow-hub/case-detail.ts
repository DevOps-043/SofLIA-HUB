import { parseCaseId } from './normalizers';
import type { WorkflowCaseDetail } from './types';
import type { WorkflowHubServiceContext } from './service-context';
import { mapAutomationRunToDetail } from './case-mappers';
import { mapMeetingRunToDetail } from './meeting-case-mapper';

export async function getCaseDetail(
  ctx: WorkflowHubServiceContext,
  caseId: string,
): Promise<WorkflowCaseDetail> {
  const resolved = parseCaseId(caseId);
  if (resolved.engine === 'automation') {
    const run = ctx.deps.workspaceAutomationService.getRun(resolved.nativeId);
    return mapAutomationRunToDetail(ctx, run);
  }

  const detail = await ctx.deps.meetingWorkflowService.getRunDetail(resolved.nativeId);
  return mapMeetingRunToDetail(ctx, detail);
}
