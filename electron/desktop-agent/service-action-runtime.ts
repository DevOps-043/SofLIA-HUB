import { applySmartActionDelay } from './action-delay';
import { executeDesktopAction } from './action-executor';
import type { ClickByTextResult } from './action-executor-context';
import { openApplicationDeterministic, openUrlDeterministic } from './deterministic-actions';
import {
  createOcrLocatorProvider,
  createUiaLocatorProvider,
  ElementLocator,
  type BlockedTarget,
  type ElementLocatorProvider,
} from './element-locator';
import { PowerShellWorker } from './native-worker/powershell-worker';
import { extractTextBoxesFromBase64 } from '../ocr-service';
import { dipToScreenPoint, mapScreenshotToDipPoint } from './screenshot-coordinates';
import { executeProactiveRecovery } from './recovery-runtime';
import type { DesktopActionPayload, FailedActionTargetMemory, ResolvedActionTarget } from '../desktop-agent-types';
import { getErrorMessage } from './error-utils';

function ensureUiaWorker(service: any): PowerShellWorker {
  if (!service.uiaWorker) service.uiaWorker = new PowerShellWorker();
  return service.uiaWorker;
}

async function clickElementByTextForService(
  service: any,
  elementName: string,
  doubleClick: boolean,
  hintImagen?: { x: number; y: number },
): Promise<ClickByTextResult> {
  const bloqueados = buildBlockedTargets(service, elementName);
  const providers: ElementLocatorProvider[] = [];

  if (process.platform === 'win32' && service.config.uiaWorkerEnabled !== false) {
    providers.push(createUiaLocatorProvider({
      worker: ensureUiaWorker(service),
      sparseThreshold: service.config.uiaSparseThreshold,
      wakeDelayMs: service.config.uiaWakeDelayMs,
      mapFisicoAImagen: (x, y) => service.mapDesktopPointToScreenshotPoint(x, y),
    }));
  }

  providers.push(createOcrLocatorProvider({
    capturarPantalla: async () => {
      const edge = service.config.ocrCaptureEdge || service.config.screenshotWidth;
      const captura = service.lastDecisionCapture
        ?? await service.captureCompositeScreenshot(edge, edge, { purpose: 'verification' });
      return { base64: captura.base64, layout: captura.layout };
    },
    reconocerTextos: (base64) => extractTextBoxesFromBase64(base64),
    mapImagenADip: (x, y, layout) => mapScreenshotToDipPoint(x, y, layout),
    dipAFisico: (punto) => dipToScreenPoint(punto),
  }));

  const locator = new ElementLocator(providers);
  const { elemento, intentos } = await locator.localizarPorTexto(elementName, {
    pista: hintImagen,
    bloqueados,
  });
  if (!elemento) return { found: false, intentos };

  const resolvedTarget: ResolvedActionTarget = {
    kind: 'text',
    text: elemento.texto,
    source: elemento.fuente,
    centroFisico: elemento.centroFisico,
    centroImagen: elemento.centroImagen,
    bboxFisico: elemento.bboxFisico,
    bboxImagen: elemento.bboxImagen,
    textScore: elemento.textScore,
    spatialScore: elemento.spatialScore,
    rankingReason: elemento.rankingReason,
  };

  console.log('[DesktopAgent] Target locator:', JSON.stringify({
    action: 'click_element_by_name',
    query: elementName,
    selectedText: elemento.texto,
    source: elemento.fuente,
    hintImagen,
    centroImagen: elemento.centroImagen,
    centroFisico: elemento.centroFisico,
    textScore: elemento.textScore,
    spatialScore: Number(elemento.spatialScore.toFixed(3)),
    rankingReason: elemento.rankingReason,
    blockedCandidates: bloqueados.length,
  }));

  if (doubleClick) {
    await service.mouseControls.doubleClickAtPhysicalPoint(elemento.centroFisico.x, elemento.centroFisico.y);
  } else {
    await service.mouseControls.clickAtPhysicalPoint(elemento.centroFisico.x, elemento.centroFisico.y);
  }

  return {
    found: true,
    fuente: elemento.fuente,
    texto: elemento.texto,
    x: elemento.centroFisico.x,
    y: elemento.centroFisico.y,
    resolvedTarget,
    intentos,
  };
}

function buildBlockedTargets(service: any, elementName: string): BlockedTarget[] {
  const currentStep = Number(service.currentStep || 0);
  const memory: FailedActionTargetMemory[] = Array.isArray(service.failedActionTargets) ? service.failedActionTargets : [];
  service.failedActionTargets = memory.filter((target) => target.expiresAtStep >= currentStep);
  return service.failedActionTargets
    .filter((target: FailedActionTargetMemory) => target.action === 'click_element_by_name')
    .map((target: FailedActionTargetMemory) => ({
      texto: target.text || elementName,
      centroImagen: target.centroImagen,
      centroFisico: target.centroFisico,
      reason: target.reason,
    }));
}

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
  service.lastResolvedActionTarget = null;
  await executeDesktopAction(action, {
    config: service.config,
    getUIElements: () => service.currentUIElements,
    setLastZoomImage: (image) => { service.lastZoomImage = image; },
    recordZoom: (x, y) => { service.lastZoomAt = { x, y, step: service.currentStep }; },
    refineActionCoordinates: (nextAction) => service.refineActionCoordinates(nextAction),
    logActionCoordinateResolution: (nextAction) => service.logActionCoordinateResolution(nextAction),
    assertActionTargetsVisibleContent: (nextAction) => service.assertActionTargetsVisibleContent(nextAction),
    setResolvedTarget: (target) => { service.lastResolvedActionTarget = target; },
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
    openApplication: (appName) => openApplicationDeterministic(appName),
    openUrl: (url) => openUrlDeterministic(url),
    clickElementByName: (elementName, doubleClick, hint) =>
      clickElementByTextForService(service, elementName, doubleClick === true, hint),
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
