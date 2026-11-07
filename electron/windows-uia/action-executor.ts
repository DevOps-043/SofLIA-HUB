import { screen as electronScreen } from 'electron';
import { assertBackendTaskActive, runBackendTaskStage } from '../desktop-agent/task-cancellation';
import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIAActionPayload, WindowsUIASnapshot } from './types';

export async function executeAction(
  service: WindowsUIAServiceCore,
  action: WindowsUIAActionPayload,
  snapshot: WindowsUIASnapshot,
  signal?: AbortSignal,
): Promise<void> {
  assertBackendTaskActive(signal);
  switch (action.action) {
    case 'focus_window':
      await runBackendTaskStage(signal, () => service.desktopAgent.focusWindow(action.windowTitle || snapshot.currentWindowTitle));
      return;
    case 'click_element':
      await runBackendTaskStage(signal, () => clickElement(service, snapshot, action.elementId));
      return;
    case 'type_in_element':
      await runBackendTaskStage(signal, () => clickElement(service, snapshot, action.elementId));
      await runBackendTaskStage(signal, () => new Promise(resolve => setTimeout(resolve, 150)));
      await runBackendTaskStage(signal, () => service.desktopAgent.keyboardType(action.text || ''));
      return;
    case 'key':
      await runBackendTaskStage(signal, () => service.desktopAgent.keyboardKey(action.key || 'enter'));
      return;
    case 'scroll':
      await runBackendTaskStage(signal, () => service.desktopAgent.mouseScroll(action.direction || 'down', action.amount || 3));
      return;
    case 'wait':
      await runBackendTaskStage(signal, () => new Promise(resolve => setTimeout(resolve, Math.max(500, (action.amount || 1) * 1000))));
      return;
    default:
      throw new Error(`Accion no soportada por windows_uia: ${action.action}`);
  }
}

function clickElement(service: WindowsUIAServiceCore, snapshot: WindowsUIASnapshot, elementId?: number): Promise<void> {
  const point = resolveElementPoint(service, snapshot, elementId);
  if (!point) throw new Error(`No se encontro el elemento UIA ${elementId}.`);
  return service.desktopAgent.mouseClick(point.x, point.y);
}

function resolveElementPoint(service: WindowsUIAServiceCore, snapshot: WindowsUIASnapshot, elementId?: number) {
  const element = snapshot.elements.find((candidate) => candidate.id === elementId);
  if (!element) return null;
  const centerX = element.boundingRect.x + (element.boundingRect.width / 2);
  const centerY = element.boundingRect.y + (element.boundingRect.height / 2);
  const mapped = service.desktopAgent.mapDesktopPointToScreenshotPoint(centerX, centerY);
  if (mapped) return mapped;
  const primary = electronScreen.getPrimaryDisplay();
  const config = service.desktopAgent.getConfig();
  return {
    x: centerX / ((primary.size.width || 1920) / config.screenshotWidth),
    y: centerY / ((primary.size.height || 1080) / config.screenshotHeight),
  };
}
