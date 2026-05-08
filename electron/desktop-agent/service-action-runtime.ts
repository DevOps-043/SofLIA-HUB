import { applySmartActionDelay } from './action-delay';
import { executeDesktopAction } from './action-executor';
import { executeProactiveRecovery } from './recovery-runtime';
import type { DesktopActionPayload } from '../desktop-agent-types';
import { getErrorMessage } from './error-utils';

export async function runServiceProactiveRecovery(
  service: any,
  params: {
    task: string;
    screenshotBase64: string;
    reason: 'stuck' | 'fail' | 'failures';
    failMessage?: string;
  },
): Promise<boolean> {
  return executeProactiveRecovery({
    ...params,
    ai: service.getGenAI(),
    config: service.config,
    currentPlan: service.currentPlan,
    actionHistory: service.actionHistory,
    recovery: service.recovery,
    currentStep: service.currentStep,
    abortSignal: service.abortController?.signal ?? null,
    emit: (eventName, payload) => { service.emit(eventName, payload); },
    setStatus: (status) => { service.status = status; },
    executeAction: (action) => service.executeAction(action),
    delay: (ms) => service.delay(ms),
    getErrorMessage,
  });
}

export async function executeServiceDesktopAction(
  service: any,
  action: DesktopActionPayload,
): Promise<void> {
  await executeDesktopAction(action, {
    config: service.config,
    getUIElements: () => service.currentUIElements,
    setLastZoomImage: (image) => { service.lastZoomImage = image; },
    refineActionCoordinates: (nextAction) => service.refineActionCoordinates(nextAction),
    logActionCoordinateResolution: (nextAction) => service.logActionCoordinateResolution(nextAction),
    assertActionTargetsVisibleContent: (nextAction) => service.assertActionTargetsVisibleContent(nextAction),
    mouseClick: (x, y) => service.mouseClick(x, y),
    mouseDoubleClick: (x, y) => service.mouseDoubleClick(x, y),
    mouseRightClick: (x, y) => service.mouseRightClick(x, y),
    mouseDrag: (x1, y1, x2, y2) => service.mouseDrag(x1, y1, x2, y2),
    mouseDown: (x, y) => service.mouseDown(x, y),
    mouseUp: (x, y) => service.mouseUp(x, y),
    mouseMove: (x, y) => service.mouseMove(x, y),
    mouseScroll: (direction, amount) => service.mouseScroll(direction, amount),
    keyboardType: (text) => service.keyboardType(text),
    keyboardKey: (key) => service.keyboardKey(key),
    focusWindow: (title) => service.focusWindow(title),
    minimizeWindow: (title) => service.minimizeWindow(title),
    maximizeWindow: (title) => service.maximizeWindow(title),
    restoreWindow: (title) => service.restoreWindow(title),
    closeWindow: (title) => service.closeWindow(title),
    waitForScreenChange: (timeoutMs) => service.waitForScreenChange(timeoutMs),
    waitForWindow: (title, timeoutMs) => service.waitForWindow(title, timeoutMs),
    takeZoomScreenshot: (x, y, radius) => service.takeZoomScreenshot(x, y, radius),
    mapDesktopPointToScreenshotPoint: (x, y) => service.mapDesktopPointToScreenshotPoint(x, y),
    delay: (ms) => service.delay(ms),
  });
}

export async function applyServiceSmartDelay(
  service: any,
  action: DesktopActionPayload,
): Promise<void> {
  await applySmartActionDelay({
    action,
    defaultActionDelay: service.config.defaultActionDelay,
    waitForScreenChange: (timeoutMs) => service.waitForScreenChange(timeoutMs),
    delay: (ms) => service.delay(ms),
  });
}
