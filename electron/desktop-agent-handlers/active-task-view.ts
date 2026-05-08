import type { DesktopAgentService } from '../desktop-agent-service';

export function buildActiveTaskViews(agentService: DesktopAgentService) {
  const desktopTasks = agentService.getActiveTasks().map((task) => ({
    id: task.id,
    task: task.task,
    status: task.status,
    currentStep: task.currentStep,
    maxSteps: task.maxSteps,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    result: task.result,
    error: task.error,
    backend: 'desktop_visual',
    currentUrl: null,
  }));

  const taskIds = new Set(desktopTasks.map((task) => task.id));
  const browserTasks = agentService.getStatus().activeTasks
    .filter((task) => !taskIds.has(task.id))
    .map((task) => ({
      id: task.id,
      task: task.task,
      status: task.status,
      currentStep: task.step,
      maxSteps: task.maxSteps,
      startedAt: undefined,
      completedAt: undefined,
      result: undefined,
      error: undefined,
      backend: task.backend || 'browser_web',
      currentUrl: task.currentUrl || null,
    }));

  return [...desktopTasks, ...browserTasks];
}
