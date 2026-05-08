import { getErrorMessage } from './error-utils';
import { buildMaxStepsResult, updateRecoveryScreenHash } from './task-loop-helpers';
import { runDesktopAgentActionAttempt } from './task-execution-action';
import { handleDesktopAgentReportedFailure } from './task-execution-failure';
import { finishDesktopAgentRuntimeTask, startDesktopAgentRuntimeTask } from './task-execution-state';
import type { DesktopActionPayload } from '../desktop-agent-types';
import type {
  DesktopTaskExecutionOptions,
} from './types';

export async function runDesktopAgentTaskInternal(
  service: any,
  task: string,
  options?: DesktopTaskExecutionOptions,
): Promise<string> {
  const { taskId, maxSteps, taskAbort, agentTask } = startDesktopAgentRuntimeTask(service, task, options);

  try {
    if (service.config.planningEnabled) {
      service.status = 'planning';
      const screenshot = await service.takeScreenshot();
      service.currentPlan = await service.createPlan(task, screenshot);
      service.emit('plan-created', service.currentPlan);
      console.log(`[DesktopAgent] Plan: ${service.currentPlan.subGoals.length} sub-objetivos, ~${service.currentPlan.estimatedSteps} pasos`);
    }

    service.status = 'executing';
    for (service.currentStep = 0; service.currentStep < maxSteps; service.currentStep++) {
      agentTask.currentStep = service.currentStep;
      if (taskAbort.signal.aborted) return 'Tarea cancelada por el usuario.';
      if (service.currentStep > 0 && service.currentStep % service.config.summarizeEveryNSteps === 0) await service.summarizeHistory();
      if (service.strategicPlan && service.currentStep > 0 && service.currentStep % 10 === 0) await service.checkPhaseCompletion(task);

      const { screenshot } = await service.takeScreenshotWithMarks();
      const currentHash = service.quickHash(screenshot);
      updateRecoveryScreenHash(service.recovery, currentHash);
      if (service.recovery.sameScreenCount >= service.config.stuckDetectionThreshold) {
        console.warn(`[DesktopAgent] ?? ATASCADO — pantalla sin cambios durante ${service.recovery.sameScreenCount} pasos`);
        service.emit('stuck-detected', { step: service.currentStep, sameScreenCount: service.recovery.sameScreenCount });
        if (service.config.replanOnStuck && await service.proactiveRecovery(task, screenshot, 'stuck')) {
          service.recovery.sameScreenCount = 0;
          continue;
        }
      }

      let actionPayload: DesktopActionPayload;
      const useRecoveryContext = service.recovery.consecutiveFailures > 0;
      try {
        actionPayload = await service.visionStep(task, screenshot, false, useRecoveryContext);
      } catch (err: unknown) {
        console.error(`[DesktopAgent] Error de visión (paso ${service.currentStep + 1}):`, getErrorMessage(err));
        try {
          await service.delay(2000);
          actionPayload = await service.visionStep(task, screenshot, true, useRecoveryContext);
        } catch {
          service.recovery.consecutiveFailures++;
          if (service.recovery.consecutiveFailures >= service.config.maxConsecutiveFailures * 2) {
            return `Error persistente al analizar la pantalla después de ${service.currentStep} pasos.`;
          }
          continue;
        }
      }

      service.emit('step', { step: service.currentStep + 1, maxSteps, action: actionPayload });
      console.log(`[DesktopAgent] Paso ${service.currentStep + 1}: ${actionPayload.action} — ${actionPayload.message}`);
      if (actionPayload.action === 'done') {
        const msg = actionPayload.message || 'Tarea completada.';
        agentTask.result = msg;
        service.emit('task-completed', { message: msg, steps: service.currentStep + 1, recoveries: service.recovery.totalRecoveries, taskId });
        return msg;
      }
      if (actionPayload.action === 'fail') {
        const recovered = await handleDesktopAgentReportedFailure(service, task, screenshot, actionPayload, agentTask, taskId);
        if (recovered === true) continue;
        return recovered;
      }

      await runDesktopAgentActionAttempt({ service, task, currentHash, actionPayload });
    }

    const lastMsg = service.actionHistory[service.actionHistory.length - 1]?.action.message || '';
    const resultMsg = buildMaxStepsResult(maxSteps, lastMsg);
    agentTask.result = resultMsg;
    return resultMsg;
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    const stackPreview = err instanceof Error ? err.stack?.split('\n').slice(0, 3).join('\n') : undefined;
    const errorMsg = `Error en paso ${service.currentStep}: ${message}`;
    console.error(`[DesktopAgent] ? FATAL [${taskId}]:`, message, stackPreview);
    agentTask.error = errorMsg;
    service.emit('task-failed', { message: errorMsg, steps: service.currentStep, taskId, error: message });
    throw err;
  } finally {
    finishDesktopAgentRuntimeTask(service, agentTask, taskId);
  }
}
