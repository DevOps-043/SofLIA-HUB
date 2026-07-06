import { getErrorMessage } from './error-utils';
import { buildMaxStepsResult, updateRecoveryScreenHash } from './task-loop-helpers';
import { runDesktopAgentActionAttempt } from './task-execution-action';
import { handleDesktopAgentReportedFailure } from './task-execution-failure';
import { finishDesktopAgentRuntimeTask, startDesktopAgentRuntimeTask } from './task-execution-state';
import { resolveTaskStepBudget } from './task-budget';
import { buildTaskOutcome, type DesktopTaskOutcome } from './task-outcome';
import { ensureTargetWindowLock } from './window-lock';
import type { DesktopActionPayload } from '../desktop-agent-types';
import type {
  DesktopTaskExecutionOptions,
} from './types';

export async function runDesktopAgentTaskInternal(
  service: any,
  task: string,
  options?: DesktopTaskExecutionOptions,
): Promise<DesktopTaskOutcome> {
  const { taskId, taskAbort, agentTask } = startDesktopAgentRuntimeTask(service, task, options);
  let maxSteps: number = agentTask.maxSteps;

  const outcome = async (estado: DesktopTaskOutcome['estado'], mensaje: string): Promise<DesktopTaskOutcome> => buildTaskOutcome({
    taskId,
    estado,
    mensaje,
    pasosEjecutados: service.currentStep,
    startedAt: agentTask.startedAt,
    ultimaVentana: await readActiveWindowTitle(service),
  });

  try {
    if (service.config.planningEnabled) {
      service.status = 'planning';
      const screenshot = await service.takeScreenshot();
      service.currentPlan = await service.createPlan(task, screenshot);
      service.emit('plan-created', service.currentPlan);
      console.log(`[DesktopAgent] Plan: ${service.currentPlan.subGoals.length} sub-objetivos, ~${service.currentPlan.estimatedSteps} pasos`);
    }

    // Presupuesto proporcional a la complejidad estimada, acotado por el tope duro.
    maxSteps = resolveTaskStepBudget({
      requestedMaxSteps: options?.maxSteps,
      planEstimatedSteps: service.currentPlan?.estimatedSteps ?? null,
      task,
      config: service.config,
    });
    agentTask.maxSteps = maxSteps;
    console.log(`[DesktopAgent] Presupuesto de pasos para [${taskId}]: ${maxSteps}`);

    service.status = 'executing';
    for (service.currentStep = 0; service.currentStep < maxSteps; service.currentStep++) {
      agentTask.currentStep = service.currentStep;
      if (taskAbort.signal.aborted) return outcome('cancelada', 'Tarea cancelada por el usuario.');
      if (service.currentStep > 0 && service.currentStep % service.config.summarizeEveryNSteps === 0) await service.summarizeHistory();
      // Refresco barato del contexto de entorno (ventanas abiertas) para que el modelo no persiga apps ya visibles.
      if (service.config.environmentContextEnabled
        && service.currentStep % Math.max(1, service.config.environmentRefreshEveryNSteps) === 0
        && (service.currentStep > 0 || !service.environmentContextText)) {
        await service.refreshEnvironmentContext();
      }
      if (service.strategicPlan && service.currentStep > 0 && service.currentStep % 10 === 0) await service.checkPhaseCompletion(task);

      await ensureTargetWindowLock(service);
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
            return outcome('fallida', `Error persistente al analizar la pantalla después de ${service.currentStep} pasos.`);
          }
          continue;
        }
      }

      service.emit('step', { step: service.currentStep + 1, maxSteps, action: actionPayload });
      console.log(`[DesktopAgent] Paso ${service.currentStep + 1}: ${actionPayload.action} — ${actionPayload.message}`);
      if (actionPayload.action === 'done') {
        const msg = actionPayload.message || 'Tarea completada.';
        agentTask.result = msg;
        service.emit('task-completed', { task, message: msg, steps: service.currentStep + 1, recoveries: service.recovery.totalRecoveries, taskId });
        return outcome('completada', msg);
      }
      if (actionPayload.action === 'fail') {
        const recovered = await handleDesktopAgentReportedFailure(service, task, screenshot, actionPayload, agentTask, taskId);
        if (recovered === true) continue;
        return outcome('fallida', recovered);
      }

      // Cancelacion entre la decision de vision y la ejecucion de la accion.
      if (taskAbort.signal.aborted) return outcome('cancelada', 'Tarea cancelada por el usuario.');

      await runDesktopAgentActionAttempt({ service, task, currentHash, actionPayload });
    }

    const lastMsg = service.actionHistory[service.actionHistory.length - 1]?.action.message || '';
    const resultMsg = buildMaxStepsResult(maxSteps, lastMsg);
    agentTask.result = resultMsg;
    service.emit('task-budget-exhausted', { taskId, maxSteps, message: resultMsg });
    return outcome('presupuesto_agotado', resultMsg);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    const stackPreview = err instanceof Error ? err.stack?.split('\n').slice(0, 3).join('\n') : undefined;
    const errorMsg = `Error en paso ${service.currentStep}: ${message}`;
    console.error(`[DesktopAgent] ? FATAL [${taskId}]:`, message, stackPreview);
    agentTask.error = errorMsg;
    service.emit('task-failed', { task, message: errorMsg, steps: service.currentStep, taskId, error: message });
    throw err;
  } finally {
    finishDesktopAgentRuntimeTask(service, agentTask, taskId);
  }
}

async function readActiveWindowTitle(service: any): Promise<string | undefined> {
  try {
    const activeWindow = await service.getActiveWindow();
    return activeWindow?.title || undefined;
  } catch {
    return undefined;
  }
}
