import { WORKFLOW_DEFINITIONS } from './definitions';
import { getWorkspaceCapabilitiesSnapshot } from './capabilities-snapshot';
import { getSafeMeetingContext } from './meeting-context';
import { getSystemPassiveRules, mapScheduledTaskToPassiveRule } from './passive-rule-mappers';
import type { WorkflowHubOverview } from './types';
import type { WorkflowHubServiceContext } from './service-context';
import { mapAutomationRunToSummary, mapMeetingRunToSummary } from './case-mappers';

export async function getOverview(ctx: WorkflowHubServiceContext): Promise<WorkflowHubOverview> {
  const [capabilitySnapshot, meetingContext] = await Promise.all([
    getWorkspaceCapabilitiesSnapshot(ctx.deps),
    getSafeMeetingContext(ctx.deps.meetingWorkflowService),
  ]);
  const templates = ctx.deps.workspaceAutomationService.listTemplates();
  const automationRuns = ctx.deps.workspaceAutomationService.listRuns(100);
  const meetingRuns = await ctx.deps.meetingWorkflowService.listRuns({ limit: 100 });

  const legacyCustomTemplates = templates
    .filter((template) => template.kind === 'custom')
    .map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      createdAt: template.createdAt,
    }));
  const cases = [
    ...automationRuns
      .filter((run) => !run.templateId.startsWith('custom_'))
      .map((run) => mapAutomationRunToSummary(ctx, run)),
    ...meetingRuns.map((run) => mapMeetingRunToSummary(ctx, run)),
  ].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  const passiveRules = [
    ...ctx.deps.taskScheduler.getTasks().map((task) => mapScheduledTaskToPassiveRule(task, ctx.getWorkflowDefinition.bind(ctx))),
    ...getSystemPassiveRules(capabilitySnapshot.capabilities, ctx.getWorkflowDefinition.bind(ctx)),
  ].sort((left, right) => {
    if (left.source === 'system' && right.source !== 'system') return -1;
    if (left.source !== 'system' && right.source === 'system') return 1;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

  return {
    workflows: structuredClone(WORKFLOW_DEFINITIONS),
    variants: structuredClone(ctx.state.variants),
    passiveRules,
    cases,
    capabilities: capabilitySnapshot.capabilities,
    gchatSpaces: capabilitySnapshot.gchatSpaces,
    meetingContext,
    legacyCustomTemplates,
  };
}
