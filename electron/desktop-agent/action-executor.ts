import type { DesktopActionPayload } from '../desktop-agent-types';
import type { DesktopActionExecutionContext } from './action-executor-context';
import { requiredNumber, requiredString } from './action-required-fields';

type Point = { x: number; y: number };

export async function executeDesktopAction(
  inputAction: DesktopActionPayload,
  context: DesktopActionExecutionContext,
): Promise<void> {
  const action = context.refineActionCoordinates(inputAction);
  if (action.action !== 'done' && action.action !== 'fail') {
    context.logActionCoordinateResolution(action);
    context.assertActionTargetsVisibleContent(action);
  }

  switch (action.action) {
    case 'click': return context.mouseClick(requiredNumber(action.x, 'x'), requiredNumber(action.y, 'y'));
    case 'double_click': return context.mouseDoubleClick(requiredNumber(action.x, 'x'), requiredNumber(action.y, 'y'));
    case 'right_click': return context.mouseRightClick(requiredNumber(action.x, 'x'), requiredNumber(action.y, 'y'));
    case 'drag': return context.mouseDrag(requiredNumber(action.x, 'x'), requiredNumber(action.y, 'y'), requiredNumber(action.x2, 'x2'), requiredNumber(action.y2, 'y2'));
    case 'mouse_down': return context.mouseDown(requiredNumber(action.x, 'x'), requiredNumber(action.y, 'y'));
    case 'mouse_up': return context.mouseUp(action.x, action.y);
    case 'mouse_move': return context.mouseMove(requiredNumber(action.x, 'x'), requiredNumber(action.y, 'y'));
    case 'type': return typeText(action, context);
    case 'key': return context.keyboardKey(requiredString(action.key, 'key'));
    case 'scroll': return context.mouseScroll(action.direction || 'down', action.amount || 3);
    case 'focus_window': return void await context.focusWindow(action.windowTitle || '');
    case 'minimize_window': return void await context.minimizeWindow(action.windowTitle || '');
    case 'maximize_window': return void await context.maximizeWindow(action.windowTitle || '');
    case 'restore_window': return void await context.restoreWindow(action.windowTitle || '');
    case 'close_window': return void await context.closeWindow(action.windowTitle || '');
    case 'wait': return context.delay((action.amount || 2) * 1000);
    case 'wait_for_change': return void await context.waitForScreenChange((action.amount || 8) * 1000);
    case 'wait_for_window': return void await context.waitForWindow(action.windowTitle || '', (action.amount || 10) * 1000);
    case 'zoom': return captureZoom(action, context);
    case 'click_element': return clickElement(action, context);
    case 'type_in_element': return typeInElement(action, context);
  }
}

async function typeText(action: DesktopActionPayload, context: DesktopActionExecutionContext): Promise<void> {
  if (action.x !== undefined && action.y !== undefined) {
    await context.mouseClick(action.x, action.y);
    await context.delay(150);
  }
  await context.keyboardType(requiredString(action.text, 'text'));
}

async function captureZoom(action: DesktopActionPayload, context: DesktopActionExecutionContext): Promise<void> {
  const x = action.zoomX ?? action.x ?? context.config.screenshotWidth / 2;
  const y = action.zoomY ?? action.y ?? context.config.screenshotHeight / 2;
  context.setLastZoomImage(await context.takeZoomScreenshot(x, y, action.zoomRadius ?? 150));
}

async function clickElement(action: DesktopActionPayload, context: DesktopActionExecutionContext): Promise<void> {
  const point = getElementScreenshotCenter(action, context);
  if (point) await context.mouseClick(point.x, point.y);
  else if (action.x !== undefined && action.y !== undefined) await context.mouseClick(action.x, action.y);
}

async function typeInElement(action: DesktopActionPayload, context: DesktopActionExecutionContext): Promise<void> {
  const point = getElementScreenshotCenter(action, context);
  if (point) {
    await context.mouseClick(point.x, point.y);
    await context.delay(150);
  }
  if (action.text) await context.keyboardType(action.text);
}

function getElementScreenshotCenter(action: DesktopActionPayload, context: DesktopActionExecutionContext): Point | null {
  const element = context.getUIElements().find((candidate) => candidate.id === action.elementId);
  if (!element) return null;
  return context.mapDesktopPointToScreenshotPoint(
    element.boundingRect.x + element.boundingRect.width / 2,
    element.boundingRect.y + element.boundingRect.height / 2,
  );
}
