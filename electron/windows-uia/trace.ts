import fs from 'node:fs';
import type { WindowsUIASnapshot } from './types';

export function appendTrace(tracePath: string, payload: Record<string, any>): void {
  try {
    fs.appendFileSync(tracePath, `${JSON.stringify(payload)}\n`, 'utf-8');
  } catch {
    // Trace persistence is best-effort.
  }
}

export function summarizeSnapshot(snapshot: WindowsUIASnapshot, targetElementId?: number): Record<string, any> {
  const sampleElements = snapshot.elements.slice(0, 8).map((element) => ({
    id: element.id,
    name: element.name,
    controlType: element.controlType,
    automationId: element.automationId || '',
    value: element.value || '',
    isEnabled: element.isEnabled,
  }));
  const targetElement = targetElementId
    ? snapshot.elements.find((element) => element.id === targetElementId) || null
    : null;

  return {
    currentWindowTitle: snapshot.currentWindowTitle,
    currentProcess: snapshot.currentProcess,
    windowCount: snapshot.windows.length,
    elementCount: snapshot.elements.length,
    signature: snapshot.signature,
    targetElement: targetElement ? {
      id: targetElement.id,
      name: targetElement.name,
      controlType: targetElement.controlType,
      automationId: targetElement.automationId || '',
      value: targetElement.value || '',
      isEnabled: targetElement.isEnabled,
    } : null,
    sampleElements,
  };
}
