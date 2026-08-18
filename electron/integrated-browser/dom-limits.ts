/**
 * Topes compartidos por los dos backends de lectura del DOM.
 *
 * El recorrido en script (`page-observation.ts`) y la captura por CDP
 * (`cdp-dom-snapshot.ts`) tienen que producir observaciones comparables: si
 * cada uno recortara con su propio criterio, cambiar de backend alteraria el
 * contexto que recibe el modelo y las respuestas dejarian de ser reproducibles.
 */

export const MAX_TEXT = 24_000;
export const MAX_HEADINGS = 100;
export const MAX_LANDMARKS = 60;
export const MAX_CONTROLS = 240;
export const MAX_FRAMES = 30;
export const MAX_IMAGES = 24;
/**
 * Lado minimo para considerar que una imagen es contenido. Por debajo son
 * iconos, avatares, separadores y pixeles de seguimiento: reutilizarlos en una
 * presentacion no aporta nada y llenaria la observacion de ruido.
 */
export const MIN_IMAGE_SIDE_PX = 200;
/** Lado minimo de la caja renderizada. Una imagen grande servida en un recuadro
 * de 40px sigue siendo un icono en esta pagina. */
export const MIN_IMAGE_BOX_PX = 80;
export const MAX_FIELD_TEXT = 180;
export const MAX_SCANNED_NODES = 1_800;
export const VIEWPORT_MARGIN_PX = 240;
/**
 * Presupuesto duro del recorrido dentro de la pagina. Sin el, un documento
 * grande (YouTube, Gmail) bloqueaba el hilo principal del renderer durante
 * segundos y el usuario lo percibia como una carga lenta del sitio.
 *
 * Solo aplica al backend en script: la captura por CDP la resuelve Blink fuera
 * del hilo del renderer y no necesita este freno.
 */
export const SNAPSHOT_BUDGET_MS = 400;
