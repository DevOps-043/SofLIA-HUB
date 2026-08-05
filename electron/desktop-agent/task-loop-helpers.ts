import type { DesktopActionPayload, RecoveryContext, TaskPlan } from '../desktop-agent-types';

export function updateRecoveryScreenHash(recovery: RecoveryContext, currentHash: string): boolean {
  if (currentHash === recovery.lastScreenHash) {
    recovery.sameScreenCount++;
    return true;
  }
  recovery.sameScreenCount = 0;
  recovery.lastScreenHash = currentHash;
  return false;
}

export function applyPlanSubGoalProgress(
  currentPlan: TaskPlan | null,
  actionPayload: DesktopActionPayload,
): void {
  if (!currentPlan || !actionPayload.subGoal) return;

  const subGoal = actionPayload.subGoal.toLowerCase();
  const index = currentPlan.subGoals.findIndex((goal) => goal.toLowerCase().includes(subGoal));
  if (index >= 0 && index > currentPlan.currentSubGoalIndex) {
    currentPlan.currentSubGoalIndex = index;
  }
}

export function buildMaxStepsResult(maxSteps: number, lastMessage: string): string {
  const progress = lastMessage.trim() ? ` Último progreso: ${lastMessage.trim()}` : '';
  return `Se alcanzó el límite de ${maxSteps} pasos sin confirmar la meta.${progress} El estado actual se conserva para continuar.`;
}
