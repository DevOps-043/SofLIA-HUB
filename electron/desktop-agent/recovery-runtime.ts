import type { DesktopInference } from './inference';
import type {
  ActionHistoryEntry,
  DesktopActionPayload,
  DesktopAgentConfig,
  RecoveryContext,
  TaskPlan,
} from '../desktop-agent-types';
import { buildRecoveryPrompt } from './recovery-prompt';
import { parseVisionResponse } from './parsers';
import { isKnownDesktopAction } from './action-types';

export type RecoveryStrategyPayload = DesktopActionPayload & {
  strategy?: string;
  reasoning?: string;
  actions?: DesktopActionPayload[];
  newSubGoals?: string[];
};

export async function executeProactiveRecovery(input: {
  task: string;
  screenshotBase64: string;
  reason: 'stuck' | 'fail' | 'failures';
  failMessage?: string;
  ai: DesktopInference;
  config: DesktopAgentConfig;
  currentPlan: TaskPlan | null;
  actionHistory: ActionHistoryEntry[];
  recovery: RecoveryContext;
  currentStep: number;
  abortSignal: AbortSignal | null;
  emit: (eventName: string, payload?: unknown) => void;
  setStatus: (status: 'executing' | 'recovering') => void;
  executeAction: (action: DesktopActionPayload) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  getErrorMessage: (error: unknown) => string;
}): Promise<boolean> {
  input.setStatus('recovering');
  input.recovery.totalRecoveries++;
  input.recovery.lastRecoveryStep = input.currentStep;
  input.emit('recovery-started', {
    reason: input.reason,
    step: input.currentStep,
    totalRecoveries: input.recovery.totalRecoveries,
  });

  try {
    const prompt = buildRecoveryPrompt({
      task: input.task,
      currentPlan: input.currentPlan,
      actionHistory: input.actionHistory,
      recovery: input.recovery,
      currentStep: input.currentStep,
      config: input.config,
      reason: input.reason,
      failMessage: input.failMessage,
    });
    const result = await input.ai(prompt, {
      images: [`data:image/png;base64,${input.screenshotBase64}`], json: true, signal: input.abortSignal ?? undefined,
    });
    if (input.abortSignal?.aborted) return false;
    const parsed = parseVisionResponse(result) as RecoveryStrategyPayload;
    input.emit('recovery-strategy', { strategy: parsed.strategy, reasoning: parsed.reasoning });

    for (const action of (Array.isArray(parsed.actions) ? parsed.actions : []).slice(0, 5)) {
      if (input.abortSignal?.aborted) return false;
      if (!isValidRecoveryAction(action)) {
        console.warn(`[DesktopAgent] Recovery rechazo accion desconocida: ${JSON.stringify(action)}`);
        continue;
      }
      try {
        await input.executeAction(action);
        input.actionHistory.push({
          step: input.currentStep,
          action,
          timestamp: Date.now(),
          success: true,
          wasRecovery: true,
        });
        await input.delay(500);
      } catch (error: unknown) {
        console.warn(`[DesktopAgent] Recovery action failed: ${input.getErrorMessage(error)}`);
      }
    }

    if (parsed.strategy === 'replan' && Array.isArray(parsed.newSubGoals) && parsed.newSubGoals.length > 0 && input.currentPlan) {
      input.currentPlan.subGoals = parsed.newSubGoals;
      input.currentPlan.currentSubGoalIndex = 0;
      input.currentPlan.replannedCount++;
      input.emit('plan-updated', input.currentPlan);
    }

    input.setStatus('executing');
    return true;
  } catch (error: unknown) {
    console.error('[DesktopAgent] Recovery fallo:', input.getErrorMessage(error));
    input.setStatus('executing');
    return false;
  }
}

function isValidRecoveryAction(action: DesktopActionPayload): boolean {
  return Boolean(action && isKnownDesktopAction(action.action));
}
