import type { DesktopActionPayload, ResolvedActionTarget } from '../desktop-agent-types';
import type { DesktopActionExecutionContext } from './action-executor-context';
import { requiredNumber, requiredString } from './action-required-fields';
import { DeterministicActionError } from './action-errors';
import { describeLocateAttempts } from './element-locator';

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
    case 'open_application': return openApplication(action, context);
    case 'open_url': return openUrl(action, context);
    case 'click_element_by_name': return clickElementByName(action, context);
    case 'zoom': return captureZoom(action, context);
    case 'click_element': return clickElement(action, context);
    case 'type_in_element': return typeInElement(action, context);
  }
}

async function openApplication(action: DesktopActionPayload, context: DesktopActionExecutionContext): Promise<void> {
  const appName = requiredString(action.appName, 'appName');
  const result = await context.openApplication(appName);
  console.log(`[DesktopAgent] Accion determinista open_application "${appName}": ${result.message}`);
  // handleOpenPath ya verifico la aparicion de la ventana; solo damos tiempo a que renderice.
  await context.delay(500);
}

async function openUrl(action: DesktopActionPayload, context: DesktopActionExecutionContext): Promise<void> {
  const url = requiredString(action.url, 'url');
  const result = await context.openUrl(url);
  console.log(`[DesktopAgent] Accion determinista open_url "${url}": ${result.message}`);
  // La URL se abre en el navegador predeterminado; esperar a que la ventana tome el frente.
  await context.waitForScreenChange((action.amount || 5) * 1000);
}

async function clickElementByName(action: DesktopActionPayload, context: DesktopActionExecutionContext): Promise<void> {
  const elementName = requiredString(action.elementName, 'elementName');
  const hint = action.x !== undefined && action.y !== undefined ? { x: action.x, y: action.y } : undefined;
  const result = await context.clickElementByName(elementName, action.amount === 2, hint);
  context.setResolvedTarget?.(result.resolvedTarget ?? null);
  if (!result.found) {
    // Ambas fuentes de medicion (accesibilidad y lectura visual OCR) fallaron:
    // el texto no esta visible tal cual en pantalla. Reintentar identico no ayuda.
    throw new DeterministicActionError(
      `No encontre el texto "${elementName}" en pantalla (${describeLocateAttempts(result.intentos)}). El texto debe estar VISIBLE: usa scroll o zoom para exponerlo, verifica el texto exacto, o usa click con coordenadas.`,
    );
  }
  console.log(
    `[DesktopAgent] click_element_by_name "${elementName}" -> "${result.texto}" via ${result.fuente} en fisico (${result.x}, ${result.y})`,
  );
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
  context.recordZoom?.(x, y);
  context.setLastZoomImage(await context.takeZoomScreenshot(x, y, action.zoomRadius ?? 150));
}

async function clickElement(action: DesktopActionPayload, context: DesktopActionExecutionContext): Promise<void> {
  const resolved = getElementTarget(action, context);
  if (resolved) {
    context.setResolvedTarget?.(resolved.target);
    await context.mouseClick(resolved.point.x, resolved.point.y);
  } else if (action.x !== undefined && action.y !== undefined) {
    context.setResolvedTarget?.({ kind: 'point', centroImagen: { x: action.x, y: action.y }, source: 'coordinate' });
    await context.mouseClick(action.x, action.y);
  }
}

async function typeInElement(action: DesktopActionPayload, context: DesktopActionExecutionContext): Promise<void> {
  const resolved = getElementTarget(action, context);
  if (resolved) {
    context.setResolvedTarget?.(resolved.target);
    await context.mouseClick(resolved.point.x, resolved.point.y);
    await context.delay(150);
  }
  if (action.text) await context.keyboardType(action.text);
}

function getElementTarget(action: DesktopActionPayload, context: DesktopActionExecutionContext): { point: Point; target: ResolvedActionTarget } | null {
  const element = context.getUIElements().find((candidate) => candidate.id === action.elementId);
  if (!element) return null;
  const physicalCenter = {
    x: element.boundingRect.x + element.boundingRect.width / 2,
    y: element.boundingRect.y + element.boundingRect.height / 2,
  };
  const point = context.mapDesktopPointToScreenshotPoint(
    element.boundingRect.x + element.boundingRect.width / 2,
    element.boundingRect.y + element.boundingRect.height / 2,
  );
  if (!point) return null;
  return {
    point,
    target: {
      kind: 'element',
      text: element.name || undefined,
      source: 'coordinate',
      centroFisico: physicalCenter,
      centroImagen: point,
      bboxFisico: element.boundingRect,
    },
  };
}
