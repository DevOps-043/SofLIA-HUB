import type { WindowsUIAHistoryEntry, WindowsUIASnapshot } from './types';

export function buildPrompt(task: string, snapshot: WindowsUIASnapshot, history: WindowsUIAHistoryEntry[]): string {
  const windowsText = snapshot.windows.slice(0, 12)
    .map((window) => `- ${window.title || '(sin titulo)'} | ${window.process} | pid=${window.pid}`)
    .join('\n');
  const elementsText = snapshot.elements.slice(0, 25).map((element) => {
    const parts = [
      `[${element.id}]`,
      element.controlType,
      element.name && `name="${element.name}"`,
      element.automationId && `automationId="${element.automationId}"`,
      element.value && `value="${element.value}"`,
      `enabled=${element.isEnabled}`,
    ].filter(Boolean);
    return parts.join(' | ');
  }).join('\n');
  const historyText = history.slice(-6)
    .map((entry) => `Paso ${entry.step}: ${entry.action.action} - ${entry.success ? 'OK' : `ERROR: ${entry.error || 'sin detalle'}`} - ${entry.verification || ''}`)
    .join('\n');

  return `TAREA NATIVA WINDOWS: ${task}

VENTANA ACTIVA:
- titulo: ${snapshot.currentWindowTitle || '(sin titulo)'}
- proceso: ${snapshot.currentProcess || '(sin proceso)'}

VENTANAS DISPONIBLES:
${windowsText || '(sin ventanas)'}

ELEMENTOS UIA DE LA VENTANA ACTIVA:
${elementsText || '(sin elementos detectados)'}

HISTORIAL:
${historyText || '(sin historial)'}

REGLAS:
1. Prefiere focus_window si la ventana correcta no esta al frente.
2. Prefiere click_element y type_in_element con elementId.
3. Usa key solo para Enter, Tab, Escape o atajos concretos.
4. Si el objetivo ya esta cumplido, responde done.
5. Si una accion reciente no produjo cambio verificable, cambia de estrategia.
6. En expected describe un cambio observable en la ventana o en un valor UIA.

RESPONDE SOLO JSON valido:
{
  "action": "focus_window|click_element|type_in_element|key|scroll|wait|done|fail",
  "windowTitle": "titulo parcial",
  "elementId": 3,
  "text": "texto a escribir",
  "key": "enter|tab|escape|ctrl+s",
  "direction": "up|down",
  "amount": 1,
  "expected": "cambio esperado",
  "message": "que veo y que hago"
}`;
}
