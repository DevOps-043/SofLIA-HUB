import { randomUUID } from 'node:crypto';
import type { WebContents } from 'electron';
import { extractAccessibleReadingDocument } from './reading-accessibility';

export const READING_CONTENT_MAX_CHARS = 60_000;
export const READING_SELECTION_MAX_CHARS = 50_000;
export const READING_MIN_CHARS = 2;
const GOOGLE_DOCS_EXPORT_TIMEOUT_MS = 8_000;
const GOOGLE_DOCS_EXPORT_MAX_BYTES = 2 * 1024 * 1024;

export type BrowserReadingBlockKind = 'heading' | 'paragraph' | 'list-item' | 'quote';

export interface BrowserReadingBlock {
  id: string;
  kind: BrowserReadingBlockKind;
  text: string;
  level: number | null;
  start: number;
  end: number;
}

export interface BrowserReadingContent {
  readingId: string;
  tabId: string;
  url: string;
  title: string;
  language: string;
  text: string;
  blocks: BrowserReadingBlock[];
  selectionOnly: boolean;
  truncated: boolean;
}

export interface BrowserReadingPrepareInput {
  sourceUrl?: string;
  selection?: string;
}

export interface BrowserReadingHighlightInput {
  readingId: string;
  text: string;
}

export type BrowserReadingToolbarActionName = 'toggle' | 'stop' | 'speed-down' | 'speed-up' | 'close' | 'closed';

export interface BrowserReadingToolbarAction {
  readingId: string;
  action: BrowserReadingToolbarActionName;
}

export interface BrowserReadingToolbarState {
  readingId: string;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'completed' | 'error';
  speed: number;
  message?: string;
}

export interface ExtractedReadingDocument {
  title: string;
  language: string;
  blocks: Array<{ kind: BrowserReadingBlockKind; text: string; level: number | null }>;
  truncated: boolean;
}

export async function collectBrowserReadingContent(input: {
  contents: WebContents;
  tabId: string;
  request: BrowserReadingPrepareInput;
}): Promise<BrowserReadingContent> {
  const currentUrl = input.contents.getURL();
  if (!/^https?:\/\//i.test(currentUrl)) {
    throw new Error('La pestaña activa no contiene una página compatible con el modo lectura.');
  }
  if (input.request.sourceUrl && !sameDocumentUrl(input.request.sourceUrl, currentUrl)) {
    throw new Error('La selección pertenece a otra pestaña. Vuelve a seleccionar el texto.');
  }

  const selection = normalizeReadingText(input.request.selection ?? '').slice(0, READING_SELECTION_MAX_CHARS);
  const extracted = selection
    ? selectionDocument(input.contents.getTitle(), selection)
    : await extractDocument(input.contents);
  const normalized = buildReadingBlocks(extracted.blocks);
  if (normalized.text.length < READING_MIN_CHARS || normalized.blocks.length === 0) {
    throw new Error('No se encontró contenido legible en esta página. Selecciona el texto e inténtalo de nuevo.');
  }

  return {
    readingId: randomUUID(),
    tabId: input.tabId,
    url: currentUrl,
    title: normalizeReadingText(extracted.title).slice(0, 300) || 'Lectura sin título',
    language: normalizeLanguage(extracted.language),
    text: normalized.text,
    blocks: normalized.blocks,
    selectionOnly: Boolean(selection),
    truncated: extracted.truncated || normalized.truncated,
  };
}

/**
 * Instala un mapa efímero entre offsets del texto preparado y nodos de la
 * página. No envuelve ni modifica el contenido: usa CSS Custom Highlights.
 */
export async function installBrowserReadingHighlight(
  contents: WebContents,
  input: BrowserReadingHighlightInput,
): Promise<boolean> {
  if (contents.isDestroyed()) return false;
  const script = `(${installReadingHighlightInPage.toString()})(${JSON.stringify(input)})`;
  return Boolean(await contents.executeJavaScript(script, true));
}

export async function updateBrowserReadingHighlight(
  contents: WebContents,
  input: { readingId: string; revision: number; start?: number; end?: number },
): Promise<boolean> {
  if (contents.isDestroyed()) return false;
  const script = `(${updateReadingHighlightInPage.toString()})(${JSON.stringify(input)})`;
  return Boolean(await contents.executeJavaScript(script, true));
}

export async function clearBrowserReadingHighlight(contents: WebContents, readingId: string): Promise<void> {
  if (contents.isDestroyed()) return;
  const script = `(${clearReadingHighlightInPage.toString()})(${JSON.stringify(readingId)})`;
  await contents.executeJavaScript(script, true);
}

export async function installBrowserReadingToolbar(
  contents: WebContents,
  input: { readingId: string; selectionOnly: boolean; text: string },
): Promise<boolean> {
  if (contents.isDestroyed()) return false;
  const script = `(${installReadingToolbarInPage.toString()})(${JSON.stringify(input)})`;
  return Boolean(await contents.executeJavaScript(script, true));
}

export async function waitForBrowserReadingToolbarAction(
  contents: WebContents,
  readingId: string,
): Promise<BrowserReadingToolbarAction> {
  if (contents.isDestroyed()) return { readingId, action: 'closed' };
  const script = `(${waitForReadingToolbarActionInPage.toString()})(${JSON.stringify(readingId)})`;
  return await contents.executeJavaScript(script, true) as BrowserReadingToolbarAction;
}

export async function updateBrowserReadingToolbar(
  contents: WebContents,
  state: BrowserReadingToolbarState,
): Promise<boolean> {
  if (contents.isDestroyed()) return false;
  const script = `(${updateReadingToolbarInPage.toString()})(${JSON.stringify(state)})`;
  return Boolean(await contents.executeJavaScript(script, true));
}

export async function clearBrowserReadingToolbar(contents: WebContents, readingId: string): Promise<void> {
  if (contents.isDestroyed()) return;
  const script = `(${clearReadingToolbarInPage.toString()})(${JSON.stringify(readingId)})`;
  await contents.executeJavaScript(script, true);
}

export function normalizeReadingText(value: string): string {
  return value
    .replace(/\u00ad/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ \u00a0]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function selectionDocument(title: string, selection: string): ExtractedReadingDocument {
  const paragraphs = selection.split(/\n{2,}|(?<=\.)\s*\n/).map(normalizeReadingText).filter(Boolean);
  return {
    title,
    language: '',
    blocks: (paragraphs.length ? paragraphs : [selection]).map((text) => ({ kind: 'paragraph', text, level: null })),
    truncated: selection.length >= READING_SELECTION_MAX_CHARS,
  };
}

async function extractDocument(contents: WebContents): Promise<ExtractedReadingDocument> {
  const currentUrl = contents.getURL();
  if (isGoogleDocsDocument(currentUrl)) {
    // La exportación se solicita desde la misma Session de Electron. Hacerla
    // dentro de la página provoca redirecciones bloqueadas por CORS/CORP y
    // terminaba leyendo la barra lateral como respaldo.
    const exported = await extractGoogleDocsExport(contents, currentUrl);
    if (exported) return exported;
    const accessible = await extractAccessibleReadingDocument(contents, READING_CONTENT_MAX_CHARS);
    if (accessible) return accessible;
    throw new Error(
      'Google Docs no expuso el contenido del documento. Activa la compatibilidad con lectores de pantalla en Herramientas > ConfiguraciÃ³n de accesibilidad y vuelve a intentarlo.',
    );
  }
  const script = `(${extractReadingDocumentInPage.toString()})(${READING_CONTENT_MAX_CHARS})`;
  const result = await contents.executeJavaScript(script, true) as ExtractedReadingDocument | null;
  if (!result || !Array.isArray(result.blocks)) throw new Error('La página no entregó contenido legible.');
  return result;
}

export async function updateBrowserReadingToolbarCue(
  contents: WebContents,
  input: { readingId: string; text?: string },
): Promise<boolean> {
  if (contents.isDestroyed()) return false;
  const script = `(${updateReadingToolbarCueInPage.toString()})(${JSON.stringify(input)})`;
  return Boolean(await contents.executeJavaScript(script, true));
}

async function extractGoogleDocsExport(contents: WebContents, currentUrl: string): Promise<ExtractedReadingDocument | null> {
  let documentId: string;
  try {
    const parsed = new URL(currentUrl);
    const match = parsed.pathname.match(/^\/document\/d\/([A-Za-z0-9_-]{10,200})(?:\/|$)/);
    documentId = match?.[1] ?? '';
  } catch {
    return null;
  }
  if (!documentId) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_DOCS_EXPORT_TIMEOUT_MS);
  try {
    const response = await contents.session.fetch(
      `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/export?format=txt`,
      {
        method: 'GET',
        credentials: 'include',
        redirect: 'follow',
        signal: controller.signal,
        headers: { Accept: 'text/plain' },
      },
    );
    if (!response.ok) return null;
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.includes('text/plain') && !contentType.includes('application/octet-stream')) return null;
    const announcedLength = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(announcedLength) && announcedLength > GOOGLE_DOCS_EXPORT_MAX_BYTES) return null;
    const raw = await response.text();
    if (!raw || raw.length > GOOGLE_DOCS_EXPORT_MAX_BYTES || /^\s*(?:<!doctype html|<html\b)/i.test(raw)) return null;
    const complete = normalizeReadingText(raw);
    if (complete.length < READING_MIN_CHARS) return null;
    const clipped = complete.slice(0, READING_CONTENT_MAX_CHARS);
    const paragraphs = clipped.split(/\n{2,}|\n/u).map(normalizeReadingText).filter(Boolean);
    return {
      title: normalizeReadingText(contents.getTitle()) || 'Documento de Google',
      language: '',
      blocks: paragraphs.map((text) => ({ kind: 'paragraph', text, level: null })),
      truncated: complete.length > clipped.length,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildReadingBlocks(rawBlocks: ExtractedReadingDocument['blocks']): {
  text: string;
  blocks: BrowserReadingBlock[];
  truncated: boolean;
} {
  const blocks: BrowserReadingBlock[] = [];
  let text = '';
  let truncated = false;
  for (const raw of rawBlocks) {
    const value = normalizeReadingText(String(raw.text ?? ''));
    if (!value || isLowValueBlock(value)) continue;
    const separator = text ? '\n\n' : '';
    if (text.length + separator.length + value.length > READING_CONTENT_MAX_CHARS) {
      const remaining = READING_CONTENT_MAX_CHARS - text.length - separator.length;
      if (remaining >= 40) {
        const clipped = clipAtWord(value, remaining);
        const start = text.length + separator.length;
        text += separator + clipped;
        blocks.push({ id: `reading-block-${blocks.length + 1}`, kind: normalizeKind(raw.kind), text: clipped, level: normalizeLevel(raw.level), start, end: start + clipped.length });
      }
      truncated = true;
      break;
    }
    const start = text.length + separator.length;
    text += separator + value;
    blocks.push({ id: `reading-block-${blocks.length + 1}`, kind: normalizeKind(raw.kind), text: value, level: normalizeLevel(raw.level), start, end: start + value.length });
  }
  return { text, blocks, truncated };
}

function normalizeKind(value: unknown): BrowserReadingBlockKind {
  return value === 'heading' || value === 'list-item' || value === 'quote' ? value : 'paragraph';
}

function normalizeLevel(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 6 ? value : null;
}

function normalizeLanguage(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(normalized) ? normalized : 'es';
}

function isLowValueBlock(value: string): boolean {
  if (value.length < 2) return true;
  return /^(?:menu|menú|inicio|home|compartir|share|cerrar|close|buscar|search)$/i.test(value);
}

function clipAtWord(value: string, maxLength: number): string {
  const slice = value.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? slice.slice(0, lastSpace) : slice).trimEnd();
}

function sameDocumentUrl(expected: string, current: string): boolean {
  try {
    const left = new URL(expected);
    const right = new URL(current);
    left.hash = '';
    right.hash = '';
    return left.toString() === right.toString();
  } catch {
    return false;
  }
}

export function isGoogleDocsDocument(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'docs.google.com'
      && /^\/document\/d\/[A-Za-z0-9_-]{10,200}(?:\/|$)/.test(url.pathname);
  } catch {
    return false;
  }
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function extractReadingDocumentInPage(maxChars: number): ExtractedReadingDocument {
  const blockedSelector = [
    'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'video', 'audio',
    'nav', 'aside', 'header[role="banner"]', 'footer', 'form', 'input', 'textarea',
    'select', 'button', '[contenteditable="true"]', '[role="textbox"]', '[aria-hidden="true"]',
  ].join(',');
  const clean = (value: string) => value
    .replace(/\u00ad/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ \u00a0]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const visible = (element: Element) => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0;
  };
  // Puntuacion de contenido al estilo de los modos lectura del navegador: en vez
  // de confiar en que la pagina use <article> o <main> —la mayoria no lo hace—,
  // se mide densidad de prosa. Los menus y barras laterales pierden porque su
  // texto vive casi todo dentro de enlaces y sus nombres los delatan.
  const PALABRAS_MALAS = ['nav', 'menu', 'sidebar', 'aside', 'footer', 'header', 'comment', 'promo', 'banner', 'toolbar', 'breadcrumb', 'related', 'share', 'social', 'popup', 'modal', 'cookie', 'widget', 'tab'];
  const PALABRAS_BUENAS = ['article', 'content', 'main', 'post', 'story', 'body', 'entry', 'document', 'reader', 'prose'];

  const puntuar = (element: Element): number => {
    if (!visible(element)) return -1;
    const propio = clean((element as HTMLElement).innerText || '');
    if (propio.length < 120) return -1;
    // El texto que vive dentro de enlaces no es prosa: es navegacion.
    let enlazado = 0;
    for (const enlace of Array.from(element.querySelectorAll('a'))) {
      enlazado += clean((enlace as HTMLElement).innerText || '').length;
    }
    const prosa = propio.length - enlazado;
    if (prosa < 100) return -1;
    let puntos = prosa;
    // Los parrafos reales son la senal mas fiable de cuerpo de texto.
    puntos += element.querySelectorAll('p').length * 40;
    const nombre = ((element.getAttribute('class') || '') + ' ' + (element.getAttribute('id') || '')).toLowerCase();
    for (const mala of PALABRAS_MALAS) if (nombre.indexOf(mala) !== -1) puntos -= 600;
    for (const buena of PALABRAS_BUENAS) if (nombre.indexOf(buena) !== -1) puntos += 400;
    const etiqueta = element.tagName.toLowerCase();
    if (etiqueta === 'article' || etiqueta === 'main') puntos += 800;
    if (element.getAttribute('role') === 'main') puntos += 800;
    if (etiqueta === 'nav' || etiqueta === 'aside' || etiqueta === 'footer' || etiqueta === 'header') puntos -= 1_200;
    return puntos;
  };

  let root: Element = document.body;
  let mejor = 0;
  for (const candidato of Array.from(document.querySelectorAll('article, main, section, div, td, [role="main"], [role="article"]'))) {
    const puntos = puntuar(candidato);
    // Ante empate gana el mas profundo: acota al bloque de contenido y descarta
    // los contenedores que lo envuelven junto con el resto de la pagina.
    if (puntos > mejor || (puntos === mejor && puntos > 0 && root.contains(candidato))) {
      mejor = puntos;
      root = candidato;
    }
  }
  const blocks: ExtractedReadingDocument['blocks'] = [];
  let length = 0;
  let truncated = false;
  const selector = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,[role="heading"]';
  for (const element of Array.from(root.querySelectorAll(selector))) {
    if (element.matches(blockedSelector) || element.closest(blockedSelector) || !visible(element)) continue;
    const semanticParent = element.parentElement?.closest('li, blockquote');
    if (semanticParent && semanticParent !== element) continue;
    const htmlElement = element as HTMLElement;
    if (htmlElement.isContentEditable) continue;
    const value = clean(htmlElement.innerText || element.textContent || '');
    if (value.length < 2) continue;
    const tag = element.tagName.toLowerCase();
    const kind: BrowserReadingBlockKind = /^h[1-6]$/.test(tag) || element.getAttribute('role') === 'heading'
      ? 'heading'
      : tag === 'li' ? 'list-item' : tag === 'blockquote' ? 'quote' : 'paragraph';
    const levelValue = kind === 'heading'
      ? Number(tag.slice(1)) || Number(element.getAttribute('aria-level')) || 2
      : null;
    if (length + value.length > maxChars) {
      truncated = true;
      break;
    }
    blocks.push({ kind, text: value, level: levelValue });
    length += value.length + 2;
  }
  if (blocks.length === 0 && root instanceof HTMLElement) {
    // El respaldo nunca debe incorporar campos editables ni controles. Se
    // trabaja sobre una copia para no mutar la pagina del usuario.
    const sanitizedRoot = root.cloneNode(true) as HTMLElement;
    for (const blocked of Array.from(sanitizedRoot.querySelectorAll(blockedSelector))) blocked.remove();
    const fallback = clean(sanitizedRoot.textContent || '');
    if (fallback) {
      const text = fallback.slice(0, maxChars);
      blocks.push({ kind: 'paragraph', text, level: null });
      truncated = fallback.length > text.length;
    }
  }
  return {
    title: clean(document.title || document.querySelector('h1')?.textContent || '') || 'Lectura sin título',
    language: document.documentElement.lang || '',
    blocks,
    truncated,
  };
}

type ReadingTextPosition = { node: Text; offset: number };
type ReadingHighlightSession = {
  sourceText: string;
  sourceOffsets: number[];
  documentText: string;
  documentPositions: ReadingTextPosition[];
  baseOffset: number | null;
  lastDocumentStart: number;
  revision: number;
};

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function installReadingHighlightInPage(input: BrowserReadingHighlightInput): boolean {
  const scope = globalThis as typeof globalThis & {
    __sofliaReadingHighlights?: Map<string, ReadingHighlightSession>;
  };
  const normalizeSource = (value: string) => {
    let normalized = '';
    const offsets = new Array<number>(value.length + 1);
    for (let index = 0; index < value.length; index += 1) {
      offsets[index] = normalized.length;
      const character = value[index];
      if (character === '\u00ad') continue;
      if (/\s/u.test(character)) {
        if (normalized && normalized[normalized.length - 1] !== ' ') normalized += ' ';
      } else {
        normalized += character;
      }
    }
    offsets[value.length] = normalized.length;
    return { text: normalized.trim(), offsets };
  };
  const source = normalizeSource(input.text);
  if (!source.text || !document.body) return false;

  const positions: ReadingTextPosition[] = [];
  let documentText = '';
  let visitedNodes = 0;
  const maxNodes = 20_000;
  const maxCharacters = 240_000;
  const blocked = 'script,style,noscript,template,svg,canvas,video,audio,input,textarea,select,button,[aria-hidden="true"]';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (visitedNodes >= maxNodes || documentText.length >= maxCharacters) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest(blocked)) return NodeFilter.FILTER_REJECT;
      if (typeof parent.checkVisibility === 'function' && !parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let current = walker.nextNode() as Text | null;
  while (current && visitedNodes < maxNodes && documentText.length < maxCharacters) {
    visitedNodes += 1;
    const value = current.nodeValue || '';
    if (documentText && documentText[documentText.length - 1] !== ' ') {
      documentText += ' ';
      positions.push({ node: current, offset: 0 });
    }
    for (let offset = 0; offset < value.length && documentText.length < maxCharacters; offset += 1) {
      const character = value[offset];
      if (character === '\u00ad') continue;
      if (/\s/u.test(character)) {
        if (documentText && documentText[documentText.length - 1] !== ' ') {
          documentText += ' ';
          positions.push({ node: current, offset });
        }
      } else {
        documentText += character;
        positions.push({ node: current, offset });
      }
    }
    current = walker.nextNode() as Text | null;
  }
  if (!documentText || positions.length !== documentText.length) return false;

  scope.__sofliaReadingHighlights ??= new Map();
  scope.__sofliaReadingHighlights.set(input.readingId, {
    sourceText: source.text,
    sourceOffsets: source.offsets,
    documentText,
    documentPositions: positions,
    baseOffset: documentText.indexOf(source.text),
    lastDocumentStart: -1,
    revision: 0,
  });

  const styleId = 'soflia-reading-highlight-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '::highlight(soflia-pulsehub-reading-active-v1){background:rgba(0,214,190,.2);color:inherit;text-decoration:underline 2px #00d6be;text-underline-offset:3px}';
    document.head?.appendChild(style);
  }
  return true;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function updateReadingHighlightInPage(input: { readingId: string; revision: number; start?: number; end?: number }): boolean {
  const scope = globalThis as typeof globalThis & {
    __sofliaReadingHighlights?: Map<string, ReadingHighlightSession>;
    Highlight?: new (...ranges: Range[]) => unknown;
  };
  const registry = (CSS as typeof CSS & { highlights?: { set: (name: string, value: unknown) => void; delete: (name: string) => void } }).highlights;
  const session = scope.__sofliaReadingHighlights?.get(input.readingId);
  if (!registry || !session || !scope.Highlight) return false;
  if (!Number.isSafeInteger(input.revision) || input.revision <= session.revision) return false;
  session.revision = input.revision;
  if (input.start === undefined || input.end === undefined) {
    registry.delete('soflia-pulsehub-reading-active-v1');
    session.lastDocumentStart = -1;
    return true;
  }
  if (!Number.isSafeInteger(input.start) || !Number.isSafeInteger(input.end)
    || input.start < 0 || input.end <= input.start || input.end > session.sourceOffsets.length - 1) return false;

  const sourceStart = session.sourceOffsets[input.start];
  const sourceEnd = session.sourceOffsets[input.end];
  if (!Number.isSafeInteger(sourceStart) || !Number.isSafeInteger(sourceEnd) || sourceEnd <= sourceStart) return false;
  let base = session.baseOffset;
  if (base === null || base < 0) {
    const contextStart = Math.max(0, sourceStart - 64);
    const contextEnd = Math.min(session.sourceText.length, sourceEnd + 64);
    const context = session.sourceText.slice(contextStart, contextEnd);
    const found = session.documentText.indexOf(context);
    if (found >= 0) base = found - contextStart;
  }
  let documentStart = base === null || base < 0 ? -1 : base + sourceStart;
  let documentEnd = base === null || base < 0 ? -1 : base + sourceEnd;
  if (documentStart < 0 || documentEnd > session.documentPositions.length) {
    const target = session.sourceText.slice(sourceStart, sourceEnd).trim();
    if (!target) return false;
    const matches: number[] = [];
    let from = 0;
    while (matches.length < 64) {
      const found = session.documentText.indexOf(target, from);
      if (found < 0) break;
      matches.push(found);
      from = found + Math.max(1, target.length);
    }
    if (!matches.length) return false;
    documentStart = matches.reduce((best, candidate) => (
      session.lastDocumentStart < 0 || Math.abs(candidate - session.lastDocumentStart) < Math.abs(best - session.lastDocumentStart)
        ? candidate
        : best
    ), matches[0]);
    documentEnd = documentStart + target.length;
  }

  const startPosition = session.documentPositions[documentStart];
  const endPosition = session.documentPositions[documentEnd - 1];
  if (!startPosition || !endPosition || !startPosition.node.isConnected || !endPosition.node.isConnected) return false;
  const range = document.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, Math.min(endPosition.offset + 1, endPosition.node.length));
  registry.set('soflia-pulsehub-reading-active-v1', new scope.Highlight(range));
  session.lastDocumentStart = documentStart;
  startPosition.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function clearReadingHighlightInPage(readingId: string): boolean {
  const scope = globalThis as typeof globalThis & {
    __sofliaReadingHighlights?: Map<string, ReadingHighlightSession>;
  };
  const registry = (CSS as typeof CSS & { highlights?: { delete: (name: string) => void } }).highlights;
  registry?.delete('soflia-pulsehub-reading-active-v1');
  const removed = scope.__sofliaReadingHighlights?.delete(readingId) ?? false;
  if (!scope.__sofliaReadingHighlights?.size) document.getElementById('soflia-reading-highlight-style')?.remove();
  return removed;
}

type ReadingToolbarPageSession = {
  host: HTMLElement;
  shadow: ShadowRoot;
  anchorRange: Range | null;
  actions: BrowserReadingToolbarAction[];
  waiters: Set<(action: BrowserReadingToolbarAction) => void>;
  reposition: () => void;
  release: () => void;
};

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function installReadingToolbarInPage(input: { readingId: string; selectionOnly: boolean; text: string }): boolean {
  const scope = globalThis as typeof globalThis & {
    __sofliaReadingToolbars?: Map<string, ReadingToolbarPageSession>;
  };
  if (!document.body || !/^[A-Za-z0-9_-]{8,100}$/.test(input.readingId)) return false;

  const previous = scope.__sofliaReadingToolbars?.get(input.readingId);
  if (previous) {
    const closed = { readingId: input.readingId, action: 'closed' as const };
    for (const resolve of previous.waiters) resolve(closed);
    previous.waiters.clear();
    if (typeof previous.release === 'function') previous.release();
    else {
      window.removeEventListener('scroll', previous.reposition, true);
      window.removeEventListener('resize', previous.reposition);
    }
    previous.host.remove();
    scope.__sofliaReadingToolbars?.delete(input.readingId);
  }

  const currentSelection = window.getSelection();
  const virtualGoogleDocument = location.hostname === 'docs.google.com'
    && /^\/document\/d\//.test(location.pathname);
  let anchorRange: Range | null = null;
  if (input.selectionOnly && currentSelection?.rangeCount && !currentSelection.isCollapsed) {
    anchorRange = currentSelection.getRangeAt(0).cloneRange();
  }
  // Google Docs pinta el lienzo documental fuera del DOM de texto convencional.
  // Buscar una palabra de respaldo allÃ­ anclaba la cÃ¡psula a menÃºs laterales
  // con etiquetas repetidas. Sin un Range explÃ­cito se conserva la posiciÃ³n
  // flotante predeterminada, que ademÃ¡s sigue siendo movible.
  if (!anchorRange && !virtualGoogleDocument) {
    const needle = input.text.trim().split(/\s+/u).slice(0, 5).join(' ');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,noscript,template,svg,canvas,input,textarea,select,button,[aria-hidden="true"]')) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    let node = walker.nextNode() as Text | null;
    while (node) {
      const value = node.nodeValue || '';
      const firstWord = needle.split(' ')[0] || '';
      const start = firstWord ? value.indexOf(firstWord) : -1;
      if (start >= 0) {
        anchorRange = document.createRange();
        anchorRange.setStart(node, start);
        anchorRange.setEnd(node, Math.min(node.length, start + Math.max(firstWord.length, 1)));
        break;
      }
      node = walker.nextNode() as Text | null;
    }
  }

  const host = document.createElement('div');
  host.dataset.sofliaReadingToolbar = input.readingId;
  host.style.cssText = 'position:fixed;left:16px;top:16px;z-index:2147483647;width:max-content;max-width:calc(100vw - 24px);pointer-events:auto;contain:layout style paint;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host{color-scheme:light dark}
    *{box-sizing:border-box}
    .bar{display:flex;align-items:center;gap:5px;min-height:44px;padding:5px 7px;border:1px solid color-mix(in srgb,#00cdb5 32%,transparent);border-radius:18px;background:color-mix(in srgb,#0d141b 94%,transparent);color:#f6fbfa;box-shadow:0 16px 42px rgba(2,8,16,.34),0 2px 10px rgba(2,8,16,.22);backdrop-filter:blur(18px) saturate(1.12);font-family:"Inter Tight",Inter,system-ui,sans-serif;user-select:none}
    .drag{width:22px;height:32px;margin-left:-2px;border-radius:10px;color:#81909b;cursor:grab;touch-action:none}
    .drag:active{cursor:grabbing;transform:none}
    .drag svg{width:13px;height:17px}
    .status{width:7px;height:7px;margin:0 2px 0 0;border-radius:999px;background:#66727d;box-shadow:0 0 0 3px rgba(102,114,125,.12)}
    .cue{display:none;max-width:min(150px,30vw);overflow:hidden;color:#d9e4e3;font:650 12px/1.2 "Inter Tight",Inter,system-ui,sans-serif;text-decoration:underline 2px #00d6be;text-underline-offset:4px;text-overflow:ellipsis;white-space:nowrap}
    .cue[data-visible="true"]{display:block}
    .bar[data-status="playing"] .status{background:#00d6be;box-shadow:0 0 0 3px rgba(0,214,190,.16)}
    .bar[data-status="loading"] .status{background:#f6b84a;animation:pulse 1s ease-in-out infinite}
    .bar[data-status="error"] .status{background:#fb7185}
    button{display:grid;place-items:center;width:32px;height:32px;padding:0;border:0;border-radius:11px;background:transparent;color:inherit;cursor:pointer;transition:background 140ms ease,color 140ms ease,transform 140ms ease;font:600 14px/1 "Inter Tight",Inter,system-ui,sans-serif}
    button:hover{background:rgba(255,255,255,.09);color:#00e1c7}
    button:active{transform:scale(.94)}
    button:focus-visible{outline:2px solid #00d6be;outline-offset:2px}
    button:disabled{cursor:not-allowed;opacity:.34}
    .primary{background:#00d6be;color:#06211e;box-shadow:0 6px 18px rgba(0,214,190,.22)}
    .primary:hover{background:#22e3ca;color:#061b19}
    .speed{min-width:38px;padding:0 4px;color:#a9b5be;font:650 11px/1 "IBM Plex Sans",ui-monospace,monospace;text-align:center}
    .divider{width:1px;height:20px;margin:0 2px;background:rgba(255,255,255,.1)}
    svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    @keyframes pulse{50%{opacity:.38}}
    @media(prefers-color-scheme:light){.bar{background:rgba(255,255,255,.94);color:#10283f;border-color:rgba(0,142,130,.26);box-shadow:0 16px 38px rgba(17,37,58,.18),0 2px 8px rgba(17,37,58,.1)}button:hover{background:rgba(10,47,73,.07);color:#008f82}.divider{background:rgba(10,47,73,.12)}}
    @media(prefers-reduced-motion:reduce){button,.status{transition:none!important;animation:none!important}}
  `;
  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.dataset.status = 'idle';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Controles del modo lectura de SofLIA');
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const createSvg = () => {
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    return svg;
  };
  const createPathIcon = (pathData: string, marker?: string) => {
    const svg = createSvg();
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', pathData);
    if (marker) {
      path.setAttribute(marker, '');
      path.setAttribute('fill', 'currentColor');
      path.setAttribute('stroke', 'none');
    }
    svg.append(path);
    return svg;
  };
  const createButton = (
    action: BrowserReadingToolbarActionName,
    label: string,
    title: string,
    content: SVGElement | string,
  ) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.setAttribute('aria-label', label);
    button.title = title;
    if (typeof content === 'string') button.textContent = content;
    else button.append(content);
    return button;
  };
  const createDivider = () => {
    const divider = document.createElement('span');
    divider.className = 'divider';
    divider.setAttribute('aria-hidden', 'true');
    return divider;
  };

  const statusDot = document.createElement('span');
  statusDot.className = 'status';
  statusDot.setAttribute('aria-hidden', 'true');
  const cue = document.createElement('span');
  cue.className = 'cue';
  cue.dataset.visible = 'false';
  cue.setAttribute('aria-label', 'Texto que se está narrando');
  const dragButton = document.createElement('button');
  dragButton.type = 'button';
  dragButton.className = 'drag';
  dragButton.setAttribute('aria-label', 'Mover reproductor');
  dragButton.title = 'Mover reproductor · doble clic para restablecer';
  dragButton.append(createPathIcon('M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01'));
  const toggleButton = createButton(
    'toggle',
    'Reproducir narración',
    'Reproducir',
    createPathIcon('M9 6l9 6-9 6z', 'data-play-icon'),
  );
  toggleButton.className = 'primary';
  const stopIcon = createSvg();
  const stopRect = document.createElementNS(svgNamespace, 'rect');
  stopRect.setAttribute('x', '7');
  stopRect.setAttribute('y', '7');
  stopRect.setAttribute('width', '10');
  stopRect.setAttribute('height', '10');
  stopRect.setAttribute('rx', '1');
  stopRect.setAttribute('fill', 'currentColor');
  stopRect.setAttribute('stroke', 'none');
  stopIcon.append(stopRect);
  const stopButton = createButton('stop', 'Detener narración', 'Detener', stopIcon);
  const speedDownButton = createButton('speed-down', 'Disminuir velocidad', 'Disminuir velocidad', '−');
  const speedLabel = document.createElement('span');
  speedLabel.className = 'speed';
  speedLabel.setAttribute('aria-label', 'Velocidad 1 por');
  speedLabel.textContent = '1×';
  const speedUpButton = createButton('speed-up', 'Aumentar velocidad', 'Aumentar velocidad', '+');
  const closeButton = createButton(
    'close',
    'Cerrar modo lectura',
    'Cerrar',
    createPathIcon('M7 7l10 10M17 7L7 17'),
  );
  bar.append(
    dragButton,
    statusDot,
    cue,
    toggleButton,
    stopButton,
    createDivider(),
    speedDownButton,
    speedLabel,
    speedUpButton,
    createDivider(),
    closeButton,
  );
  shadow.append(style, bar);
  document.body.appendChild(host);

  const actions: BrowserReadingToolbarAction[] = [];
  const waiters = new Set<(action: BrowserReadingToolbarAction) => void>();
  const emit = (action: BrowserReadingToolbarActionName) => {
    const payload = { readingId: input.readingId, action };
    const waiter = waiters.values().next().value as ((value: BrowserReadingToolbarAction) => void) | undefined;
    if (waiter) {
      waiters.delete(waiter);
      waiter(payload);
    } else if (actions.length < 8) {
      actions.push(payload);
    }
  };
  bar.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action as BrowserReadingToolbarActionName;
    if (action === 'toggle') bar.dataset.status = bar.dataset.status === 'playing' ? 'paused' : 'loading';
    emit(action);
  });

  let frame = 0;
  let manuallyPositioned = false;
  let dragPointerId: number | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  const placeInsideViewport = (left: number, top: number) => {
    const toolbarRect = host.getBoundingClientRect();
    const width = Math.max(toolbarRect.width, 286);
    const height = Math.max(toolbarRect.height, 44);
    host.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - width - 8, left)))}px`;
    host.style.top = `${Math.round(Math.max(8, Math.min(innerHeight - height - 8, top)))}px`;
  };
  const reposition = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const toolbarRect = host.getBoundingClientRect();
      if (manuallyPositioned) {
        placeInsideViewport(toolbarRect.left, toolbarRect.top);
        return;
      }
      const rangeRects: DOMRect[] = (() => {
        try {
          return anchorRange && typeof anchorRange.getClientRects === 'function'
            ? Array.from(anchorRange.getClientRects())
            : [];
        } catch {
          // Los sitios SPA pueden reemplazar el nodo seleccionado después de abrir
          // el lector. La cápsula permanece accesible y se centra de forma segura.
          return [];
        }
      })();
      const anchor = rangeRects.find((rect) => rect.bottom >= 8 && rect.top <= innerHeight - 8) ?? rangeRects[0] ?? null;
      const width = Math.max(toolbarRect.width, 286);
      const left = anchor ? anchor.left + (anchor.width - width) / 2 : (innerWidth - width) / 2;
      let top = anchor ? anchor.top - Math.max(toolbarRect.height, 44) - 10 : 16;
      if (anchor && top < 8) top = Math.min(innerHeight - Math.max(toolbarRect.height, 44) - 8, anchor.bottom + 10);
      placeInsideViewport(left, top);
    });
  };
  const finishDrag = (event: PointerEvent) => {
    if (dragPointerId !== event.pointerId) return;
    if (typeof dragButton.releasePointerCapture === 'function' && dragButton.hasPointerCapture?.(event.pointerId)) {
      dragButton.releasePointerCapture(event.pointerId);
    }
    dragPointerId = null;
  };
  dragButton.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = host.getBoundingClientRect();
    dragPointerId = event.pointerId;
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    if (typeof dragButton.setPointerCapture === 'function') dragButton.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  dragButton.addEventListener('pointermove', (event) => {
    if (dragPointerId !== event.pointerId) return;
    manuallyPositioned = true;
    placeInsideViewport(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
  });
  dragButton.addEventListener('pointerup', finishDrag);
  dragButton.addEventListener('pointercancel', finishDrag);
  dragButton.addEventListener('dblclick', () => {
    manuallyPositioned = false;
    reposition();
  });
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  const release = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
  };
  scope.__sofliaReadingToolbars ??= new Map();
  scope.__sofliaReadingToolbars.set(input.readingId, { host, shadow, anchorRange, actions, waiters, reposition, release });
  reposition();
  return true;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function updateReadingToolbarCueInPage(input: { readingId: string; text?: string }): boolean {
  const scope = globalThis as typeof globalThis & {
    __sofliaReadingToolbars?: Map<string, ReadingToolbarPageSession>;
  };
  const session = scope.__sofliaReadingToolbars?.get(input.readingId);
  const cue = session?.shadow.querySelector<HTMLElement>('.cue');
  if (!cue) return false;
  const text = String(input.text ?? '').replace(/\s+/gu, ' ').trim().slice(0, 80);
  cue.textContent = text;
  cue.dataset.visible = text ? 'true' : 'false';
  cue.title = text;
  session?.reposition();
  return true;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function waitForReadingToolbarActionInPage(readingId: string): Promise<BrowserReadingToolbarAction> {
  const scope = globalThis as typeof globalThis & {
    __sofliaReadingToolbars?: Map<string, ReadingToolbarPageSession>;
  };
  const session = scope.__sofliaReadingToolbars?.get(readingId);
  if (!session) return Promise.resolve({ readingId, action: 'closed' });
  const queued = session.actions.shift();
  if (queued) return Promise.resolve(queued);
  return new Promise((resolve) => session.waiters.add(resolve));
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function updateReadingToolbarInPage(state: BrowserReadingToolbarState): boolean {
  const scope = globalThis as typeof globalThis & {
    __sofliaReadingToolbars?: Map<string, ReadingToolbarPageSession>;
  };
  const session = scope.__sofliaReadingToolbars?.get(state.readingId);
  if (!session) return false;
  const bar = session.shadow.querySelector<HTMLElement>('.bar');
  const toggle = session.shadow.querySelector<HTMLButtonElement>('[data-action="toggle"]');
  const speed = session.shadow.querySelector<HTMLElement>('.speed');
  const playIcon = session.shadow.querySelector<SVGPathElement>('[data-play-icon]');
  if (!bar || !toggle || !speed || !playIcon) return false;
  bar.dataset.status = state.status;
  toggle.disabled = state.status === 'loading';
  toggle.setAttribute('aria-label', state.status === 'playing' ? 'Pausar narración' : 'Reproducir narración');
  toggle.title = state.status === 'playing' ? 'Pausar' : state.status === 'loading' ? 'Generando audio…' : 'Reproducir';
  playIcon.setAttribute('d', state.status === 'playing' ? 'M8 6h3v12H8zM14 6h3v12h-3z' : 'M9 6l9 6-9 6z');
  speed.textContent = `${state.speed}×`;
  speed.setAttribute('aria-label', `Velocidad ${state.speed} por`);
  bar.title = state.message || '';
  return true;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function clearReadingToolbarInPage(readingId: string): boolean {
  const scope = globalThis as typeof globalThis & {
    __sofliaReadingToolbars?: Map<string, ReadingToolbarPageSession>;
  };
  const session = scope.__sofliaReadingToolbars?.get(readingId);
  if (!session) return false;
  const closed = { readingId, action: 'closed' as const };
  for (const resolve of session.waiters) resolve(closed);
  session.waiters.clear();
  if (typeof session.release === 'function') session.release();
  else {
    window.removeEventListener('scroll', session.reposition, true);
    window.removeEventListener('resize', session.reposition);
  }
  session.host.remove();
  scope.__sofliaReadingToolbars?.delete(readingId);
  return true;
}
