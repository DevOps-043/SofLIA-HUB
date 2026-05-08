import type { WindowsUIAActionPayload, WindowsUIASnapshot } from './types';

export function verifyActionOutcome(
  action: WindowsUIAActionPayload,
  before: WindowsUIASnapshot,
  after: WindowsUIASnapshot,
): { success: boolean; message: string } {
  if (action.expected && expectedAppears(action.expected, after)) {
    return { success: true, message: `Cambio esperado detectado: ${action.expected}` };
  }
  if (action.action === 'focus_window') return verifyFocusWindow(action, before, after);
  if (action.action === 'type_in_element') {
    const afterElement = after.elements.find((element) => element.id === action.elementId);
    const typedText = normalizeText(action.text || '');
    if (afterElement && typedText && normalizeText(afterElement.value || '').includes(typedText)) {
      return { success: true, message: `El valor UIA del elemento ${action.elementId} refleja el texto.` };
    }
  }
  if (before.signature !== after.signature || before.currentWindowTitle !== after.currentWindowTitle) {
    return { success: true, message: 'Se detecto un cambio UIA en la ventana activa.' };
  }
  return { success: false, message: 'No se detecto un cambio UIA verificable despues de la accion.' };
}

export function shouldRecommendVisualFallback(category: string): boolean {
  return category === 'verification' || category === 'timeout' || category === 'no_elements';
}

function verifyFocusWindow(action: WindowsUIAActionPayload, before: WindowsUIASnapshot, after: WindowsUIASnapshot) {
  if (action.windowTitle && after.currentWindowTitle.toLowerCase().includes(action.windowTitle.toLowerCase())) {
    return { success: true, message: `La ventana ${after.currentWindowTitle} esta activa.` };
  }
  if (before.currentWindowTitle !== after.currentWindowTitle) {
    return { success: true, message: `La ventana activa cambio a ${after.currentWindowTitle}.` };
  }
  return { success: false, message: 'No cambio la ventana activa despues del focus_window.' };
}

function expectedAppears(expected: string, snapshot: WindowsUIASnapshot): boolean {
  const needle = normalizeText(expected);
  if (!needle || needle.length < 3) return false;
  const haystack = normalizeText([
    snapshot.currentWindowTitle,
    snapshot.currentProcess,
    snapshot.windows.map((window) => `${window.title} ${window.process}`).join(' '),
    snapshot.elements.map((element) => `${element.name} ${element.automationId || ''} ${element.value || ''}`).join(' '),
  ].join(' '));
  return haystack.includes(needle);
}

function normalizeText(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}
