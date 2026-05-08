import { MAX_HISTORY_ITEMS } from './constants';
import type { BrowserHistoryEntry, BrowserPageSnapshot } from './types';

export function buildBrowserActionPrompt(
  task: string,
  snapshot: BrowserPageSnapshot,
  history: BrowserHistoryEntry[],
): string {
  const historyText = history.slice(-MAX_HISTORY_ITEMS).map((entry) => {
    const status = entry.success ? 'OK' : `ERROR: ${entry.error || 'sin detalle'}`;
    const verification = entry.verification ? ` Verificacion: ${entry.verification}` : '';
    return `Paso ${entry.step}: ${entry.action.action} - ${status} - ${entry.action.message} - URL: ${entry.url}.${verification}`;
  }).join('\n');

  const elementsText = snapshot.elements.length > 0
    ? snapshot.elements.map((element) => {
      const fields = [
        `[${element.ref}]`,
        element.role || element.tag,
        element.label && `label="${element.label}"`,
        element.text && `text="${element.text}"`,
        element.placeholder && `placeholder="${element.placeholder}"`,
        element.type && `type="${element.type}"`,
        element.value && `value="${element.value}"`,
        element.checked ? 'checked=true' : '',
        element.disabled ? 'disabled=true' : '',
        element.href && `href="${element.href}"`,
      ].filter(Boolean);

      return fields.join(' | ');
    }).join('\n')
    : '(sin elementos interactivos visibles)';

  return `TAREA WEB: ${task}

CONTEXTO ACTUAL:
- URL: ${snapshot.url}
- Titulo: ${snapshot.title || '(sin titulo)'}
- Texto visible resumido: ${snapshot.textExcerpt || '(sin texto relevante)'}
- ScrollY: ${snapshot.scrollY}
- Elemento enfocado: ${snapshot.activeRef || '(sin foco relevante)'}

ELEMENTOS INTERACTIVOS VISIBLES:
${elementsText}

HISTORIAL RECIENTE:
${historyText || '(sin historial)'}

REGLAS:
1. Prefiere acciones estructuradas basadas en refs visibles.
2. Usa "goto" solo si necesitas ir a otro sitio o resolver una navegacion bloqueada.
3. Usa "click_ref" para botones, links, tabs, menus y checkboxes.
4. Usa "fill_ref" para inputs, textareas, selects o campos editables.
5. Usa "press_key" solo para Enter, Tab, Escape o atajos concretos.
6. Si la pagina ya muestra el objetivo cumplido, usa "done".
7. Si una accion reciente fallo o no produjo cambio, no la repitas igual. Elige otra estrategia.
8. Nunca inventes refs. Solo puedes usar refs listadas arriba.
9. En "expected" describe un cambio observable: nueva URL, modal abierto, texto visible, valor escrito o foco cambiado.
10. En "message" explica brevemente que ves y que haras.

RESPONDE SOLO JSON valido:
{
  "action": "goto|click_ref|fill_ref|press_key|scroll|wait|done|fail",
  "ref": "ref-1",
  "url": "https://...",
  "text": "texto a escribir",
  "key": "Enter|Tab|Escape|Control+L|Control+K",
  "direction": "up|down",
  "amount": 1,
  "expected": "que deberia cambiar despues de la accion",
  "message": "que veo y que hago"
}`;
}
