import type { WebContents } from 'electron';
import type { BrowserDomControl, BrowserDomImage, BrowserDomSnapshot } from './types';

const MAX_TEXT = 24_000;
const MAX_HEADINGS = 100;
const MAX_LANDMARKS = 60;
const MAX_CONTROLS = 240;
const MAX_FRAMES = 30;
const MAX_IMAGES = 24;
/**
 * Lado minimo para considerar que una imagen es contenido. Por debajo son
 * iconos, avatares, separadores y pixeles de seguimiento: reutilizarlos en una
 * presentacion no aporta nada y llenaria la observacion de ruido.
 */
const MIN_IMAGE_SIDE_PX = 200;
const MAX_FIELD_TEXT = 180;
const MAX_SCANNED_NODES = 1_800;
const VIEWPORT_MARGIN_PX = 240;
/**
 * Presupuesto duro del recorrido dentro de la pagina. Sin el, un documento
 * grande (YouTube, Gmail) bloqueaba el hilo principal del renderer durante
 * segundos y el usuario lo percibia como una carga lenta del sitio.
 */
const SNAPSHOT_BUDGET_MS = 400;
/** Registro de elementos interactivos que el controlador determinista reutiliza. */
export const BROWSER_REF_REGISTRY_KEY = '__sofliaBrowserRefs';

type RawSnapshot = {
  title?: unknown;
  url?: unknown;
  language?: unknown;
  text?: unknown;
  headings?: unknown[];
  landmarks?: unknown[];
  controls?: unknown[];
  images?: unknown[];
  frames?: unknown[];
  viewport?: Record<string, unknown>;
  truncated?: unknown;
};

export async function collectIntegratedBrowserDom(contents: WebContents): Promise<BrowserDomSnapshot> {
  const raw = await contents.executeJavaScript(DOM_SNAPSHOT_SCRIPT, true) as RawSnapshot;
  return normalizeSnapshot(raw);
}

export function sanitizeObservedUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().slice(0, 500);
  } catch {
    return '';
  }
}

function normalizeSnapshot(raw: RawSnapshot): BrowserDomSnapshot {
  const text = clean(raw?.text, MAX_TEXT);
  const controls = Array.isArray(raw?.controls)
    ? raw.controls.slice(0, MAX_CONTROLS).map(normalizeControl).filter((item): item is BrowserDomControl => item !== null)
    : [];
  return {
    title: clean(raw?.title, 300),
    url: sanitizeObservedUrl(raw?.url),
    language: clean(raw?.language, 40),
    text,
    headings: Array.isArray(raw?.headings) ? raw.headings.slice(0, MAX_HEADINGS).map((item) => {
      const value = asRecord(item);
      return {
        level: Number.isSafeInteger(value.level) ? Math.min(6, Math.max(1, Number(value.level))) : 1,
        text: clean(value.text, MAX_FIELD_TEXT),
        scope: clean(value.scope, 120),
      };
    }).filter((item) => item.text) : [],
    landmarks: Array.isArray(raw?.landmarks) ? raw.landmarks.slice(0, MAX_LANDMARKS).map((item) => {
      const value = asRecord(item);
      return { role: clean(value.role, 40), name: clean(value.name, MAX_FIELD_TEXT), scope: clean(value.scope, 120) };
    }).filter((item) => item.role || item.name) : [],
    controls,
    images: Array.isArray(raw?.images)
      ? raw.images.slice(0, MAX_IMAGES).map(normalizeImage).filter((item): item is BrowserDomImage => item !== null)
      : [],
    frames: Array.isArray(raw?.frames) ? raw.frames.slice(0, MAX_FRAMES).map((item) => {
      const value = asRecord(item);
      return { title: clean(value.title, MAX_FIELD_TEXT), url: sanitizeObservedUrl(value.url), accessible: value.accessible === true };
    }) : [],
    viewport: {
      width: finiteInt(raw?.viewport?.width),
      height: finiteInt(raw?.viewport?.height),
      scrollX: finiteInt(raw?.viewport?.scrollX),
      scrollY: finiteInt(raw?.viewport?.scrollY),
      documentWidth: finiteInt(raw?.viewport?.documentWidth),
      documentHeight: finiteInt(raw?.viewport?.documentHeight),
    },
    truncated: raw?.truncated === true || text.length >= MAX_TEXT || controls.length >= MAX_CONTROLS,
  };
}

function normalizeImage(input: unknown): BrowserDomImage | null {
  const value = asRecord(input);
  const url = sanitizeImageUrl(value.url);
  if (!url) return null;
  return {
    url,
    alt: clean(value.alt, MAX_FIELD_TEXT),
    width: finiteInt(value.width),
    height: finiteInt(value.height),
  };
}

/**
 * A diferencia de `sanitizeObservedUrl`, conserva la query: en las URL de
 * imagen suele llevar el tamano o la firma, y quitarla devuelve un 403 o una
 * imagen distinta. Se descartan las credenciales y todo lo que no sea HTTP(S)
 * —`data:` y `blob:` no se pueden volver a pedir desde el proceso principal—.
 */
function sanitizeImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.username = '';
    url.password = '';
    url.hash = '';
    return url.toString().slice(0, 1_000);
  } catch {
    return '';
  }
}

function normalizeControl(input: unknown): BrowserDomControl | null {
  const value = asRecord(input);
  const rect = asRecord(value.rect);
  const ref = clean(value.ref, 60);
  if (!ref) return null;
  return {
    ref,
    tag: clean(value.tag, 30),
    role: clean(value.role, 40),
    name: clean(value.name, MAX_FIELD_TEXT),
    text: clean(value.text, MAX_FIELD_TEXT),
    type: clean(value.type, 40).toLowerCase() === 'password' ? 'password-redacted' : clean(value.type, 40),
    href: sanitizeObservedUrl(value.href),
    disabled: value.disabled === true,
    checked: typeof value.checked === 'boolean' ? value.checked : null,
    rect: {
      x: finiteInt(rect.x), y: finiteInt(rect.y),
      width: finiteInt(rect.width), height: finiteInt(rect.height),
    },
    scope: clean(value.scope, 120),
  };
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[\p{Cc}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function finiteInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

const DOM_SNAPSHOT_SCRIPT = `(() => {
  const LIMITS = { text: ${MAX_TEXT}, headings: ${MAX_HEADINGS}, landmarks: ${MAX_LANDMARKS}, controls: ${MAX_CONTROLS}, images: ${MAX_IMAGES}, minImage: ${MIN_IMAGE_SIDE_PX}, frames: ${MAX_FRAMES}, scanned: ${MAX_SCANNED_NODES}, viewportMargin: ${VIEWPORT_MARGIN_PX} };
  const deadline = Date.now() + ${SNAPSHOT_BUDGET_MS};
  const registry = new Map();
  const clean = (value, max = ${MAX_FIELD_TEXT}) => String(value || '').replace(/[\\u0000-\\u001f\\u007f]+/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, max);
  const result = { title: clean(document.title, 300), url: location.href, language: clean(document.documentElement.lang, 40), text: '', headings: [], landmarks: [], controls: [], images: [], frames: [], viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight }, truncated: false };
  const textParts = [];
  let textLength = 0;
  let textNodesScanned = 0;
  let elementsScanned = 0;
  let refIndex = 0;
  let outOfBudget = false;
  const budgetExhausted = () => {
    if (outOfBudget) return true;
    if (Date.now() < deadline) return false;
    outOfBudget = true;
    result.truncated = true;
    return true;
  };
  const seen = new Set();
  const measurements = new WeakMap();
  const sensitive = (el) => el && (el.matches?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]') || el.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]'));
  const measure = (el) => {
    if (!(el instanceof Element)) return { visible: false, rect: { x: 0, y: 0, width: 0, height: 0 } };
    const cached = measurements.get(el);
    if (cached) return cached;
    const rect = el.getBoundingClientRect();
    const view = el.ownerDocument.defaultView || window;
    const insideViewport = rect.bottom >= -LIMITS.viewportMargin && rect.top <= view.innerHeight + LIMITS.viewportMargin && rect.right >= -LIMITS.viewportMargin && rect.left <= view.innerWidth + LIMITS.viewportMargin;
    if (!insideViewport || rect.width <= 1 || rect.height <= 1) {
      const measured = { visible: false, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
      measurements.set(el, measured);
      return measured;
    }
    // checkVisibility resuelve display/visibility/opacity en una sola llamada
    // nativa; getComputedStyle asignaba un objeto por elemento visitado.
    let isVisible;
    if (typeof el.checkVisibility === 'function') {
      isVisible = el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
    } else {
      const style = view.getComputedStyle(el);
      isVisible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    }
    const measured = { visible: isVisible, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    measurements.set(el, measured);
    return measured;
  };
  const visible = (el) => measure(el).visible;
  const label = (el, root) => {
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria);
    const ids = (el.getAttribute('aria-labelledby') || '').split(/\\s+/).filter(Boolean);
    if (ids.length) return clean(ids.map((id) => document.getElementById(id)?.textContent || '').join(' '));
    if (el.id) {
      try { const own = (root.querySelector?.('label[for="' + CSS.escape(el.id) + '"]') || document.querySelector('label[for="' + CSS.escape(el.id) + '"]')); if (own) return clean(own.textContent); } catch {}
    }
    return clean(el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('placeholder') || '');
  };
  const scopeName = (scope, parent) => parent || (scope instanceof ShadowRoot ? 'shadow:' + clean(scope.host.tagName.toLowerCase() + '#' + (scope.host.id || ''), 100) : 'document');
  const walk = (root, scope = 'document', depth = 0) => {
    if (depth > 4) { result.truncated = true; return; }
    const owner = root.ownerDocument || document;
    const walker = owner.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) && textLength < LIMITS.text && textNodesScanned < LIMITS.scanned) {
      textNodesScanned++;
      if ((textNodesScanned & 63) === 0 && budgetExhausted()) break;
      const parent = node.parentElement;
      if (!parent || sensitive(parent) || parent.closest('script,style,noscript,template') || !visible(parent)) continue;
      const value = clean(node.textContent, 500);
      if (!value) continue;
      textParts.push(value); textLength += value.length + 1;
    }
    if (textNodesScanned >= LIMITS.scanned) result.truncated = true;
    const elementWalker = owner.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let el;
    while ((el = elementWalker.nextNode()) && elementsScanned < LIMITS.scanned) {
      elementsScanned++;
      if ((elementsScanned & 63) === 0 && budgetExhausted()) break;
      if (el.shadowRoot) walk(el.shadowRoot, scopeName(el.shadowRoot, scope), depth + 1);
      // Clasificar antes de medir: getBoundingClientRect y la resolucion de
      // estilo son el costo dominante y solo interesan en los nodos que de
      // verdad entran al snapshot.
      const tag = el.tagName.toLowerCase();
      const isHeading = /^h[1-6]$/.test(tag) && result.headings.length < LIMITS.headings;
      const explicitRole = el.getAttribute('role') || '';
      const landmarkRole = explicitRole || ({ main: 'main', nav: 'navigation', header: 'banner', footer: 'contentinfo', aside: 'complementary', form: 'form' }[tag] || '');
      const isLandmark = !!landmarkRole && /^(main|navigation|banner|contentinfo|complementary|form|search|region)$/.test(landmarkRole) && result.landmarks.length < LIMITS.landmarks;
      const isFrame = tag === 'iframe' || tag === 'frame';
      const isImage = tag === 'img' && result.images.length < LIMITS.images;
      const pendingControl = result.controls.length < LIMITS.controls && !seen.has(el)
        && el.matches('a[href],button,input,textarea,select,summary,[role="button"],[role="link"],[role="textbox"],[role="combobox"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[role="menuitem"],[tabindex]:not([tabindex="-1"]),[contenteditable="true"],[contenteditable=""]');
      if (!isHeading && !isLandmark && !isFrame && !isImage && !pendingControl) continue;
      if (!visible(el)) continue;
      if (isImage) {
        // El tamano renderizado manda sobre el natural: una imagen enorme
        // servida en un recuadro de 40px sigue siendo un icono en esta pagina.
        const ancho = Math.round(el.naturalWidth || el.width || 0);
        const alto = Math.round(el.naturalHeight || el.height || 0);
        const caja = el.getBoundingClientRect();
        const util = Math.min(ancho, alto) >= LIMITS.minImage && Math.min(caja.width, caja.height) >= 80;
        const origen = el.currentSrc || el.src || '';
        if (util && origen) result.images.push({ url: origen, alt: clean(el.alt, 180), width: ancho, height: alto });
      }
      if (isHeading) result.headings.push({ level: Number(tag[1]), text: clean(el.textContent), scope });
      if (isLandmark) result.landmarks.push({ role: landmarkRole, name: label(el, root), scope });
      if (isFrame) {
        if (result.frames.length >= LIMITS.frames) { result.truncated = true; continue; }
        let accessible = false;
        try { if (el.contentDocument) { accessible = true; walk(el.contentDocument, 'frame:' + clean(el.title || el.src || 'sin titulo', 100), depth + 1); } } catch {}
        result.frames.push({ title: clean(el.title), url: el.src || '', accessible });
      }
      if (!pendingControl) continue;
      seen.add(el);
      const isField = el.matches('input,textarea,select,[contenteditable="true"],[contenteditable=""]');
      const type = el instanceof HTMLInputElement ? clean(el.type, 40) : '';
      const ref = 'dom-' + (++refIndex);
      registry.set(ref, el);
      result.controls.push({
        ref, tag, role: explicitRole, name: label(el, root),
        text: isField || type === 'password' ? '' : clean(el.textContent), type,
        href: el instanceof HTMLAnchorElement ? el.href : '', disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
        checked: typeof el.checked === 'boolean' ? el.checked : null,
        rect: measure(el).rect, scope,
      });
    }
    if (elementsScanned >= LIMITS.scanned) result.truncated = true;
  };
  walk(document);
  result.text = textParts.join(' ').slice(0, LIMITS.text);
  if (textLength >= LIMITS.text) result.truncated = true;
  // El registro permite que el controlador determinista vuelva a localizar el
  // mismo elemento sin depender de coordenadas que el scroll invalida.
  try { window['${BROWSER_REF_REGISTRY_KEY}'] = registry; } catch {}
  return result;
})()`;
