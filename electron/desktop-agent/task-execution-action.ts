import { runDesktopActionWithRetry } from './desktop-action-runner';
import { getErrorMessage } from './error-utils';
import { applyPlanSubGoalProgress } from './task-loop-helpers';
import type { DesktopActionPayload } from '../desktop-agent-types';

export async function runDesktopAgentActionAttempt(input: {
  service: any;
  task: string;
  currentHash: string;
  actionPayload: DesktopActionPayload;
}): Promise<void> {
  const { service, task, currentHash } = input;
  let { actionPayload } = input;
  const actionRun = await runDesktopActionWithRetry({
    action: actionPayload,
    currentStep: service.currentStep,
    currentHash,
    config: service.config,
    recovery: service.recovery,
    refineAction: (action) => service.refineActionCoordinates(action),
    executeAction: (action) => service.executeAction(action),
    delay: (ms) => service.delay(ms),
    takeScreenshotRaw: () => service.takeScreenshotRaw(),
    quickHash: (base64) => service.quickHash(base64),
    getErrorMessage,
  });
  actionPayload = actionRun.action;
  service.actionHistory.push(actionRun.entry);

  if (!actionRun.actionSuccess || actionRun.entry.verificationFailed) {
    service.recovery.consecutiveFailures++;
    if (service.recovery.consecutiveFailures >= service.config.maxConsecutiveFailures) {
      console.warn(`[DesktopAgent] ?? ${service.recovery.consecutiveFailures} fallos consecutivos - activando recuperacion proactiva`);
      service.emit('consecutive-failures', { count: service.recovery.consecutiveFailures, step: service.currentStep });
      if (await service.proactiveRecovery(task, await service.takeScreenshot(), 'failures')) {
        service.recovery.consecutiveFailures = 0;
        return;
      }
    }
  } else {
    service.recovery.consecutiveFailures = 0;
  }

  applyPlanSubGoalProgress(service.currentPlan, actionPayload);
  await service.smartDelay(actionPayload);
}
