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

  it('stores one-shot passive workflows with their scheduled date', async () => {
    const { service, taskScheduler } = createWorkflowHubTestService();
    const rule = service.savePassiveRule({
      name: 'Noticias puntuales',
      prompt: 'Dame las noticias relevantes de IA',
      cronExpression: '30 9 28 5 *',
      scheduleLabel: 'El 28/05/2026 a las 09:30',
      runOnce: true,
      scheduledFor: '2026-05-28T09:30:00',
      requestedBy: 'app:whatsapp:5215500000000',
      phoneNumber: '5215500000000',
      executionMode: 'agent_prompt',
    });

    expect(taskScheduler.upsertTask).toHaveBeenCalledWith(expect.objectContaining({
      runOnce: true,
      scheduledFor: '2026-05-28T09:30:00',
    }));

    const scheduled = (await service.getOverview()).passiveRules.find((item) => item.id === rule.id);
    expect(scheduled?.runOnce).toBe(true);
    expect(scheduled?.scheduledFor).toBe('2026-05-28T09:30:00');
  });
}
