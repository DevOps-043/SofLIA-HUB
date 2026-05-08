import type {
  BrowserActionPayload,
  BrowserPageSnapshot,
  BrowserVerificationResult,
} from './types';
import { normalizeComparableUrl, normalizeText, normalizeUrl } from './normalizers';
import { expectedAppears, findElement } from './expectations';

export function verifyBrowserActionOutcome(
  action: BrowserActionPayload,
  before: BrowserPageSnapshot,
  after: BrowserPageSnapshot,
): BrowserVerificationResult {
  if (action.action === 'wait') {
    return { success: true, message: 'Espera ejecutada.' };
  }

  if (action.expected && expectedAppears(action.expected, after)) {
    return { success: true, message: `Cambio esperado detectado: ${action.expected}` };
  }

  if (action.action === 'goto') {
    if (action.url && normalizeComparableUrl(after.url).startsWith(normalizeComparableUrl(normalizeUrl(action.url)))) {
      return { success: true, message: `Navegacion confirmada a ${after.url}.` };
    }
    return {
      success: false,
      message: `La navegacion no llego al destino esperado. URL actual: ${after.url || '(sin URL)'}.`,
    };
  }

  if (action.action === 'fill_ref') {
    const afterElement = findElement(after, action.ref);
    const typedText = normalizeText(action.text || '');
    if (afterElement && typedText) {
      const targetValue = normalizeText(afterElement.value || afterElement.text);
      if (targetValue.includes(typedText)) {
        return { success: true, message: `El campo ${action.ref} refleja el texto escrito.` };
      }
    }
    if (before.signature !== after.signature) {
      return { success: true, message: 'El DOM cambio despues del llenado.' };
    }
    return {
      success: false,
      message: `No se detecto cambio verificable despues de llenar ${action.ref}.`,
    };
  }

  if (action.action === 'scroll') {
    if (before.scrollY !== after.scrollY || before.signature !== after.signature) {
      return { success: true, message: `Scroll detectado. Posicion actual ${after.scrollY}.` };
    }
    return { success: false, message: 'No se detecto desplazamiento visible despues del scroll.' };
  }

  if (action.action === 'press_key') {
    const key = normalizeText(action.key || '');
    if ((key === 'tab' || key === 'shift+tab') && before.activeRef !== after.activeRef) {
      return { success: true, message: `El foco cambio de ${before.activeRef || 'ninguno'} a ${after.activeRef || 'ninguno'}.` };
    }
    if (before.signature !== after.signature || before.url !== after.url) {
      return { success: true, message: `La tecla ${action.key} produjo un cambio visible.` };
    }
    return { success: false, message: `La tecla ${action.key} no produjo un cambio verificable.` };
  }

  if (action.action === 'click_ref') {
    const afterElement = findElement(after, action.ref);
    if (before.url !== after.url || before.title !== after.title) {
      return { success: true, message: `El click cambio la pagina a ${after.url}.` };
    }
    if (before.activeRef !== after.activeRef && after.activeRef) {
      return { success: true, message: `El click movio el foco a ${after.activeRef}.` };
    }
    if (!afterElement) {
      return { success: true, message: `El elemento ${action.ref} ya no esta visible despues del click.` };
    }
    if (before.signature !== after.signature) {
      return { success: true, message: 'El DOM cambio despues del click.' };
    }
    return { success: false, message: `No se detecto cambio visible despues de hacer click en ${action.ref}.` };
  }

  return { success: true, message: 'Accion ejecutada.' };
}
