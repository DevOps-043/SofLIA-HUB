import { expect, it } from 'vitest';
import { createWorkflowHubTestService } from './service-factory';

export function registerWorkflowHubExecutionCases(): void {
  it('routes reuniones prep to the builtin meeting prep automation', async () => {
    const { service, executeTemplate } = createWorkflowHubTestService();
    const detail = await service.executeWorkflow({
      workflowId: 'reuniones',
      requestedBy: 'app:user_1',
      input: { mode: 'prep', targetDate: '2026-03-22' },
    });

    expect(executeTemplate).toHaveBeenCalledWith(expect.objectContaining({
      templateId: 'calendar_meeting_prep',
      input: expect.objectContaining({ targetDate: '2026-03-22' }),
    }));
    expect(detail.workflowId).toBe('reuniones');
    expect(detail.engine).toBe('automation');
  });

  it('routes reuniones manual to the rich meeting workflow service', async () => {
    const { service, createManualRun } = createWorkflowHubTestService();
    const detail = await service.executeWorkflow({
      workflowId: 'reuniones',
      requestedBy: 'app:user_1',
      input: { mode: 'manual', meetingTitle: 'Comite semanal', manualText: 'Acuerdos y tareas de la reunion' },
    });

    expect(createManualRun).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: 'user_1', meetingTitle: 'Comite semanal', text: 'Acuerdos y tareas de la reunion' }));
    expect(detail.engine).toBe('meeting');
    expect(detail.workflowId).toBe('reuniones');
  });
}
