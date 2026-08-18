import type { WebContents } from 'electron';
import { runInAgentWorld, type AgentWorldTarget } from './agent-world';
import { CDP_REF_PREFIX } from './cdp-dom-snapshot';
import { withCdpSession } from './cdp-session';
import { BROWSER_REF_REGISTRY_KEY } from './page-observation';

/**
 * Resultado de localizar un control del ultimo snapshot dentro de la pagina.
 * El punto viene en pixeles CSS del viewport de la pestana, listo para
 * `sendInputEvent`.
 */
export type BrowserElementTarget = {
  ref: string;
  tag: string;
  role: string;
  name: string;
  type: string;
  href: string;
  disabled: boolean;
  editable: boolean;
  x: number;
  y: number;
  /** true cuando otro elemento cubre el punto de impacto (banner, modal). */
  occluded: boolean;
};

export type BrowserElementFailureReason =
  | 'sin-registro'
  | 'referencia-vencida'
  | 'oculto'
  | 'fuera-de-vista'
  | 'marco-aislado';

export type BrowserElementResolution =
  | { ok: true; target: BrowserElementTarget }
  | { ok: false; reason: BrowserElementFailureReason };

const RESOLUTION_REASONS: Record<BrowserElementFailureReason, string> = {
  'sin-registro': 'La pagina cambio y ya no hay un mapa de elementos: vuelve a leer el DOM antes de interactuar.',
  'referencia-vencida': 'Ese elemento ya no existe en la pagina: vuelve a leer el DOM para obtener referencias vigentes.',
  oculto: 'El elemento existe pero no es visible en este momento.',
  'fuera-de-vista': 'El elemento no pudo colocarse dentro del area visible del navegador.',
  'marco-aislado': 'El elemento vive en un marco de otro origen y no se puede senalar su posicion real: pide al usuario que actue sobre el.',
};

const VALID_REASONS = new Set<string>(Object.keys(RESOLUTION_REASONS));

export function describeResolutionFailure(reason: BrowserElementFailureReason): string {
  return RESOLUTION_REASONS[reason] ?? 'No fue posible localizar el elemento indicado.';
}

/**
 * Localiza el elemento por referencia, lo desplaza al centro del viewport y
 * devuelve su punto de impacto actual. Recalcular el rectangulo en el momento
 * del clic evita usar coordenadas de un snapshot que el scroll ya invalido.
 *
 * Hay dos familias de referencia segun el backend que produjo la observacion:
 * `dom-N` la resuelve el registro del mundo aislado del agente, y `cdp-N` es un
 * `backendNodeId` de Chromium, que sobrevive a los re-render que invalidan una
 * referencia guardada en JavaScript.
 */
export async function resolveBrowserElement(contents: WebContents, ref: string): Promise<BrowserElementResolution> {
  if (ref.startsWith(CDP_REF_PREFIX)) return resolveViaCdp(contents, ref);
  const raw = await runInAgentWorld(
    contents as unknown as AgentWorldTarget,
    buildResolveScript(ref),
  ) as Record<string, unknown> | null;
  return normalizeResolution(raw, ref);
}

function normalizeResolution(raw: Record<string, unknown> | null, ref: string): BrowserElementResolution {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'sin-registro' };
  if (raw.ok !== true) {
    const reason = String(raw.reason ?? 'referencia-vencida');
    return { ok: false, reason: VALID_REASONS.has(reason) ? reason as BrowserElementFailureReason : 'referencia-vencida' };
  }
  return {
    ok: true,
    target: {
      ref,
      tag: text(raw.tag, 30),
      role: text(raw.role, 40),
      name: text(raw.name, 180),
      type: text(raw.type, 40),
      href: text(raw.href, 500),
      disabled: raw.disabled === true,
      editable: raw.editable === true,
      x: integer(raw.x),
      y: integer(raw.y),
      occluded: raw.occluded === true,
    },
  };
}

/**
 * Resuelve un `backendNodeId`. `DOM.resolveNode` devuelve un manejador vivo al
 * nodo en el contexto de su propio marco; sobre el se ejecuta la misma logica de
 * medicion que en el camino de JavaScript. El manejador se libera siempre: un
 * objeto retenido impide que Chromium recolecte el nodo.
 */
async function resolveViaCdp(contents: WebContents, ref: string): Promise<BrowserElementResolution> {
  const backendNodeId = Number(ref.slice(CDP_REF_PREFIX.length));
  if (!Number.isSafeInteger(backendNodeId) || backendNodeId <= 0) {
    return { ok: false, reason: 'referencia-vencida' };
  }
  try {
    return await withCdpSession(contents, ['DOM', 'Runtime'], async (send) => {
      let objectId: string | undefined;
      try {
        const resolved = await send('DOM.resolveNode', { backendNodeId }) as { object?: { objectId?: string } };
        objectId = resolved?.object?.objectId;
      } catch {
        // El nodo desaparecio del arbol entre la observacion y el clic.
        return { ok: false, reason: 'referencia-vencida' } as BrowserElementResolution;
      }
      if (!objectId) return { ok: false, reason: 'referencia-vencida' };
      try {
        const evaluated = await send('Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: MEASURE_FUNCTION,
          returnByValue: true,
        }) as { result?: { value?: Record<string, unknown> }; exceptionDetails?: unknown };
        if (evaluated?.exceptionDetails) return { ok: false, reason: 'referencia-vencida' };
        return normalizeResolution(evaluated?.result?.value ?? null, ref);
      } finally {
        await send('Runtime.releaseObject', { objectId }).catch(() => undefined);
      }
    });
  } catch {
    // Sesion de inspeccion no disponible (DevTools abierto, pestana cerrada).
    return { ok: false, reason: 'sin-registro' };
  }
}

/**
 * Mide el nodo y traduce su punto de impacto al viewport de la pestana.
 *
 * Dentro de un iframe `getBoundingClientRect` devuelve coordenadas del propio
 * marco, pero `sendInputEvent` inyecta en la ventana: hay que sumar el
 * desplazamiento de cada marco padre. Si un padre es de otro origen no se puede
 * leer y se declara el fallo en vez de senalar un punto equivocado, que es lo
 * que provocaria un clic sobre algo que el usuario no pidio.
 */
const MEASURE_FUNCTION = `function () {
  const el = this;
  if (!el || !el.isConnected) return { ok: false, reason: 'referencia-vencida' };
  try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch {}
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return { ok: false, reason: 'oculto' };
  if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) {
    return { ok: false, reason: 'oculto' };
  }
  let x = rect.left + rect.width / 2;
  let y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return { ok: false, reason: 'fuera-de-vista' };
  let ventana = window;
  let guardia = 0;
  while (ventana !== ventana.top && guardia < 16) {
    guardia += 1;
    let marco = null;
    try { marco = ventana.frameElement; } catch { return { ok: false, reason: 'marco-aislado' }; }
    if (!marco) return { ok: false, reason: 'marco-aislado' };
    const caja = marco.getBoundingClientRect();
    x += caja.left;
    y += caja.top;
    ventana = ventana.parent;
  }
  x = Math.round(x);
  y = Math.round(y);
  let occluded = false;
  try {
    const hit = el.ownerDocument.elementFromPoint(Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2));
    occluded = !!hit && hit !== el && !el.contains(hit) && !hit.contains(el);
  } catch {}
  const clean = (value) => String(value || '').replace(/[\\u0000-\\u001f\\u007f]+/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 180);
  const editable = !!el.matches && el.matches('input,textarea,select,[contenteditable="true"],[contenteditable=""]');
  const type = clean(el.type);
  return {
    ok: true,
    tag: (el.tagName || '').toLowerCase(),
    role: clean(el.getAttribute && el.getAttribute('role')),
    name: clean((el.getAttribute && el.getAttribute('aria-label')) || el.title || (type === 'password' ? '' : el.textContent)),
    type,
    href: typeof el.href === 'string' ? el.href.slice(0, 500) : '',
    disabled: !!el.disabled || (el.getAttribute && el.getAttribute('aria-disabled') === 'true'),
    editable,
    x, y, occluded,
  };
}`;

function buildResolveScript(ref: string): string {
  return `(() => {
  const registry = window[${JSON.stringify(BROWSER_REF_REGISTRY_KEY)}];
  if (!registry || typeof registry.get !== 'function') return { ok: false, reason: 'sin-registro' };
  const el = registry.get(${JSON.stringify(ref)});
  if (!el || !el.isConnected) return { ok: false, reason: 'referencia-vencida' };
  try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch {}
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return { ok: false, reason: 'oculto' };
  if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) {
    return { ok: false, reason: 'oculto' };
  }
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);
  if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return { ok: false, reason: 'fuera-de-vista' };
  let occluded = false;
  try {
    const hit = document.elementFromPoint(x, y);
    occluded = !!hit && hit !== el && !el.contains(hit) && !hit.contains(el);
  } catch {}
  const clean = (value) => String(value || '').replace(/[\\u0000-\\u001f\\u007f]+/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 180);
  const editable = !!el.matches && el.matches('input,textarea,select,[contenteditable="true"],[contenteditable=""]');
  const type = el instanceof HTMLInputElement ? clean(el.type) : '';
  return {
    ok: true,
    tag: (el.tagName || '').toLowerCase(),
    role: clean(el.getAttribute && el.getAttribute('role')),
    name: clean((el.getAttribute && el.getAttribute('aria-label')) || el.title || (type === 'password' ? '' : el.textContent)),
    type,
    href: el instanceof HTMLAnchorElement ? String(el.href || '').slice(0, 500) : '',
    disabled: !!el.disabled || (el.getAttribute && el.getAttribute('aria-disabled') === 'true'),
    editable,
    x, y, occluded,
  };
})()`;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[\p{Cc}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function integer(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
