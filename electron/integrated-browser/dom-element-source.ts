/**
 * Fuente de marcas del Set-of-Marks para el navegador integrado.
 *
 * En el escritorio, la lista de elementos interactuables hay que deducirla:
 * `element-source/` compone accesibilidad UIA, lectura OCR y un detector visual
 * ONNX, y despues fusiona por solape porque las tres se contradicen. Cuesta uno
 * o dos segundos por paso y sigue siendo una estimacion.
 *
 * En el navegador esa lista ya existe y es exacta: `read_browser_dom` devuelve
 * cada control con su rectangulo, su rol y su nombre accesible. Este modulo solo
 * la traduce al formato que entiende el dibujado de marcas. No hay OCR, no hay
 * modelo, no hay fusion: el DOM no estima donde esta un boton, lo sabe.
 *
 * El objetivo es que el modelo de Computer Use deje de calcular pixeles sobre
 * una captura reescalada y pueda referirse a `[7]`. Cada marca conserva el `ref`
 * del control, de modo que la fase siguiente pueda resolver el clic por el
 * camino determinista en vez de por coordenada.
 */

import type { UIElement } from '../desktop-agent/ui-types';
import type { BrowserDomControl, BrowserDomSnapshot } from './types';

/**
 * Tope de marcas. El dibujado ya recorta a 30 y una pantalla con mas cajas
 * numeradas se vuelve ilegible para el modelo: la marca deja de desambiguar y
 * pasa a competir con el contenido.
 */
export const MAX_BROWSER_MARKS = 30;

/** Lado minimo de un control para merecer marca, en pixeles CSS del viewport. */
const MIN_MARK_SIDE_PX = 8;

/**
 * Solape a partir del cual dos controles se consideran el mismo. Un enlace que
 * envuelve a un boton produce dos rectangulos casi identicos y dos numeros
 * encima del mismo pixel.
 */
const DEDUPE_IOU = 0.8;

/**
 * Rol o etiqueta del control -> vocabulario de tipos del dibujado, que decide el
 * color de la marca. Mantener la correspondencia con los nombres que ya usa el
 * escritorio evita una segunda paleta para lo mismo.
 */
const CONTROL_TYPE_BY_ROLE: Record<string, string> = {
  button: 'Button',
  link: 'Link',
  textbox: 'TextBox',
  searchbox: 'TextBox',
  combobox: 'ComboBox',
  listbox: 'ComboBox',
  checkbox: 'CheckBox',
  radio: 'RadioButton',
  switch: 'CheckBox',
  tab: 'MenuItem',
  menuitem: 'MenuItem',
  option: 'ListItem',
};

const CONTROL_TYPE_BY_TAG: Record<string, string> = {
  a: 'Link',
  button: 'Button',
  select: 'ComboBox',
  textarea: 'TextBox',
  summary: 'MenuItem',
};

const CONTROL_TYPE_BY_INPUT: Record<string, string> = {
  checkbox: 'CheckBox',
  radio: 'RadioButton',
  submit: 'Button',
  button: 'Button',
  reset: 'Button',
};

/** Marca dibujable. Extiende el contrato del dibujado con el origen en el DOM. */
export interface BrowserMark extends UIElement {
  /** Referencia del control en la observacion, para resolver el clic sin pixeles. */
  ref: string;
}

/**
 * Traduce la observacion en marcas. El orden es el de lectura —arriba a abajo,
 * izquierda a derecha— para que numeros contiguos queden cerca en pantalla; un
 * orden arbitrario obliga al modelo a rastrear la imagen entera por cada numero.
 */
export function buildBrowserMarks(
  dom: Pick<BrowserDomSnapshot, 'controls'>,
  viewport: { width: number; height: number },
  maxMarks: number = MAX_BROWSER_MARKS,
): BrowserMark[] {
  const candidates = inReadingOrder((dom?.controls ?? []).filter((control) => isMarkable(control, viewport)));

  const kept: BrowserMark[] = [];
  for (const control of candidates) {
    if (kept.length >= maxMarks) break;
    if (kept.some((mark) => iou(mark.boundingRect, control.rect) >= DEDUPE_IOU)) continue;
    kept.push({
      id: kept.length + 1,
      name: control.name || control.text || '',
      controlType: controlTypeOf(control),
      boundingRect: { ...control.rect },
      isEnabled: !control.disabled,
      ref: control.ref,
    });
  }
  return kept;
}

/**
 * Solo se marca lo que el usuario puede ver y tocar. Un control fuera del area
 * visible tendria su numero pintado en un borde, y uno deshabilitado invita al
 * modelo a gastar un paso en algo que no responde.
 */
function isMarkable(control: BrowserDomControl, viewport: { width: number; height: number }): boolean {
  const rect = control?.rect;
  if (!rect || control.disabled) return false;
  if (rect.width < MIN_MARK_SIDE_PX || rect.height < MIN_MARK_SIDE_PX) return false;
  if (rect.x + rect.width <= 0 || rect.y + rect.height <= 0) return false;
  return rect.x < viewport.width && rect.y < viewport.height;
}

/**
 * Tolerancia vertical para considerar que dos controles comparten fila. Los
 * elementos de una misma barra rara vez comparten la `y` exacta: difieren unos
 * pocos pixeles por su alto o su alineacion.
 */
const ROW_TOLERANCE_PX = 24;

/**
 * Ordena arriba a abajo y, dentro de cada fila, izquierda a derecha.
 *
 * Las filas se arman por cercania a la primera de la fila, no contra una
 * cuadricula fija: con bandas absolutas, dos botones de la misma barra a `y=20`
 * e `y=24` caian en bandas distintas y se numeraban en columna en vez de en
 * fila, que es justo el error que el orden de lectura debe evitar.
 */
function inReadingOrder(controls: BrowserDomControl[]): BrowserDomControl[] {
  const porFila = [...controls].sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x));
  const ordenados: BrowserDomControl[] = [];
  let fila: BrowserDomControl[] = [];
  let filaInicio = 0;

  const cerrarFila = () => {
    if (!fila.length) return;
    fila.sort((a, b) => a.rect.x - b.rect.x);
    ordenados.push(...fila);
    fila = [];
  };

  for (const control of porFila) {
    if (!fila.length) filaInicio = control.rect.y;
    else if (control.rect.y - filaInicio > ROW_TOLERANCE_PX) {
      cerrarFila();
      filaInicio = control.rect.y;
    }
    fila.push(control);
  }
  cerrarFila();
  return ordenados;
}

function controlTypeOf(control: BrowserDomControl): string {
  const tag = control.tag?.toLowerCase() ?? '';
  const role = control.role?.toLowerCase() ?? '';
  const type = control.type?.toLowerCase() ?? '';
  if (role && CONTROL_TYPE_BY_ROLE[role]) return CONTROL_TYPE_BY_ROLE[role];
  if (tag === 'input') return CONTROL_TYPE_BY_INPUT[type] ?? 'Edit';
  return CONTROL_TYPE_BY_TAG[tag] ?? 'Button';
}

/** Interseccion sobre union. Mismo criterio de fusion que usa el escritorio. */
export function iou(a: UIElement['boundingRect'], b: UIElement['boundingRect']): number {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return 0;
  const interseccion = (right - x) * (bottom - y);
  const union = a.width * a.height + b.width * b.height - interseccion;
  return union > 0 ? interseccion / union : 0;
}

/**
 * Traslada un rectangulo del viewport a los pixeles de la imagen que vera el
 * modelo. La captura de percepcion se reduce a 1024 px en su lado mayor, asi que
 * dibujar con las coordenadas del viewport pintaria las marcas desplazadas y
 * cada vez mas lejos del control conforme se baja en la pagina.
 */
export function scaleRectToImage(
  rect: UIElement['boundingRect'],
  viewport: { width: number; height: number },
  image: { width: number; height: number },
): UIElement['boundingRect'] | null {
  if (viewport.width <= 0 || viewport.height <= 0) return null;
  const escalaX = image.width / viewport.width;
  const escalaY = image.height / viewport.height;
  return {
    x: rect.x * escalaX,
    y: rect.y * escalaY,
    width: rect.width * escalaX,
    height: rect.height * escalaY,
  };
}
