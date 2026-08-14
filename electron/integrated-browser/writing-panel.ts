/**
 * Panel de redaccion que abre "Mejorar redaccion" del menu flotante.
 *
 * A diferencia del resto de acciones, esta no manda nada al chat: el usuario
 * escribe que quiere cambiar, ve la propuesta ahi mismo y decide si la deja
 * caer en el campo de texto. Copiar y pegar a mano era justo el paso que hacia
 * inutil la funcion dentro de un correo o un chat de trabajo.
 *
 * Vive dentro de la pagina por lo mismo que el menu: la vista del navegador es
 * una `WebContentsView` nativa pintada encima del renderer, y ademas escribir
 * en el campo del usuario solo se puede hacer desde el propio documento.
 */

/** Marca que la pagina emite por consola al pedir una redaccion. */
export const WRITING_PANEL_BEACON = '__SOFLIA_WRITING__';

/** Tope de la peticion del usuario; el panel ya la acota al escribir. */
export const MAX_WRITING_PROMPT_CHARS = 500;
/** Tope del texto a reescribir, alineado con el adjunto del chat. */
export const MAX_WRITING_TEXT_CHARS = 8_000;

export interface BrowserWritingRequest {
  requestId: string;
  /** Peticion escrita por el usuario; vacia significa "mejorala sin mas". */
  prompt: string;
  /** Texto seleccionado, capturado por la pagina al abrir el panel. */
  text: string;
}

export interface BrowserWritingResult {
  requestId: string;
  text?: string;
  error?: string;
}

/** Marco donde vive el panel; la pagina principal y cada iframe cuentan. */
export interface WritingPanelFrame {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
}

export function installBrowserWritingPanel(frame: WritingPanelFrame): Promise<boolean> {
  const script = `(${installWritingPanelInPage.toString()})(${JSON.stringify({ beacon: WRITING_PANEL_BEACON, maxPrompt: MAX_WRITING_PROMPT_CHARS })})`;
  return frame.executeJavaScript(script, true).then(Boolean);
}

/**
 * Retira la peticion pendiente de un marco. Es una lectura, no una espera: el
 * aviso de consola ya dijo que habia algo, y asi no queda ninguna promesa viva
 * dentro de la pagina.
 */
export function takeBrowserWritingRequest(frame: WritingPanelFrame): Promise<BrowserWritingRequest | null> {
  const script = `(${takeWritingRequestInPage.toString()})()`;
  return frame.executeJavaScript(script, true).then((raw) => normalizeWritingRequest(raw));
}

export function deliverBrowserWritingResult(frame: WritingPanelFrame, result: BrowserWritingResult): Promise<boolean> {
  const script = `(${deliverWritingResultInPage.toString()})(${JSON.stringify(result)})`;
  return frame.executeJavaScript(script, true).then(Boolean);
}

/** Cierra el panel; se usa cuando el agente toma el control del navegador. */
export function closeBrowserWritingPanel(frame: WritingPanelFrame): Promise<boolean> {
  const script = `(${closeWritingPanelInPage.toString()})()`;
  return frame.executeJavaScript(script, true).then(Boolean);
}

/**
 * Valida lo que devuelve la pagina. Es contenido no confiable: un identificador
 * inventado o un texto desmedido no puede entrar al modelo tal cual.
 */
export function normalizeWritingRequest(raw: unknown): BrowserWritingRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const requestId = typeof value.requestId === 'string' ? value.requestId : '';
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId) || !text) return null;
  return {
    requestId,
    prompt: prompt.slice(0, MAX_WRITING_PROMPT_CHARS),
    text: text.slice(0, MAX_WRITING_TEXT_CHARS),
  };
}

interface WritingPanelConfig {
  beacon: string;
  maxPrompt: number;
}

interface WritingPanelPageSession {
  host: HTMLElement;
  open: () => boolean;
  close: () => void;
  takeRequest: () => BrowserWritingRequest | null;
  deliver: (result: BrowserWritingResult) => boolean;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function takeWritingRequestInPage(): BrowserWritingRequest | null {
  const scope = globalThis as typeof globalThis & { __sofliaWritingPanel?: WritingPanelPageSession };
  return scope.__sofliaWritingPanel?.takeRequest() ?? null;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function deliverWritingResultInPage(result: BrowserWritingResult): boolean {
  const scope = globalThis as typeof globalThis & { __sofliaWritingPanel?: WritingPanelPageSession };
  return scope.__sofliaWritingPanel?.deliver(result) ?? false;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function closeWritingPanelInPage(): boolean {
  const scope = globalThis as typeof globalThis & { __sofliaWritingPanel?: WritingPanelPageSession };
  if (!scope.__sofliaWritingPanel) return false;
  scope.__sofliaWritingPanel.close();
  return true;
}

/** Se serializa dentro de la página; debe permanecer autocontenida. */
export function installWritingPanelInPage(input: WritingPanelConfig): boolean {
  const scope = globalThis as typeof globalThis & { __sofliaWritingPanel?: WritingPanelPageSession };
  if (!document.body) return false;
  const previo = scope.__sofliaWritingPanel;
  if (previo && previo.host.isConnected) return true;
  previo?.host.remove();

  type Objetivo =
    | { kind: 'range'; range: Range; editable: HTMLElement | null }
    | { kind: 'field'; field: HTMLInputElement | HTMLTextAreaElement; start: number; end: number };

  const host = document.createElement('div');
  host.dataset.sofliaWritingPanel = 'v1';
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;display:none;width:400px;max-width:calc(100vw - 24px);pointer-events:auto;contain:layout style;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host{color-scheme:light dark}
    *{box-sizing:border-box}
    .panel{--tipo:"Inter Tight",Inter,system-ui,sans-serif;--acento:#00d6be;--acento-alto:#2ae9cf;--tinta:#04231f;--texto:#f2f8f7;--suave:#c2d0d6;--tenue:#8093a0;--linea:rgba(255,255,255,.1);--superficie:rgba(255,255,255,.055);--sobre:rgba(255,255,255,.11);--fondo:linear-gradient(168deg,rgba(24,33,41,.97),rgba(10,15,20,.98));--sombra:0 28px 64px rgba(2,8,16,.5),0 2px 10px rgba(2,8,16,.32),inset 0 1px 0 rgba(255,255,255,.07);--globo:#05090d;display:flex;flex-direction:column;gap:12px;padding:14px;border:1px solid var(--linea);border-radius:20px;background:var(--fondo);color:var(--texto);box-shadow:var(--sombra);backdrop-filter:blur(22px) saturate(1.15);font-family:"Inter Tight",Inter,system-ui,sans-serif;animation:aparecer 170ms cubic-bezier(.2,.7,.3,1)}
    .cabecera{display:flex;align-items:center;gap:9px}
    .marca{display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;border-radius:8px;background:color-mix(in srgb,var(--acento) 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acento) 28%,transparent)}
    .marca svg{width:14px;height:14px;fill:none;stroke:var(--acento);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .titulo{font:600 13px/1.2 var(--tipo);letter-spacing:-.01em}
    .cerrar{margin-left:auto}
    .compositor{display:flex;flex-direction:column;gap:10px;animation:entrar 170ms ease-out}
    .cita{max-height:61px;overflow:hidden;padding:9px 11px;border-left:2px solid color-mix(in srgb,var(--acento) 70%,transparent);border-radius:0 10px 10px 0;background:var(--superficie);color:var(--suave);font:400 12px/1.45 var(--tipo);white-space:pre-wrap;overflow-wrap:anywhere}
    .cita.recortada{-webkit-mask-image:linear-gradient(#000 58%,transparent);mask-image:linear-gradient(#000 58%,transparent)}
    textarea{width:100%;min-height:62px;max-height:150px;padding:10px 12px;border:1px solid var(--linea);border-radius:12px;background:var(--superficie);color:inherit;font:400 13px/1.5 var(--tipo);resize:none;transition:border-color 140ms ease,box-shadow 140ms ease}
    textarea::placeholder{color:var(--tenue)}
    textarea:focus{outline:none;border-color:color-mix(in srgb,var(--acento) 58%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--acento) 15%,transparent)}
    .fila{display:flex;align-items:center;gap:10px}
    .fila .pista{color:var(--tenue);font:400 11px/1.3 var(--tipo)}
    .fila .derecha{margin-left:auto;display:flex;align-items:center;gap:6px}
    button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:none;color:inherit;cursor:pointer;white-space:nowrap;font:600 12px/1 var(--tipo);transition:background 140ms ease,color 140ms ease,box-shadow 140ms ease,transform 120ms ease}
    button:active{transform:scale(.96)}
    button:focus-visible{outline:2px solid var(--acento);outline-offset:2px}
    button:disabled{cursor:not-allowed;opacity:.45}
    button svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .primary{height:32px;padding:0 16px;border-radius:11px;background:linear-gradient(180deg,var(--acento-alto),var(--acento));color:var(--tinta);box-shadow:0 6px 16px color-mix(in srgb,var(--acento) 26%,transparent)}
    .primary:hover{filter:brightness(1.06)}
    .primary:disabled{box-shadow:none;filter:none}
    .icono{width:28px;height:28px;border-radius:9px;color:var(--tenue)}
    .icono:hover{background:var(--sobre);color:var(--texto)}
    .accion{width:34px;height:34px;border-radius:12px;background:var(--superficie);box-shadow:inset 0 0 0 1px var(--linea);color:var(--suave)}
    .accion:hover{background:var(--sobre);color:var(--texto)}
    .accion svg{width:16px;height:16px}
    .accion.destacada{width:36px;height:36px;background:linear-gradient(180deg,var(--acento-alto),var(--acento));color:var(--tinta);box-shadow:0 6px 18px color-mix(in srgb,var(--acento) 28%,transparent)}
    .accion.destacada:hover{filter:brightness(1.06)}
    .accion.destacada:disabled{box-shadow:inset 0 0 0 1px var(--linea);background:var(--superficie);color:var(--suave)}
    .accion.hecho{color:var(--acento)}
    .tip{position:relative}
    .tip::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) translateY(3px);padding:5px 8px;border-radius:8px;background:var(--globo);color:#eef5f4;font:500 11px/1 var(--tipo);white-space:nowrap;opacity:0;pointer-events:none;box-shadow:0 8px 20px rgba(2,8,16,.4);transition:opacity 120ms ease,transform 120ms ease}
    .tip:hover::after,.tip:focus-visible::after{opacity:1;transform:translateX(-50%)}
    .resultado{display:none;flex-direction:column;gap:10px}
    .panel[data-fase="working"] .resultado,.panel[data-fase="done"] .resultado,.panel[data-fase="error"] .resultado{display:flex;animation:entrar 180ms ease-out}
    .panel[data-fase="error"] .resultado{padding-top:11px;border-top:1px solid var(--linea)}
    .propuesta{max-height:220px;overflow:auto;padding:12px 13px;border-radius:14px;background:linear-gradient(180deg,color-mix(in srgb,var(--acento) 8%,transparent),var(--superficie));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acento) 14%,transparent);color:var(--texto);font:400 13.5px/1.6 var(--tipo);white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}
    .propuesta::-webkit-scrollbar{width:6px}
    .propuesta::-webkit-scrollbar-thumb{border-radius:999px;background:color-mix(in srgb,var(--texto) 20%,transparent)}
    .estado{display:flex;align-items:center;gap:9px;color:var(--tenue);font:500 12px/1.35 var(--tipo)}
    .aro{flex:none;width:14px;height:14px;border-radius:999px;border:2px solid color-mix(in srgb,var(--acento) 26%,transparent);border-top-color:var(--acento);animation:girar 700ms linear infinite}
    .alerta{display:none;flex:none;width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .panel[data-fase="error"] .estado{color:#fb7185}
    .panel[data-fase="error"] .aro{display:none}
    .panel[data-fase="error"] .alerta{display:block}
    .aviso{margin:0;color:#fb7185;font:500 11.5px/1.4 var(--tipo)}
    .aviso:empty{display:none}
    .acciones{display:flex;align-items:center;gap:8px}
    .acciones .secundarias{margin-left:auto;display:flex;align-items:center;gap:8px}
    .panel:not([data-fase="done"]) .acciones{display:none}
    .panel[data-fase="working"] .compositor,.panel[data-fase="done"] .compositor{display:none}
    .panel[data-fase="working"] .propuesta,.panel[data-fase="error"] .propuesta{display:none}
    .panel:not([data-fase="working"]):not([data-fase="error"]) .estado{display:none}
    @keyframes aparecer{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}
    @keyframes entrar{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
    @keyframes girar{to{transform:rotate(360deg)}}
    @media(prefers-color-scheme:light){
      .panel{--texto:#102838;--suave:#44596b;--tenue:#7c8f9c;--linea:rgba(12,40,60,.12);--superficie:rgba(12,40,60,.045);--sobre:rgba(12,40,60,.09);--fondo:linear-gradient(168deg,rgba(255,255,255,.985),rgba(243,249,250,.985));--sombra:0 24px 54px rgba(17,37,58,.16),0 2px 8px rgba(17,37,58,.1),inset 0 1px 0 rgba(255,255,255,.9);--globo:#0e2331;border-color:rgba(0,142,130,.2)}
    }
    @media(prefers-reduced-motion:reduce){.panel,.compositor,.resultado{animation:none}button,textarea,.tip::after{transition:none}.aro{animation:none}}
  `;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const icono = (...trazos: string[]) => {
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const trazo of trazos) {
      const path = document.createElementNS(svgNamespace, 'path');
      path.setAttribute('d', trazo);
      svg.append(path);
    }
    return svg;
  };
  /** Los botones con globo propio no llevan `title`: seria un segundo aviso. */
  const boton = (clase: string, etiqueta: string, contenido: SVGElement | string) => {
    const elemento = document.createElement('button');
    elemento.type = 'button';
    if (clase) elemento.className = clase;
    elemento.dataset.tip = etiqueta;
    elemento.setAttribute('aria-label', etiqueta);
    if (!clase.split(' ').includes('tip')) elemento.title = etiqueta;
    if (typeof contenido === 'string') elemento.textContent = contenido;
    else elemento.append(contenido);
    return elemento;
  };
  const iconoVisto = () => icono('M4.8 12.6l4.9 4.9L19.2 6.7');
  const iconoInsertar = () => icono('M12 4.5v9.6', 'M8.2 10.5l3.8 3.9 3.8-3.9', 'M5 19.5h14');
  const iconoCopiar = () => icono(
    'M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z',
    'M4.5 16A2.5 2.5 0 0 1 3 13.7V5.5A2.5 2.5 0 0 1 5.5 3h8.2A2.5 2.5 0 0 1 16 4.5',
  );

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.dataset.fase = 'idle';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Mejorar redacción con SofLIA');

  const cabecera = document.createElement('div');
  cabecera.className = 'cabecera';
  const marca = document.createElement('span');
  marca.className = 'marca';
  marca.append(icono(
    'M11.4 3.6l1.7 4.3 4.3 1.7-4.3 1.7-1.7 4.3-1.7-4.3L5.4 9.6l4.3-1.7z',
    'M17.8 14.4l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z',
  ));
  const titulo = document.createElement('span');
  titulo.className = 'titulo';
  titulo.textContent = 'Mejorar redacción';
  const cerrar = boton('icono cerrar', 'Cerrar', icono('M7 7l10 10M17 7L7 17'));
  cabecera.append(marca, titulo, cerrar);

  const cita = document.createElement('div');
  cita.className = 'cita';

  const peticion = document.createElement('textarea');
  peticion.rows = 2;
  peticion.maxLength = input.maxPrompt;
  peticion.placeholder = 'Que quieres cambiar: mas formal, mas corto, otro tono… (opcional)';
  peticion.setAttribute('aria-label', 'Que quieres cambiar del texto');

  const filaEnvio = document.createElement('div');
  filaEnvio.className = 'fila';
  const pista = document.createElement('span');
  pista.className = 'pista';
  pista.textContent = 'Enter para pedirlo';
  const mejorar = boton('primary', 'Mejorar el texto', 'Mejorar');
  const derechaEnvio = document.createElement('div');
  derechaEnvio.className = 'derecha';
  derechaEnvio.append(mejorar);
  filaEnvio.append(pista, derechaEnvio);

  // El compositor se oculta entero mientras se pide y cuando llega la propuesta:
  // ahi lo unico que importa es el texto nuevo, no lo que se escribio para pedirlo.
  const compositor = document.createElement('div');
  compositor.className = 'compositor';
  compositor.append(cita, peticion, filaEnvio);

  const resultado = document.createElement('div');
  resultado.className = 'resultado';
  const estado = document.createElement('div');
  estado.className = 'estado';
  const aro = document.createElement('span');
  aro.className = 'aro';
  const alerta = icono('M12 9.2v4.4', 'M12 16.8h.01', 'M10.3 4.4L2.9 17.2a1.9 1.9 0 0 0 1.7 2.8h14.8a1.9 1.9 0 0 0 1.7-2.8L13.7 4.4a1.9 1.9 0 0 0-3.4 0z');
  alerta.setAttribute('class', 'alerta');
  const estadoTexto = document.createElement('span');
  estadoTexto.textContent = 'Mejorando…';
  estado.append(aro, alerta, estadoTexto);
  const propuesta = document.createElement('div');
  propuesta.className = 'propuesta';
  propuesta.setAttribute('aria-live', 'polite');
  const aviso = document.createElement('p');
  aviso.className = 'aviso';
  const acciones = document.createElement('div');
  acciones.className = 'acciones';
  const aplicar = boton('accion destacada tip', 'Reemplazar', iconoVisto());
  const copiar = boton('accion tip', 'Copiar', iconoCopiar());
  const reintentar = boton('accion tip', 'Reintentar', icono('M20 11.5a8 8 0 1 1-2.6-5.9', 'M20.4 4v5.2h-5.2'));
  const secundarias = document.createElement('div');
  secundarias.className = 'secundarias';
  secundarias.append(copiar, reintentar);
  acciones.append(aplicar, secundarias);
  resultado.append(estado, propuesta, aviso, acciones);

  panel.append(cabecera, compositor, resultado);
  shadow.append(style, panel);
  document.body.appendChild(host);

  let objetivo: Objetivo | null = null;
  let textoOriginal = '';
  let pendiente: BrowserWritingRequest | null = null;
  let esperando = '';
  let ultimaPropuesta = '';
  let ancla: DOMRect | null = null;
  let frame = 0;
  let ultimoEditable: HTMLElement | null = null;

  const esCampo = (elemento: Element | null): elemento is HTMLInputElement | HTMLTextAreaElement => {
    if (!elemento) return false;
    const etiqueta = elemento.tagName;
    if (etiqueta === 'TEXTAREA') return true;
    if (etiqueta !== 'INPUT') return false;
    const tipo = (elemento as HTMLInputElement).type;
    return tipo === 'text' || tipo === 'search' || tipo === 'email' || tipo === 'url' || tipo === 'tel';
  };
  const editableDe = (nodo: Node | null): HTMLElement | null => {
    const elemento = nodo?.nodeType === 1 ? nodo as Element : nodo?.parentElement ?? null;
    const editable = elemento?.closest<HTMLElement>('[contenteditable=""],[contenteditable="true"]') ?? null;
    return editable?.isContentEditable ? editable : null;
  };

  document.addEventListener('focusin', (evento) => {
    const activo = evento.target as Element | null;
    if (activo === host) return;
    if (esCampo(activo)) ultimoEditable = activo;
    else {
      const editable = editableDe(activo);
      if (editable) ultimoEditable = editable;
    }
  }, true);

  /** Campo donde cae la propuesta cuando el texto de origen no es editable. */
  const campoDeRespaldo = (): HTMLElement | null => {
    if (ultimoEditable?.isConnected) return ultimoEditable;
    const candidatos = Array.from(document.querySelectorAll<HTMLElement>('textarea,[contenteditable=""],[contenteditable="true"],[role="textbox"]'))
      .filter((elemento) => {
        if (elemento.closest('[data-soflia-writing-panel],[data-soflia-selection-menu]')) return false;
        if (!esCampo(elemento) && !elemento.isContentEditable) return false;
        const rect = elemento.getBoundingClientRect();
        return rect.width > 80 && rect.height > 16 && rect.top < innerHeight && rect.bottom > 0;
      });
    // Los compositores viven abajo: ante varios candidatos gana el mas bajo.
    return candidatos.sort((uno, otro) => otro.getBoundingClientRect().top - uno.getBoundingClientRect().top)[0] ?? null;
  };

  const capturar = (): boolean => {
    const seleccion = document.getSelection();
    const texto = seleccion ? String(seleccion).trim() : '';
    if (seleccion && !seleccion.isCollapsed && seleccion.rangeCount && texto) {
      const rango = seleccion.getRangeAt(0);
      const dentro = editableDe(rango.commonAncestorContainer);
      if (dentro?.closest('[data-soflia-writing-panel]')) return false;
      const rects = Array.from(rango.getClientRects());
      if (!rects.length) return false;
      objetivo = { kind: 'range', range: rango.cloneRange(), editable: dentro };
      textoOriginal = texto;
      ancla = unir(rects);
      return true;
    }
    // Chromium no expone en `getSelection` lo marcado dentro de un campo de
    // formulario: sin esto el panel no serviria justo donde mas se escribe.
    const activo = document.activeElement;
    if (esCampo(activo) && typeof activo.selectionStart === 'number' && typeof activo.selectionEnd === 'number'
      && activo.selectionEnd > activo.selectionStart) {
      const valor = String(activo.value);
      const seleccionado = valor.slice(activo.selectionStart, activo.selectionEnd).trim();
      if (!seleccionado) return false;
      objetivo = { kind: 'field', field: activo, start: activo.selectionStart, end: activo.selectionEnd };
      textoOriginal = seleccionado;
      ancla = activo.getBoundingClientRect();
      return true;
    }
    return false;
  };

  const unir = (rects: DOMRect[]): DOMRect => {
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    return { top, bottom, left, right, width: right - left, height: bottom - top } as DOMRect;
  };

  const colocar = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (host.style.display === 'none' || !ancla) return;
      const size = host.getBoundingClientRect();
      const x = (ancla.left + ancla.right) / 2 - size.width / 2;
      let y = ancla.bottom + 12;
      if (y + size.height > innerHeight - 8) y = Math.max(8, ancla.top - size.height - 12);
      host.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - size.width - 8, x)))}px`;
      host.style.top = `${Math.round(Math.max(8, Math.min(innerHeight - size.height - 8, y)))}px`;
    });
  };

  const puedeReemplazar = (): boolean => {
    if (objetivo?.kind === 'field') return !objetivo.field.disabled && !objetivo.field.readOnly;
    if (objetivo?.kind === 'range') return Boolean(objetivo.editable) || Boolean(campoDeRespaldo());
    return false;
  };

  const fase = (valor: 'idle' | 'working' | 'done' | 'error', mensaje = '') => {
    panel.dataset.fase = valor;
    mejorar.disabled = valor === 'working';
    if (valor !== 'done') aviso.textContent = '';
    if (mensaje) estadoTexto.textContent = mensaje;
    if (valor === 'working') estadoTexto.textContent = 'Mejorando…';
    titulo.textContent = valor === 'done' ? 'Redacción mejorada'
      : valor === 'working' ? 'Mejorando redacción'
        : 'Mejorar redacción';
    if (valor === 'done') {
      const enSitio = objetivo?.kind === 'field' || Boolean(objetivo?.kind === 'range' && objetivo.editable);
      const etiqueta = enSitio ? 'Reemplazar' : 'Insertar en el campo';
      aplicar.replaceChildren(enSitio ? iconoVisto() : iconoInsertar());
      aplicar.dataset.tip = etiqueta;
      aplicar.setAttribute('aria-label', etiqueta);
      aplicar.disabled = !puedeReemplazar();
    }
    colocar();
  };

  const cerrarPanel = () => {
    host.style.display = 'none';
    pendiente = null;
    esperando = '';
    objetivo = null;
    ancla = null;
    ultimaPropuesta = '';
    fase('idle');
  };

  const abrir = (): boolean => {
    if (!capturar()) return false;
    cita.textContent = textoOriginal.length > 320 ? `${textoOriginal.slice(0, 320)}…` : textoOriginal;
    peticion.value = '';
    propuesta.textContent = '';
    aviso.textContent = '';
    ultimaPropuesta = '';
    pendiente = null;
    esperando = '';
    fase('idle');
    host.style.display = 'block';
    // Con el panel ya pintado se sabe si la cita se corta: solo entonces se
    // difumina el final, para que un texto corto no salga desvanecido.
    cita.classList.toggle('recortada', cita.scrollHeight > cita.clientHeight + 1);
    colocar();
    peticion.focus();
    return true;
  };

  const pedir = () => {
    if (esperando || !textoOriginal) return;
    const requestId = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    pendiente = { requestId, prompt: peticion.value.trim().slice(0, input.maxPrompt), text: textoOriginal };
    esperando = requestId;
    fase('working');
    console.log(input.beacon);
  };

  /** Escribe en el campo del usuario provocando los mismos eventos que teclear. */
  const escribir = (elemento: HTMLElement, texto: string, seleccionar: () => void): boolean => {
    elemento.focus();
    seleccionar();
    // `insertText` es lo unico que conserva el deshacer del navegador y avisa a
    // la aplicacion de la pagina; asignar `value` deja a React sin enterarse.
    // Una pagina puede haberlo desactivado, asi que el respaldo sigue abajo.
    const insertado = (() => {
      try {
        return typeof document.execCommand === 'function' && document.execCommand('insertText', false, texto);
      } catch {
        return false;
      }
    })();
    if (insertado) return true;
    if (esCampo(elemento)) {
      const inicio = elemento.selectionStart ?? 0;
      const fin = elemento.selectionEnd ?? inicio;
      const valor = String(elemento.value);
      elemento.value = valor.slice(0, inicio) + texto + valor.slice(fin);
      const caret = inicio + texto.length;
      elemento.setSelectionRange(caret, caret);
      elemento.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  };

  const aplicarPropuesta = () => {
    if (!ultimaPropuesta) return;
    let escrito = false;
    if (objetivo?.kind === 'field') {
      const campo = objetivo.field;
      const inicio = Math.min(objetivo.start, String(campo.value).length);
      const fin = Math.min(objetivo.end, String(campo.value).length);
      escrito = campo.isConnected && escribir(campo, ultimaPropuesta, () => campo.setSelectionRange(inicio, fin));
    } else if (objetivo?.kind === 'range' && objetivo.editable?.isConnected) {
      const rango = objetivo.range;
      escrito = escribir(objetivo.editable, ultimaPropuesta, () => {
        const seleccion = document.getSelection();
        seleccion?.removeAllRanges();
        seleccion?.addRange(rango);
      });
    } else {
      const respaldo = campoDeRespaldo();
      if (respaldo) {
        escrito = escribir(respaldo, ultimaPropuesta, () => {
          if (esCampo(respaldo)) {
            const fin = String(respaldo.value).length;
            respaldo.setSelectionRange(fin, fin);
            return;
          }
          const seleccion = document.getSelection();
          const rango = document.createRange();
          rango.selectNodeContents(respaldo);
          rango.collapse(false);
          seleccion?.removeAllRanges();
          seleccion?.addRange(rango);
        });
      }
    }
    if (escrito) {
      cerrarPanel();
      return;
    }
    // Sigue en `done`: el aviso no puede llevarse por delante la propuesta ni el
    // boton de copiar, que es justo la salida que le queda al usuario.
    aviso.textContent = 'No se pudo escribir en la página. Copia la propuesta.';
    colocar();
  };

  /** Devuelve el panel a la vista de edicion conservando lo que se pidio antes. */
  const volverAEditar = () => {
    fase('idle');
    peticion.focus();
    peticion.select();
  };

  cerrar.addEventListener('click', cerrarPanel);
  mejorar.addEventListener('click', pedir);
  reintentar.addEventListener('click', volverAEditar);
  aplicar.addEventListener('click', aplicarPropuesta);
  copiar.addEventListener('click', () => {
    if (!ultimaPropuesta) return;
    void navigator.clipboard?.writeText(ultimaPropuesta).catch(() => undefined);
    copiar.replaceChildren(iconoVisto());
    copiar.classList.add('hecho');
    copiar.dataset.tip = 'Copiado';
    window.setTimeout(() => {
      copiar.replaceChildren(iconoCopiar());
      copiar.classList.remove('hecho');
      copiar.dataset.tip = 'Copiar';
    }, 1_400);
  });
  peticion.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' || evento.shiftKey) return;
    evento.preventDefault();
    pedir();
  });
  panel.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      cerrarPanel();
    }
  });
  window.addEventListener('resize', colocar);

  scope.__sofliaWritingPanel = {
    host,
    open: abrir,
    close: cerrarPanel,
    takeRequest: () => {
      const solicitud = pendiente;
      pendiente = null;
      return solicitud;
    },
    deliver: (result: BrowserWritingResult) => {
      if (!result || result.requestId !== esperando) return false;
      esperando = '';
      if (typeof result.text === 'string' && result.text.trim()) {
        ultimaPropuesta = result.text.trim();
        propuesta.textContent = ultimaPropuesta;
        fase('done');
        return true;
      }
      fase('error', result.error || 'No se pudo mejorar el texto.');
      return true;
    },
  };
  return true;
}
