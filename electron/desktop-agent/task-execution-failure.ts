import type { DesktopActionPayload } from '../desktop-agent-types';

export async function handleDesktopAgentReportedFailure(
  service: any,
  task: string,
  screenshot: string,
  actionPayload: DesktopActionPayload,
  agentTask: any,
  taskId: string,
): Promise<string | true> {
  console.warn(`[DesktopAgent] [${taskId}] LLM reporto fallo: ${actionPayload.message}`);
  if (service.recovery.totalRecoveries > 0 && service.currentStep - service.recovery.lastRecoveryStep < 3) {
    const msg = `Error despues de recuperacion: ${actionPayload.message}`;
    agentTask.error = msg;
    service.emit('task-failed', { message: msg, steps: service.currentStep + 1, taskId });
    return msg;
  }
  if (await service.proactiveRecovery(task, screenshot, 'fail', actionPayload.message)) return true;
  const msg = `Error: ${actionPayload.message}`;
  agentTask.error = msg;
  service.emit('task-failed', { message: msg, steps: service.currentStep + 1, taskId });
  return msg;
}
