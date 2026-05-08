import type { DesktopActionPayload } from '../desktop-agent-types';

const CLICK_ACTIONS = new Set(['click', 'double_click', 'right_click', 'drag']);
const WINDOW_ACTIONS = new Set(['focus_window', 'maximize_window', 'restore_window', 'minimize_window']);

export async function applySmartActionDelay(params: {
  action: DesktopActionPayload;
  defaultActionDelay: number;
  waitForScreenChange: (timeoutMs: number) => Promise<boolean>;
  delay: (ms: number) => Promise<void>;
}): Promise<void> {
  const { action, defaultActionDelay, waitForScreenChange, delay } = params;

  if (CLICK_ACTIONS.has(action.action)) {
    await waitForScreenChange(3000);
    return;
  }

  if (action.action === 'type' || action.action === 'key') {
    await delay(defaultActionDelay);
    return;
  }

  if (WINDOW_ACTIONS.has(action.action)) {
    await delay(500);
  }
}
