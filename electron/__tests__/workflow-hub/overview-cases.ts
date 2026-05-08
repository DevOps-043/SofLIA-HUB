import { expect, it } from 'vitest';
import { createWorkflowHubTestService } from './service-factory';

export function registerWorkflowHubOverviewCases(): void {
  it('merges builtin workflows, variants, unified cases and workspace capability diagnostics', async () => {
    const { service } = createWorkflowHubTestService();
    service.saveVariant({
      workflowId: 'correo',
      name: 'VIP',
      config: { preset: 'priority', maxResults: 99, unknownField: 'ignored' },
      createdBy: 'user_1',
    });

    const overview = await service.getOverview();

    expect(overview.workflows.some((workflow) => workflow.id === 'reuniones')).toBe(true);
    expect(overview.variants).toHaveLength(1);
    expect(overview.variants[0].config).toEqual({ preset: 'priority', query: '', maxResults: 10, gchatSpace: '', removeFromInbox: true });
    expect(overview.cases.map((item) => item.id)).toEqual(expect.arrayContaining(['automation:run_mail', 'meeting:meeting_run_1']));
    expect(overview.legacyCustomTemplates).toHaveLength(1);
    expect(overview.capabilities.find((item) => item.key === 'gchat')?.state).toBe('setup_required');
    expect(overview.capabilities.find((item) => item.key === 'google_user_mapping')?.state).toBe('blocked');
    expect(overview.passiveRules.some((rule) => rule.id === 'system:reuniones-auto')).toBe(true);
  });
}
