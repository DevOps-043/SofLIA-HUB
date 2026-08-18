/**
 * Lectura del DOM mediante `DOMSnapshot.captureSnapshot`.
 *
 * El recorrido historico (`page-observation.ts`) es JavaScript ejecutandose en
 * el hilo principal del renderer. Por eso lleva un presupuesto de 400 ms y un
 * tope de 1800 nodos: sin ellos, un documento grande congelaba la pagina y el
 * usuario lo leia como lentitud del sitio. El precio es que en Gmail, Drive o
 * un ERP la observacion sale marcada como `truncated` casi siempre, y el agente
 * gasta pasos en ciclos de desplazar y releer.
 *
 * `captureSnapshot` resuelve el mismo recorrido dentro de Blink, en C++, con el
 * arbol de composicion ya calculado. No compite con el hilo del renderer, asi
 * que no necesita presupuesto, y devuelve en una sola llamada todos los
 * documentos que viven en el mismo proceso: el contenido de los iframes del
 * mismo sitio deja de ser un punto ciego.
 *
 * Limite que este modulo no resuelve: los iframes aislados por proceso (OOPIF,
 * el caso tipico de un checkout o un SSO de otro origen) son objetivos CDP
 * distintos y no entran en esta captura. Se enumeran como marcos inaccesibles,
 * igual que hoy. Cubrirlos exige adjuntarse a cada objetivo con `Target` en
 * modo plano y componer coordenadas entre procesos; queda fuera de este cambio.
 *
 * Diferencia de contrato conocida contra el backend en script: el tamano de las
 * imagenes se informa como caja renderizada, no como tamano natural, porque
 * `DOMSnapshot` no expone `naturalWidth`. El filtro de iconos se aplica sobre
 * esa caja.
 */

import type { WebContents } from 'electron';
import { withCdpSession } from './cdp-session';
import {
  MAX_CONTROLS,
  MAX_FIELD_TEXT,
  MAX_FRAMES,
  MAX_HEADINGS,
  MAX_IMAGES,
  MAX_LANDMARKS,
  MAX_TEXT,
  MIN_IMAGE_BOX_PX,
} from './dom-limits';
import type { BrowserDomControl, BrowserDomImage, BrowserDomSnapshot } from './types';

/** Prefijo de las referencias que resuelve el camino CDP. */
export const CDP_REF_PREFIX = 'cdp-';

/**
 * Guarda de cordura. Una captura sana ronda los miles de nodos; pasado este
 * numero es mas barato caer al backend en script que recorrer el resultado.
 */
const MAX_SNAPSHOT_NODES = 120_000;

/** Estilos que se piden calculados para decidir visibilidad sin volver a la pagina. */
const COMPUTED_STYLES = ['display', 'visibility', 'opacity'] as const;

const CONTROL_TAGS = new Set(['a', 'button', 'input', 'textarea', 'select', 'summary']);
const CONTROL_ROLES = new Set([
  'button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'switch', 'tab', 'menuitem',
]);
const LANDMARK_TAGS: Record<string, string> = {
  main: 'main', nav: 'navigation', header: 'banner', footer: 'contentinfo', aside: 'complementary', form: 'form',
};
const LANDMARK_ROLES = /^(main|navigation|banner|contentinfo|complementary|form|search|region)$/;
const FIELD_TAGS = new Set(['input', 'textarea', 'select']);
const CHECKABLE_TYPES = new Set(['checkbox', 'radio']);
const SKIP_TEXT_TAGS = new Set(['script', 'style', 'noscript', 'template']);

interface RareStringData { index?: number[]; value?: number[] }
interface RareBooleanData { index?: number[] }
interface RareIntegerData { index?: number[]; value?: number[] }

interface NodeTreeSnapshot {
  parentIndex?: number[];
  nodeType?: number[];
  nodeName?: number[];
  nodeValue?: number[];
  backendNodeId?: number[];
  attributes?: number[][];
  inputValue?: RareStringData;
  inputChecked?: RareBooleanData;
  contentDocumentIndex?: RareIntegerData;
  currentSourceURL?: RareStringData;
}

interface LayoutTreeSnapshot {
  nodeIndex?: number[];
  styles?: number[][];
  bounds?: number[][];
  text?: number[];
}

interface DocumentSnapshot {
  documentURL?: number;
  title?: number;
  contentLanguage?: number;
  nodes?: NodeTreeSnapshot;
  layout?: LayoutTreeSnapshot;
  scrollOffsetX?: number;
  scrollOffsetY?: number;
  contentWidth?: number;
  contentHeight?: number;
}

interface CapturedSnapshot {
  documents?: DocumentSnapshot[];
  strings?: string[];
}

interface LayoutMetrics {
  cssLayoutViewport?: { clientWidth?: number; clientHeight?: number };
  cssVisualViewport?: { pageX?: number; pageY?: number };
  cssContentSize?: { width?: number; height?: number };
}

/**
 * Captura y traduce el DOM. Devuelve `null` cuando la sesion de inspeccion no
 * esta disponible o la captura llega vacia: el llamador cae al backend en
 * script sin que el usuario perciba nada.
 */
export async function captureCdpDomSnapshot(contents: WebContents): Promise<BrowserDomSnapshot | null> {
  if (contents.isDestroyed()) return null;
  const captured = await withCdpSession(contents, ['DOMSnapshot', 'Page'], async (send) => {
    const [snapshot, metrics] = await Promise.all([
      send('DOMSnapshot.captureSnapshot', {
        computedStyles: [...COMPUTED_STYLES],
        includeDOMRects: true,
        includePaintOrder: false,
      }) as Promise<CapturedSnapshot>,
      send('Page.getLayoutMetrics').catch(() => ({})) as Promise<LayoutMetrics>,
    ]);
    return { snapshot, metrics };
  });
  return buildSnapshot(captured.snapshot, captured.metrics, contents.getURL());
}

export function buildSnapshot(
  captured: CapturedSnapshot,
  metrics: LayoutMetrics,
  fallbackUrl: string,
): BrowserDomSnapshot | null {
  const documents = captured?.documents;
  const strings = captured?.strings;
  if (!Array.isArray(documents) || documents.length === 0 || !Array.isArray(strings)) return null;

  const totalNodes = documents.reduce((sum, doc) => sum + (doc.nodes?.nodeName?.length ?? 0), 0);
  if (totalNodes === 0 || totalNodes > MAX_SNAPSHOT_NODES) return null;

  const ctx: BuildContext = {
    documents,
    strings,
    text: [],
    textLength: 0,
    headings: [],
    landmarks: [],
    controls: [],
    images: [],
    frames: [],
    truncated: false,
    refIndex: 0,
    visitedDocuments: new Set<number>(),
  };

  walkDocument(ctx, 0, 'document', { x: 0, y: 0 }, 0);

  const root = documents[0];
  const layoutViewport = metrics?.cssLayoutViewport ?? {};
  const visualViewport = metrics?.cssVisualViewport ?? {};
  const contentSize = metrics?.cssContentSize ?? {};
  const text = ctx.text.join(' ').slice(0, MAX_TEXT);

  return {
    title: clean(str(ctx, root.title), 300),
    url: sanitizeUrl(str(ctx, root.documentURL) || fallbackUrl),
    language: clean(str(ctx, root.contentLanguage), 40),
    text,
    headings: ctx.headings,
    landmarks: ctx.landmarks,
    controls: ctx.controls,
    images: ctx.images,
    frames: ctx.frames,
    viewport: {
      width: int(layoutViewport.clientWidth),
      height: int(layoutViewport.clientHeight),
      scrollX: int(visualViewport.pageX ?? root.scrollOffsetX),
      scrollY: int(visualViewport.pageY ?? root.scrollOffsetY),
      documentWidth: int(contentSize.width ?? root.contentWidth),
      documentHeight: int(contentSize.height ?? root.contentHeight),
    },
    truncated: ctx.truncated || ctx.textLength >= MAX_TEXT || ctx.controls.length >= MAX_CONTROLS,
  };
}

interface BuildContext {
  documents: DocumentSnapshot[];
  strings: string[];
  text: string[];
  textLength: number;
  headings: BrowserDomSnapshot['headings'];
  landmarks: BrowserDomSnapshot['landmarks'];
  controls: BrowserDomControl[];
  images: BrowserDomImage[];
  frames: BrowserDomSnapshot['frames'];
  truncated: boolean;
  refIndex: number;
  visitedDocuments: Set<number>;
}

interface Offset { x: number; y: number }

/**
 * Recorre un documento en orden de arbol. `offset` traslada las coordenadas del
 * documento hijo al espacio del viewport de la pestana: dentro de un iframe los
 * rectangulos nacen relativos a ese documento, y un clic necesita el punto en la
 * ventana real.
 */
function walkDocument(ctx: BuildContext, docIndex: number, scope: string, offset: Offset, depth: number): void {
  if (depth > 4) { ctx.truncated = true; return; }
  // Un documento referenciado dos veces significaria un ciclo en la captura.
  if (ctx.visitedDocuments.has(docIndex)) return;
  ctx.visitedDocuments.add(docIndex);

  const doc = ctx.documents[docIndex];
  const nodes = doc?.nodes;
  const layout = doc?.layout;
  if (!nodes?.nodeName || !nodes.nodeType) return;

  const count = nodes.nodeName.length;
  const scrollX = num(doc.scrollOffsetX);
  const scrollY = num(doc.scrollOffsetY);
  const layoutByNode = indexLayout(layout);
  const checked = rareFlags(nodes.inputChecked);
  const contentDocs = rareIntegers(nodes.contentDocumentIndex);
  const sources = rareStrings(nodes.currentSourceURL);
  const tagNames = new Array<string>(count);
  const attributeCache = new Array<Map<string, string> | undefined>(count);

  const tagOf = (index: number): string => {
    const cached = tagNames[index];
    if (cached !== undefined) return cached;
    const value = index >= 0 && index < count ? str(ctx, nodes.nodeName?.[index]).toLowerCase() : '';
    tagNames[index] = value;
    return value;
  };
  const attrsOf = (index: number): Map<string, string> => {
    const cached = attributeCache[index];
    if (cached) return cached;
    const flat = nodes.attributes?.[index] ?? [];
    const map = new Map<string, string>();
    for (let i = 0; i + 1 < flat.length; i += 2) map.set(str(ctx, flat[i]).toLowerCase(), str(ctx, flat[i + 1]));
    attributeCache[index] = map;
    return map;
  };
  const parentOf = (index: number): number => nodes.parentIndex?.[index] ?? -1;

  /** Un ancestro de tipo campo convierte su texto en dato del usuario. */
  const insideField = (index: number): boolean => {
    for (let cursor = index, guard = 0; cursor >= 0 && guard < 64; cursor = parentOf(cursor), guard += 1) {
      const tag = tagOf(cursor);
      if (FIELD_TAGS.has(tag)) return true;
      const editable = attrsOf(cursor).get('contenteditable');
      if (editable === '' || editable === 'true') return true;
    }
    return false;
  };
  const insideSkipped = (index: number): boolean => {
    for (let cursor = index, guard = 0; cursor >= 0 && guard < 64; cursor = parentOf(cursor), guard += 1) {
      if (SKIP_TEXT_TAGS.has(tagOf(cursor))) return true;
    }
    return false;
  };

  /** Rectangulo en coordenadas del viewport de la pestana. */
  const rectOf = (index: number): { x: number; y: number; width: number; height: number } | null => {
    const entry = layoutByNode.get(index);
    if (entry === undefined) return null;
    const bounds = layout?.bounds?.[entry];
    if (!Array.isArray(bounds) || bounds.length < 4) return null;
    return {
      x: bounds[0] - scrollX + offset.x,
      y: bounds[1] - scrollY + offset.y,
      width: bounds[2],
      height: bounds[3],
    };
  };
  const isRendered = (index: number): boolean => {
    const entry = layoutByNode.get(index);
    if (entry === undefined) return false;
    const styles = layout?.styles?.[entry];
    if (!Array.isArray(styles)) return true;
    // El orden es el de COMPUTED_STYLES: display, visibility, opacity.
    if (str(ctx, styles[0]) === 'none') return false;
    if (str(ctx, styles[1]) === 'hidden') return false;
    const opacity = Number(str(ctx, styles[2]));
    return !(Number.isFinite(opacity) && opacity <= 0);
  };

  /**
   * Texto de un elemento. Los nodos vienen en orden de arbol, asi que el
   * subarbol de `index` es el tramo contiguo que arranca en `index + 1` y
   * termina en el primer nodo que ya no desciende de el.
   */
  const textOf = (index: number): string => {
    const parts: string[] = [];
    let length = 0;
    for (let child = index + 1; child < count && length < MAX_FIELD_TEXT; child += 1) {
      if (!isDescendant(child, index, parentOf)) break;
      if (nodes.nodeType?.[child] !== 3) continue;
      const value = clean(str(ctx, nodes.nodeValue?.[child]), MAX_FIELD_TEXT);
      if (!value) continue;
      parts.push(value);
      length += value.length + 1;
    }
    return clean(parts.join(' '), MAX_FIELD_TEXT);
  };

  const nameOf = (index: number): string => {
    const attrs = attrsOf(index);
    const aria = attrs.get('aria-label');
    if (aria) return clean(aria, MAX_FIELD_TEXT);
    const labelledBy = attrs.get('aria-labelledby');
    if (labelledBy) {
      const ids = new Set(labelledBy.split(/\s+/).filter(Boolean));
      const found: string[] = [];
      for (let i = 0; i < count && found.length < ids.size; i += 1) {
        const id = attrsOf(i).get('id');
        if (id && ids.has(id)) found.push(textOf(i));
      }
      const joined = clean(found.join(' '), MAX_FIELD_TEXT);
      if (joined) return joined;
    }
    const ownId = attrs.get('id');
    if (ownId) {
      for (let i = 0; i < count; i += 1) {
        if (tagOf(i) === 'label' && attrsOf(i).get('for') === ownId) {
          const label = textOf(i);
          if (label) return label;
        }
      }
    }
    return clean(attrs.get('alt') || attrs.get('title') || attrs.get('placeholder') || '', MAX_FIELD_TEXT);
  };

  for (let index = 0; index < count; index += 1) {
    const nodeType = nodes.nodeType[index];

    if (nodeType === 3) {
      if (ctx.textLength >= MAX_TEXT) { ctx.truncated = true; continue; }
      const entry = layoutByNode.get(index);
      // Sin caja de texto el nodo no se pinta: no es contenido que el usuario vea.
      if (entry === undefined || layout?.text?.[entry] === undefined || layout.text[entry] < 0) continue;
      const parent = parentOf(index);
      if (parent >= 0 && (insideField(parent) || insideSkipped(parent))) continue;
      const value = clean(str(ctx, layout.text[entry]), 500);
      if (!value) continue;
      ctx.text.push(value);
      ctx.textLength += value.length + 1;
      continue;
    }
    if (nodeType !== 1) continue;

    const tag = tagOf(index);
    const attrs = attrsOf(index);
    const role = clean(attrs.get('role') ?? '', 40);

    const contentDoc = contentDocs.get(index);
    if (tag === 'iframe' || tag === 'frame') {
      if (ctx.frames.length >= MAX_FRAMES) { ctx.truncated = true; continue; }
      const accessible = contentDoc !== undefined && contentDoc >= 0 && contentDoc < ctx.documents.length;
      ctx.frames.push({
        title: clean(attrs.get('title') ?? '', MAX_FIELD_TEXT),
        url: sanitizeUrl(attrs.get('src') ?? ''),
        accessible,
      });
      if (accessible) {
        const box = rectOf(index);
        walkDocument(
          ctx,
          contentDoc,
          `frame:${clean(attrs.get('title') || attrs.get('src') || 'sin titulo', 100)}`,
          { x: box?.x ?? offset.x, y: box?.y ?? offset.y },
          depth + 1,
        );
      }
      continue;
    }

    if (!isRendered(index)) continue;

    if (/^h[1-6]$/.test(tag)) {
      if (ctx.headings.length >= MAX_HEADINGS) ctx.truncated = true;
      else {
        const value = textOf(index);
        if (value) ctx.headings.push({ level: Number(tag[1]), text: value, scope });
      }
    }

    const landmarkRole = role || LANDMARK_TAGS[tag] || '';
    if (landmarkRole && LANDMARK_ROLES.test(landmarkRole)) {
      if (ctx.landmarks.length >= MAX_LANDMARKS) ctx.truncated = true;
      else ctx.landmarks.push({ role: landmarkRole, name: nameOf(index), scope });
    }

    if (tag === 'img') {
      const box = rectOf(index);
      const source = sanitizeImageUrl(sources.get(index) ?? attrs.get('src') ?? '');
      if (source && box && Math.min(box.width, box.height) >= MIN_IMAGE_BOX_PX) {
        if (ctx.images.length >= MAX_IMAGES) ctx.truncated = true;
        else {
          ctx.images.push({
            url: source,
            alt: clean(attrs.get('alt') ?? '', MAX_FIELD_TEXT),
            width: Math.round(box.width),
            height: Math.round(box.height),
          });
        }
      }
    }

    if (!isControl(tag, role, attrs)) continue;
    if (ctx.controls.length >= MAX_CONTROLS) { ctx.truncated = true; continue; }
    const box = rectOf(index);
    if (!box || box.width <= 1 || box.height <= 1) continue;

    const backendNodeId = nodes.backendNodeId?.[index];
    if (typeof backendNodeId !== 'number' || !Number.isFinite(backendNodeId)) continue;
    ctx.refIndex += 1;

    const rawType = clean(attrs.get('type') ?? '', 40);
    const isPassword = rawType.toLowerCase() === 'password';
    const editable = FIELD_TAGS.has(tag) || attrs.get('contenteditable') === '' || attrs.get('contenteditable') === 'true';
    ctx.controls.push({
      ref: `${CDP_REF_PREFIX}${backendNodeId}`,
      tag,
      role,
      name: nameOf(index),
      // Ni el valor de un campo ni el contenido de una contrasena entran en la
      // observacion: el contrato de `read_browser_dom` lo prohibe y el modelo no
      // los necesita para decidir donde hacer clic.
      text: editable || isPassword ? '' : textOf(index),
      type: isPassword ? 'password-redacted' : rawType,
      href: tag === 'a' ? sanitizeUrl(attrs.get('href') ?? '') : '',
      disabled: attrs.has('disabled') || attrs.get('aria-disabled') === 'true',
      // `inputChecked` solo lista los marcados. Un control marcable que no
      // aparece esta desmarcado; el resto no tiene estado que informar.
      checked: CHECKABLE_TYPES.has(rawType.toLowerCase()) ? checked.has(index) : null,
      rect: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
      scope,
    });
  }
}

function isControl(tag: string, role: string, attrs: Map<string, string>): boolean {
  if (tag === 'a') return attrs.has('href');
  if (CONTROL_TAGS.has(tag)) return true;
  if (role && CONTROL_ROLES.has(role)) return true;
  const tabIndex = attrs.get('tabindex');
  if (tabIndex !== undefined && tabIndex !== '-1') return true;
  const editable = attrs.get('contenteditable');
  return editable === '' || editable === 'true';
}

/**
 * `parentIndex` encadena hacia arriba. Se acota el recorrido porque un arbol
 * corrupto no debe convertirse en un bucle infinito en el proceso principal.
 */
function isDescendant(candidate: number, ancestor: number, parentOf: (index: number) => number): boolean {
  for (let cursor = parentOf(candidate), guard = 0; cursor >= 0 && guard < 64; cursor = parentOf(cursor), guard += 1) {
    if (cursor === ancestor) return true;
    if (cursor < ancestor) return false;
  }
  return false;
}

function indexLayout(layout: LayoutTreeSnapshot | undefined): Map<number, number> {
  const map = new Map<number, number>();
  const nodeIndex = layout?.nodeIndex;
  if (!Array.isArray(nodeIndex)) return map;
  for (let i = 0; i < nodeIndex.length; i += 1) map.set(nodeIndex[i], i);
  return map;
}

function rareStrings(data: RareStringData | undefined): Map<number, string> {
  const map = new Map<number, string>();
  const index = data?.index;
  if (!Array.isArray(index)) return map;
  for (let i = 0; i < index.length; i += 1) map.set(index[i], String(data?.value?.[i] ?? ''));
  return map;
}

function rareIntegers(data: RareIntegerData | undefined): Map<number, number> {
  const map = new Map<number, number>();
  const index = data?.index;
  if (!Array.isArray(index)) return map;
  for (let i = 0; i < index.length; i += 1) {
    const value = data?.value?.[i];
    if (typeof value === 'number') map.set(index[i], value);
  }
  return map;
}

function rareFlags(data: RareBooleanData | undefined): Set<number> {
  return new Set(Array.isArray(data?.index) ? data.index : []);
}

function str(ctx: BuildContext, index: number | undefined): string {
  if (typeof index !== 'number' || index < 0) return '';
  const value = ctx.strings[index];
  return typeof value === 'string' ? value : '';
}

function clean(value: string, max: number): string {
  return value.replace(/[\p{Cc}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function int(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/** Mismo saneamiento que el backend en script: sin credenciales, sin query. */
function sanitizeUrl(value: string): string {
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

/** En las URL de imagen la query lleva tamano o firma: quitarla devuelve un 403. */
function sanitizeImageUrl(value: string): string {
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
