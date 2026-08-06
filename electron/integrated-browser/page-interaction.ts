import type { WebContents } from 'electron';
import { BROWSER_REF_REGISTRY_KEY } from './page-observation';

/**
 * Resultado de localizar un control del ultimo snapshot dentro de la pagina.
 * El punto viene en pixeles CSS del viewport, listo para `sendInputEvent`.
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

export type BrowserElementFailureReason = 'sin-registro' | 'referencia-vencida' | 'oculto' | 'fuera-de-vista';

export type BrowserElementResolution =
  | { ok: true; target: BrowserElementTarget }
  | { ok: false; reason: BrowserElementFailureReason };

const RESOLUTION_REASONS: Record<BrowserElementFailureReason, string> = {
  'sin-registro': 'La pagina cambio y ya no hay un mapa de elementos: vuelve a leer el DOM antes de interactuar.',
  'referencia-vencida': 'Ese elemento ya no existe en la pagina: vuelve a leer el DOM para obtener referencias vigentes.',
  oculto: 'El elemento existe pero no es visible en este momento.',
  'fuera-de-vista': 'El elemento no pudo colocarse dentro del area visible del navegador.',
};

export function describeResolutionFailure(reason: BrowserElementFailureReason): string {
  return RESOLUTION_REASONS[reason] ?? 'No fue posible localizar el elemento indicado.';
}

/**
 * Localiza el elemento por referencia, lo desplaza al centro del viewport y
 * devuelve su punto de impacto actual. Recalcular el rectangulo en el momento
 * del clic evita usar coordenadas de un snapshot que el scroll ya invalido.
 */
export async function resolveBrowserElement(contents: WebContents, ref: string): Promise<BrowserElementResolution> {
  const script = buildResolveScript(ref);
  const raw = await contents.executeJavaScript(script, true) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'sin-registro' };
  if (raw.ok !== true) {
    const reason = String(raw.reason ?? 'referencia-vencida');
    return {
      ok: false,
      reason: reason === 'sin-registro' || reason === 'oculto' || reason === 'fuera-de-vista' ? reason : 'referencia-vencida',
    };
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
