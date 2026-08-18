import type { WebContents } from 'electron';
import { withCdpSession } from './cdp-session';
import type { BrowserReadingBlockKind, ExtractedReadingDocument } from './reading-mode-content';

const AX_MAX_NODES = 20_000;
const AX_CAPTURE_TIMEOUT_MS = 5_000;
const AX_CONTENT_ROLES = new Set([
  'statictext', 'heading', 'paragraph', 'listitem', 'blockquote', 'caption',
  'cell', 'columnheader', 'rowheader', 'term', 'definition',
]);
const AX_CANDIDATE_ROLES = new Set(['textbox', 'document', 'article', 'main', 'application', 'rootwebarea']);
const AX_CONTROL_ROLES = new Set([
  'button', 'checkbox', 'combobox', 'link', 'menu', 'menubar', 'menuitem', 'navigation',
  'searchbox', 'switch', 'tab', 'tablist', 'toolbar', 'tree', 'treeitem',
]);

interface AxValue { value?: unknown }

export interface ChromiumAxNode {
  nodeId?: unknown;
  ignored?: unknown;
  role?: AxValue;
  name?: AxValue;
  value?: AxValue;
  childIds?: unknown;
}

/**
 * Lee contenido semántico que una aplicación virtualizada expone a lectores
 * de pantalla. El dominio se habilita solo durante la captura para no mantener
 * el coste de accesibilidad activo mientras el usuario navega; de eso se ocupa
 * `cdp-session.ts`, que además evita que dos capturas simultáneas se cierren la
 * sesión la una a la otra.
 */
export async function extractAccessibleReadingDocument(
  contents: WebContents,
  maxChars: number,
): Promise<ExtractedReadingDocument | null> {
  if (contents.isDestroyed()) return null;
  try {
    return await withCdpSession(contents, ['Accessibility'], async (send) => {
      const response = await withTimeout(
        send('Accessibility.getFullAXTree'),
        AX_CAPTURE_TIMEOUT_MS,
      ) as { nodes?: unknown };
      return extractReadingDocumentFromAxNodes(response.nodes, contents.getTitle(), maxChars);
    });
  } catch {
    return null;
  }
}

export function extractReadingDocumentFromAxNodes(
  rawNodes: unknown,
  title: string,
  maxChars: number,
): ExtractedReadingDocument | null {
  if (!Array.isArray(rawNodes) || rawNodes.length === 0 || rawNodes.length > AX_MAX_NODES) return null;
  const nodes = rawNodes.filter(isAxNode);
  const byId = new Map(nodes.map((node) => [String(node.nodeId), node]));
  let best: { blocks: ExtractedReadingDocument['blocks']; score: number; fullLength: number } | null = null;

  for (const candidate of nodes) {
    const role = axText(candidate.role).toLowerCase();
    const name = axText(candidate.name);
    if (!AX_CANDIDATE_ROLES.has(role) && !/document|editor|editable|contenido|content/i.test(name)) continue;
    const collected = collectAxBlocks(candidate, byId, maxChars);
    if (collected.fullLength < 40 || collected.blocks.length === 0) continue;
    const proseSignals = collected.blocks.reduce((sum, block) => sum + (block.text.match(/[.!?](?:\s|$)/g)?.length ?? 0), 0);
    const roleBonus = role === 'textbox' ? 1_200
      : role === 'document' || role === 'article' || role === 'main' ? 800
        : role === 'rootwebarea' ? -600 : 200;
    const score = collected.fullLength + proseSignals * 45 + collected.blocks.length * 12
      + roleBonus - collected.controls * 90;
    if (!best || score > best.score) best = { blocks: collected.blocks, score, fullLength: collected.fullLength };
  }

  if (!best) return null;
  return {
    title: cleanAxText(title) || 'Documento accesible',
    language: '',
    blocks: best.blocks,
    truncated: best.fullLength > best.blocks.reduce((sum, block) => sum + block.text.length, 0),
  };
}

function collectAxBlocks(
  root: ChromiumAxNode,
  byId: Map<string, ChromiumAxNode>,
  maxChars: number,
): { blocks: ExtractedReadingDocument['blocks']; fullLength: number; controls: number } {
  const blocks: ExtractedReadingDocument['blocks'] = [];
  const seen = new Set<string>();
  const stack = [root];
  let fullLength = 0;
  let controls = 0;
  let visited = 0;
  let used = 0;
  const rootRole = axText(root.role).toLowerCase();
  const preserveInlineLinks = rootRole === 'textbox' || rootRole === 'document'
    || rootRole === 'article' || rootRole === 'main';

  while (stack.length && visited < AX_MAX_NODES) {
    const node = stack.pop()!;
    visited += 1;
    if (node.ignored === true) continue;
    const role = axText(node.role).toLowerCase();
    if (AX_CONTROL_ROLES.has(role) && !(role === 'link' && preserveInlineLinks)) {
      controls += 1;
      continue;
    }
    const children = Array.isArray(node.childIds)
      ? node.childIds.map((id) => byId.get(String(id))).filter((value): value is ChromiumAxNode => Boolean(value))
      : [];
    for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);

    let text = '';
    if (AX_CONTENT_ROLES.has(role) || (role === 'link' && preserveInlineLinks)) {
      text = cleanAxText(axText(node.name) || axText(node.value));
    }
    else if (role === 'textbox') text = cleanAxText(axText(node.value));
    if (!text || isAxUiLabel(text)) continue;
    fullLength += text.length;
    const fingerprint = `${role}:${text}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    if (used >= maxChars) continue;
    const clipped = text.slice(0, Math.max(0, maxChars - used));
    if (clipped.length < 2) continue;
    blocks.push({
      kind: axBlockKind(role),
      text: clipped,
      level: role === 'heading' ? 2 : null,
    });
    used += clipped.length + 2;
  }
  return { blocks, fullLength, controls };
}

function isAxNode(value: unknown): value is ChromiumAxNode {
  return Boolean(value && typeof value === 'object' && typeof (value as ChromiumAxNode).nodeId === 'string');
}

function axText(value: AxValue | undefined): string {
  return typeof value?.value === 'string' ? value.value : '';
}

function cleanAxText(value: string): string {
  return value.replace(/\u00ad/g, '').replace(/\s+/gu, ' ').trim();
}

function isAxUiLabel(value: string): boolean {
  return /^(?:menu|menú|inicio|home|compartir|share|cerrar|close|buscar|search|pestañas del documento)$/i.test(value);
}

function axBlockKind(role: string): BrowserReadingBlockKind {
  if (role === 'heading') return 'heading';
  if (role === 'listitem') return 'list-item';
  if (role === 'blockquote') return 'quote';
  return 'paragraph';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('El árbol de accesibilidad excedió el tiempo permitido.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
