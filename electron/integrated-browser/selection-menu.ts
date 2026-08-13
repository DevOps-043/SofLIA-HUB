import type { BrowserSelectionAction } from './context-menu';

/**
 * Menu flotante que aparece junto al texto seleccionado. Ofrece las mismas
 * acciones que el menu contextual sin obligar al usuario a pulsar el boton
 * derecho, que es donde hoy quedan escondidas.
 *
 * Vive dentro de la pagina —no en el renderer— porque la vista del navegador
 * es una `WebContentsView` nativa que se pinta encima de la interfaz de React:
 * cualquier burbuja dibujada por el renderer quedaria tapada y no podria
 * seguir a la seleccion al desplazar la pagina.
 */
export type BrowserSelectionMenuAction = BrowserSelectionAction | 'read';

/** Marca que la pagina emite por consola al pulsar una accion del menu. */
export const SELECTION_MENU_BEACON = '__SOFLIA_SELECTION_MENU__';

export interface SelectionMenuItem {
  action: BrowserSelectionMenuAction;
  /** Texto visible en la burbuja; se oculta cuando la ventana es estrecha. */
  label: string;
  /** Descripcion completa para el tooltip y los lectores de pantalla. */
  hint: string;
  /** Trazos SVG del icono, en un lienzo de 24x24. */
  icon: string[];
}

/**
 * Orden deliberado: primero la accion abierta —preguntar— y despues las
 * concretas, de la mas usada a la menos usada. La lectura cierra porque abre
 * otro panel en vez de adjuntar texto al chat.
 */
export const SELECTION_MENU_ITEMS: SelectionMenuItem[] = [
  {
    action: 'ask',
    label: 'Preguntar a SofLIA',
    hint: 'Adjunta la selección al chat para preguntar sobre ella',
    icon: [
      'M11 3.5l1.7 4.3 4.3 1.7-4.3 1.7L11 15.5 9.3 11.2 5 9.5l4.3-1.7z',
      'M17.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
    ],
  },
  {
    action: 'improve',
    label: 'Mejorar redacción',
    hint: 'Reescribe el texto con mejor redacción',
    icon: ['M5 19h3l9.3-9.3a2.1 2.1 0 0 0-3-3L5 16z', 'M13.3 7.4l3.3 3.3', 'M18.5 3l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8L16 5.5l1.8-.7z'],
  },
  {
    action: 'translate',
    label: 'Traducir',
    hint: 'Traduce el texto seleccionado',
    icon: ['M4 6.5h9', 'M8.5 4.5v2c0 4-1.8 7-4.5 8.5', 'M6.5 11.5c1.4 2.3 3.3 3.8 5.5 4.7', 'M12.5 20l4-9 4 9', 'M14 16.6h5'],
  },
  {
    action: 'summarize',
    label: 'Resumir',
    hint: 'Resume el texto en sus puntos esenciales',
    icon: ['M5 7h14', 'M5 12h10', 'M5 17h6'],
  },
  {
    action: 'read',
    label: 'Lectura',
    hint: 'Abre la selección en modo lectura y escúchala',
    icon: ['M4 14v-2a8 8 0 0 1 16 0v2', 'M4 14h3.2v5.2H5.6A1.6 1.6 0 0 1 4 17.6z', 'M20 14h-3.2v5.2h1.6a1.6 1.6 0 0 0 1.6-1.6z'],
  },
];

const MENU_ACTIONS = new Set<string>(SELECTION_MENU_ITEMS.map((item) => item.action));

/** Marco donde se inyecta el menu; la pagina principal y cada iframe cuentan. */
export interface SelectionMenuFrame {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
}

/**
 * Traduce el aviso de consola en una accion. Devuelve `null` ante cualquier
 * mensaje que no sea exactamente una de las acciones conocidas: la pagina es
 * contenido no confiable y solo puede pedir lo que el menu ofrece.
 */
export function parseSelectionMenuBeacon(message: string): BrowserSelectionMenuAction | null {
  const marca = `${SELECTION_MENU_BEACON}:`;
  const inicio = message.indexOf(marca);
  if (inicio < 0) return null;
  const crudo = message.slice(inicio + marca.length).trim().split(/\s/u)[0] ?? '';
  return MENU_ACTIONS.has(crudo) ? crudo as BrowserSelectionMenuAction : null;
}

export function installBrowserSelectionMenu(frame: SelectionMenuFrame): Promise<boolean> {
  const script = `(${installSelectionMenuInPage.toString()})(${JSON.stringify({
    beacon: SELECTION_MENU_BEACON,
    items: SELECTION_MENU_ITEMS,
  })})`;
  return frame.executeJavaScript(script, true).then(Boolean);
}

/**
 * Silencia el menu mientras el agente conduce el navegador: los clics y las
 * selecciones que sintetiza no son del usuario y la burbuja solo estorbaria a
 * las capturas de percepcion.
 */
export function setBrowserSelectionMenuEnabled(frame: SelectionMenuFrame, enabled: boolean): Promise<boolean> {
  const script = `(${setSelectionMenuEnabledInPage.toString()})(${JSON.stringify(enabled)})`;
  return frame.executeJavaScript(script, true).then(Boolean);
}

interface SelectionMenuConfig {
  beacon: string;
  items: SelectionMenuItem[];
}

interface SelectionMenuPageSession {
  host: HTMLElement;
  hide: () => void;
  setEnabled: (enabled: boolean) => void;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function setSelectionMenuEnabledInPage(enabled: boolean): boolean {
  const scope = globalThis as typeof globalThis & { __sofliaSelectionMenu?: SelectionMenuPageSession };
  const session = scope.__sofliaSelectionMenu;
  if (!session) return false;
  session.setEnabled(enabled);
  return true;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function installSelectionMenuInPage(input: SelectionMenuConfig): boolean {
  const scope = globalThis as typeof globalThis & { __sofliaSelectionMenu?: SelectionMenuPageSession };
  if (!document.body) return false;
  const previo = scope.__sofliaSelectionMenu;
  if (previo && previo.host.isConnected) {
    previo.setEnabled(true);
    return true;
  }
  previo?.host.remove();

  const host = document.createElement('div');
  host.dataset.sofliaSelectionMenu = 'v1';
  // Sin `paint` en la contencion: recortaria la sombra que despega la burbuja
  // del texto, que es lo que la hace legible sobre cualquier pagina.
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483646;display:none;width:max-content;max-width:calc(100vw - 16px);pointer-events:auto;contain:layout style;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host{color-scheme:light dark}
    *{box-sizing:border-box}
    .bar{display:flex;align-items:center;gap:2px;padding:4px;border:1px solid color-mix(in srgb,#00cdb5 32%,transparent);border-radius:16px;background:color-mix(in srgb,#0d141b 94%,transparent);color:#f6fbfa;box-shadow:0 14px 38px rgba(2,8,16,.36),0 2px 8px rgba(2,8,16,.24);backdrop-filter:blur(18px) saturate(1.12);font-family:"Inter Tight",Inter,system-ui,sans-serif;user-select:none;animation:aparecer 120ms ease-out}
    button{flex:none;display:flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:0;border-radius:11px;background:transparent;color:inherit;cursor:pointer;white-space:nowrap;font:650 12px/1 "Inter Tight",Inter,system-ui,sans-serif;transition:background 140ms ease,color 140ms ease,transform 140ms ease}
    button:hover{background:rgba(255,255,255,.09);color:#00e1c7}
    button:active{transform:scale(.96)}
    button:focus-visible{outline:2px solid #00d6be;outline-offset:2px}
    button[data-action="ask"]{background:#00d6be;color:#06211e}
    button[data-action="ask"]:hover{background:#22e3ca;color:#061b19}
    .bar[data-compact="true"] .label{display:none}
    .bar[data-compact="true"] button{padding:0 8px}
    .divider{width:1px;height:18px;margin:0 3px;background:rgba(255,255,255,.12)}
    svg{flex:none;width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    @keyframes aparecer{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
    @media(prefers-color-scheme:light){.bar{background:rgba(255,255,255,.95);color:#10283f;border-color:rgba(0,142,130,.26);box-shadow:0 14px 34px rgba(17,37,58,.18),0 2px 8px rgba(17,37,58,.1)}button:hover{background:rgba(10,47,73,.07);color:#008f82}.divider{background:rgba(10,47,73,.12)}}
    @media(prefers-reduced-motion:reduce){.bar{animation:none}button{transition:none}}
  `;

  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.dataset.compact = 'false';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Acciones de SofLIA sobre el texto seleccionado');
  const svgNamespace = 'http://www.w3.org/2000/svg';
  for (const item of input.items) {
    // La lectura abre otro panel en vez de adjuntar texto: se separa del resto.
    if (item.action === 'read') {
      const divider = document.createElement('span');
      divider.className = 'divider';
      divider.setAttribute('aria-hidden', 'true');
      bar.append(divider);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = item.action;
    button.title = item.hint;
    button.setAttribute('aria-label', item.hint);
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const trazo of item.icon) {
      const path = document.createElementNS(svgNamespace, 'path');
      path.setAttribute('d', trazo);
      svg.append(path);
    }
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = item.label;
    button.append(svg, label);
    bar.append(button);
  }
  shadow.append(style, bar);
  document.body.appendChild(host);

  let enabled = true;
  let visible = false;
  let anchorRange: Range | null = null;
  let frame = 0;
  let showTimer = 0;

  const hide = () => {
    window.clearTimeout(showTimer);
    cancelAnimationFrame(frame);
    if (!visible) return;
    visible = false;
    anchorRange = null;
    host.style.display = 'none';
  };

  const place = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!visible || !anchorRange) return;
      const rects: DOMRect[] = (() => {
        try {
          return Array.from(anchorRange.getClientRects());
        } catch {
          // Las paginas dinamicas pueden reemplazar el nodo seleccionado.
          return [];
        }
      })();
      if (!rects.length) {
        hide();
        return;
      }
      const top = Math.min(...rects.map((rect) => rect.top));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      const left = Math.min(...rects.map((rect) => rect.left));
      const right = Math.max(...rects.map((rect) => rect.right));
      // Al desplazar la pagina el texto puede salir de la vista: la burbuja se
      // esconde con el, pero conserva su ancla para volver al reaparecer.
      if (bottom < 0 || top > innerHeight) {
        host.style.visibility = 'hidden';
        return;
      }
      host.style.visibility = 'visible';
      // En una ventana estrecha el rotulo se retira y quedan los iconos con su
      // tooltip. Se mide el contenido de la barra, no el anfitrion: este ya
      // viene acotado al viewport y nunca declararia que no cabe.
      bar.dataset.compact = 'false';
      if (bar.scrollWidth > innerWidth - 24) bar.dataset.compact = 'true';
      const size = host.getBoundingClientRect();
      const x = (left + right) / 2 - size.width / 2;
      let y = top - size.height - 10;
      if (y < 8) y = Math.min(innerHeight - size.height - 8, bottom + 10);
      host.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - size.width - 8, x)))}px`;
      host.style.top = `${Math.round(Math.max(8, y))}px`;
    });
  };

  /**
   * Devuelve la seleccion viva del documento, ignorando la que ocurra dentro
   * de la propia burbuja o del reproductor del modo lectura.
   */
  const liveRange = (): Range | null => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    if (!String(selection).trim()) return null;
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const element = node.nodeType === 1 ? node as Element : node.parentElement;
    if (element?.closest('[data-soflia-selection-menu],[data-soflia-reading-toolbar]')) return null;
    return range.cloneRange();
  };

  const show = () => {
    if (!enabled) return;
    const range = liveRange();
    if (!range) {
      hide();
      return;
    }
    anchorRange = range;
    visible = true;
    host.style.display = 'block';
    place();
  };

  const scheduleShow = () => {
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(show, 10);
  };

  // Mantener viva la seleccion es lo que permite que el proceso principal la
  // lea al recibir la accion: sin esto, pulsar un boton la deshace.
  host.addEventListener('mousedown', (event) => event.preventDefault());
  bar.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    // Mejorar la redaccion no viaja al chat: se resuelve en el panel de la
    // propia pagina, que es donde esta el campo del usuario. Si el panel no
    // llego a instalarse, la accion cae al chat como el resto.
    const panel = (globalThis as typeof globalThis & { __sofliaWritingPanel?: { open: () => boolean } }).__sofliaWritingPanel;
    if (button.dataset.action === 'improve' && panel?.open()) {
      hide();
      return;
    }
    console.log(`${input.beacon}:${button.dataset.action}`);
    hide();
  });

  const onPointerDown = (event: PointerEvent) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (event.target === host || path.indexOf(host) >= 0) return;
    hide();
  };
  const onPointerUp = () => scheduleShow();
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      hide();
      return;
    }
    scheduleShow();
  };
  const onSelectionChange = () => {
    if (!visible) return;
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed) hide();
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('selectionchange', onSelectionChange, true);
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);

  scope.__sofliaSelectionMenu = {
    host,
    hide,
    setEnabled: (value: boolean) => {
      enabled = value;
      if (!value) hide();
    },
  };
  return true;
}
