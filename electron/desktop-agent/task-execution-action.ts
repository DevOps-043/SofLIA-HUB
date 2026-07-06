import { runDesktopActionWithRetry } from './desktop-action-runner';
import { getErrorMessage } from './error-utils';
import { applyPlanSubGoalProgress } from './task-loop-helpers';
import { inferTargetWindowLock } from './window-lock';
import type { DesktopActionPayload, FailedActionTargetMemory, ResolvedActionTarget } from '../desktop-agent-types';

const RAW_POINT_ACTIONS = new Set(['click', 'double_click', 'right_click', 'type']);
const UNSAFE_FALLBACK_RADIUS_PX = 110;
/** Radio (imagen) para considerar que un zoom "cubre" el punto bloqueado. */
const ZOOM_ESCAPE_RADIUS_PX = 160;

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
    takeScreenshotRaw: () => service.takeScreenshotForVerification(),
    quickHash: (base64) => service.quickHash(base64),
    getErrorMessage,
    consumeResolvedTarget: () => {
      const target = service.lastResolvedActionTarget ?? null;
      service.lastResolvedActionTarget = null;
      return target;
    },
    rememberFailedTarget: (target, action, reason) => {
      const ttlSteps = 3;
      service.failedActionTargets = [
        ...(Array.isArray(service.failedActionTargets) ? service.failedActionTargets : []),
        {
          ...target,
          action: action.action,
          failedAtStep: service.currentStep,
          expiresAtStep: service.currentStep + ttlSteps,
          reason,
        },
      ].slice(-20);
    },
    rejectUnsafeAction: (action) => rejectUnsafeCoordinateFallback(service, action),
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
    const lock = inferTargetWindowLock(actionPayload, service.currentStep);
    if (lock) {
      service.targetWindowLock = lock;
      // Permite que el proximo paso verifique/re-enfoque de inmediato el nuevo lock.
      service.lastWindowRefocusStep = -100;
      console.log('[DesktopAgent] Window lock establecido:', JSON.stringify(lock));
    }
  }

  applyPlanSubGoalProgress(service.currentPlan, actionPayload);
  await service.smartDelay(actionPayload);
}

export function rejectUnsafeCoordinateFallback(service: any, action: DesktopActionPayload): string | null {
  if (!RAW_POINT_ACTIONS.has(action.action)) return null;
  if (action.x === undefined || action.y === undefined) return null;

  const currentStep = Number(service.currentStep || 0);
  const memory: FailedActionTargetMemory[] = Array.isArray(service.failedActionTargets) ? service.failedActionTargets : [];
  service.failedActionTargets = memory.filter((target) => target.expiresAtStep >= currentStep);

  const blocked = service.failedActionTargets.find((target: FailedActionTargetMemory) => {
    if (target.action !== 'click_element_by_name') return false;
    const point = target.centroImagen;
    if (!point) return false;
    return Math.hypot(point.x - action.x!, point.y - action.y!) <= UNSAFE_FALLBACK_RADIUS_PX;
  }) as FailedActionTargetMemory | undefined;

  if (!blocked) return null;

  // Escapes (autonomia): el bloqueo NUNCA debe atrapar al agente en un boton
  // visible. Se libera cuando el click deja de ser "ciego":
  //  1) el objetivo ya tiene una marca [N] del Set-of-Marks encima (el modelo
  //     deberia usar click_element, pero un click crudo ahi es legitimo), o
  //  2) el modelo hizo zoom sobre esa region DESPUES del fallo (miro de cerca).
  if (pointOverlapsAnyMark(service, action.x, action.y)) return null;
  const zoom = service.lastZoomAt as { x: number; y: number; step: number } | null | undefined;
  if (zoom && zoom.step >= blocked.failedAtStep
    && Math.hypot(zoom.x - action.x, zoom.y - action.y) <= ZOOM_ESCAPE_RADIUS_PX) {
    return null;
  }

  const label = describeBlockedTarget(blocked);
  return `Click crudo bloqueado: coincide con target semantico fallido ${label}. Usa click_element con elementId, o haz zoom sobre el boton antes de reintentar el click.`;
}

/** True si alguna marca [N] actual del Set-of-Marks cubre el punto (espacio IMAGEN). */
function pointOverlapsAnyMark(service: any, x: number, y: number): boolean {
  const elements = Array.isArray(service.currentUIElements) ? service.currentUIElements : [];
  for (const element of elements) {
    const rect = service.mapDesktopRectToScreenshotRect?.(element.boundingRect);
    if (rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
      return true;
    }
  }
  return false;
}

function describeBlockedTarget(target: ResolvedActionTarget): string {
  const text = target.text ? `"${target.text}"` : 'sin texto';
  const point = target.centroImagen
    ? ` en imagen (${Math.round(target.centroImagen.x)}, ${Math.round(target.centroImagen.y)})`
    : '';
  return `${text}${point}`;
}
