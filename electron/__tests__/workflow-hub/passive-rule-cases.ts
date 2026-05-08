import { expect, it } from 'vitest';
import { createWorkflowHubTestService } from './service-factory';

export function registerWorkflowHubPassiveRuleCases(): void {
  it('stores passive workflows on the scheduler and returns them in the overview', async () => {
    const { service, taskScheduler } = createWorkflowHubTestService();
    const rule = service.savePassiveRule({
      workflowId: 'correo',
      name: 'Correos 8 AM',
      description: 'Resumen diario de correo',
      cronExpression: '0 8 * * 1-5',
      scheduleLabel: 'Lunes a viernes a las 08:00',
      config: { preset: 'priority', maxResults: 3 },
      requestedBy: 'app:user_1',
      executionMode: 'workflow',
    });

    expect(taskScheduler.upsertTask).toHaveBeenCalledWith(expect.objectContaining({
      workflowId: 'correo',
      executionMode: 'workflow',
      workflowInput: expect.objectContaining({ preset: 'priority', maxResults: 3 }),
    }));
    expect(rule.workflowId).toBe('correo');

    const scheduled = (await service.getOverview()).passiveRules.find((item) => item.id === rule.id);
    expect(scheduled?.name).toBe('Correos 8 AM');
    expect(scheduled?.scheduleLabel).toBe('Lunes a viernes a las 08:00');
  });
}
