import type {
  ActionHistoryEntry,
  DesktopActionPayload,
  DesktopAgentConfig,
  RecoveryContext,
} from '../desktop-agent-types';

const SCREEN_CHANGING_ACTIONS = new Set([
  'click',
  'double_click',
  'right_click',
  'type',
  'key',
  'drag',
  'click_element',
  'type_in_element',
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
}): Promise<{ action: DesktopActionPayload; entry: ActionHistoryEntry; actionSuccess: boolean }> {
  let action = input.refineAction(input.action);
  const entry: ActionHistoryEntry = {
    step: input.currentStep,
    action,
    screenshotHash: input.currentHash,
    timestamp: Date.now(),
    success: true,
  };

  let actionSuccess = false;
  for (let retry = 0; retry <= input.config.maxRetryPerAction; retry++) {
    try {
      await input.executeAction(action);
      actionSuccess = true;
      break;
    } catch (error: unknown) {
      const message = input.getErrorMessage(error);
      console.warn(`[DesktopAgent] Error ejecutando ${action.action} (intento ${retry + 1}):`, message);
      entry.errorMessage = message;
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
        input.recovery.consecutiveFailures++;
      }
    } catch (error: unknown) {
      console.warn('[DesktopAgent] Verificacion post-accion fallo:', input.getErrorMessage(error));
    }
  }

  return { action, entry, actionSuccess };
}
