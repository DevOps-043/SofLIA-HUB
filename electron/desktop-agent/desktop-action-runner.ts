import type {
  ActionHistoryEntry,
  DesktopActionPayload,
  DesktopAgentConfig,
  ResolvedActionTarget,
  RecoveryContext,
} from '../desktop-agent-types';
import { isDeterministicActionError } from './action-errors';

const SCREEN_CHANGING_ACTIONS = new Set([
  'click',
  'double_click',
  'right_click',
  'type',
  'key',
  'drag',
  'click_element',
  'type_in_element',
  'click_element_by_name',
]);

export async function runDesktopActionWithRetry(input: {
  action: DesktopActionPayload;
  currentStep: number;
  currentHash: string;
  config: DesktopAgentConfig;
  recovery: RecoveryContext;
  refineAction: (action: DesktopActionPayload) => DesktopActionPayload;
  executeAction: (action: DesktopActionPayload) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  takeScreenshotRaw: () => Promise<string>;
  quickHash: (base64: string) => string;
  getErrorMessage: (error: unknown) => string;
  consumeResolvedTarget?: () => ResolvedActionTarget | null;
  rememberFailedTarget?: (target: ResolvedActionTarget, action: DesktopActionPayload, reason: string) => void;
  rejectUnsafeAction?: (action: DesktopActionPayload) => string | null;
}): Promise<{ action: DesktopActionPayload; entry: ActionHistoryEntry; actionSuccess: boolean }> {
  let action = input.refineAction(input.action);
  const entry: ActionHistoryEntry = {
    step: input.currentStep,
    action,
    screenshotHash: input.currentHash,
    timestamp: Date.now(),
    success: true,
  };

  const unsafeReason = input.rejectUnsafeAction?.(action);
  if (unsafeReason) {
    entry.success = false;
    entry.errorMessage = unsafeReason;
    console.warn(`[DesktopAgent] Accion bloqueada por seguridad: ${unsafeReason}`);
    return { action, entry, actionSuccess: false };
  }

  let actionSuccess = false;
  for (let retry = 0; retry <= input.config.maxRetryPerAction; retry++) {
    try {
      await input.executeAction(action);
      entry.resolvedTarget = input.consumeResolvedTarget?.() ?? buildPointTarget(action);
      actionSuccess = true;
      break;
    } catch (error: unknown) {
      const message = input.getErrorMessage(error);
      entry.errorMessage = message;
      // Un fallo determinista (elemento/app no encontrado) no mejora al
      // reintentar: se corta de inmediato para no gastar llamadas repetidas.
      if (isDeterministicActionError(error)) {
        const failedIntent = buildFailedSemanticIntentTarget(action);
        if (failedIntent) {
          entry.resolvedTarget = failedIntent;
          input.rememberFailedTarget?.(failedIntent, action, 'deterministic_semantic_target_failed');
        }
        console.warn(`[DesktopAgent] Accion ${action.action} fallo (determinista, sin reintento):`, message);
        break;
      }
      console.warn(`[DesktopAgent] Error ejecutando ${action.action} (intento ${retry + 1}):`, message);
      if (retry < input.config.maxRetryPerAction) {
        await input.delay(300);
        if (action.x !== undefined) {
          action = { ...action, x: action.x + (retry % 2 === 0 ? 5 : -5) };
        }
      }
    }
  }

  entry.success = actionSuccess;
  if (actionSuccess && input.config.verificationEnabled && SCREEN_CHANGING_ACTIONS.has(action.action)) {
    try {
      const postHash = input.quickHash(await input.takeScreenshotRaw());
      if (postHash === input.currentHash) {
        entry.verificationFailed = true;
        if (entry.resolvedTarget) input.rememberFailedTarget?.(entry.resolvedTarget, action, 'verification_failed_same_screen');
        input.recovery.consecutiveFailures++;
      }
    } catch (error: unknown) {
      console.warn('[DesktopAgent] Verificacion post-accion fallo:', input.getErrorMessage(error));
    }
  }

  return { action, entry, actionSuccess };
}

function buildPointTarget(action: DesktopActionPayload): ResolvedActionTarget | undefined {
  if (action.x === undefined || action.y === undefined) return undefined;
  return {
    kind: 'point',
    source: 'coordinate',
    centroImagen: { x: action.x, y: action.y },
  };
}

function buildFailedSemanticIntentTarget(action: DesktopActionPayload): ResolvedActionTarget | null {
  if (action.action !== 'click_element_by_name') return null;
  if (action.x === undefined || action.y === undefined) return null;
  return {
    kind: 'text',
    text: action.elementName,
    source: 'coordinate',
    centroImagen: { x: action.x, y: action.y },
    rankingReason: 'deterministic_semantic_target_failed_near_hint',
  };
}
