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
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;display:none;width:380px;max-width:calc(100vw - 24px);pointer-events:auto;contain:layout style;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host{color-scheme:light dark}
    *{box-sizing:border-box}
    .panel{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid color-mix(in srgb,#00cdb5 32%,transparent);border-radius:18px;background:color-mix(in srgb,#0d141b 96%,transparent);color:#f6fbfa;box-shadow:0 22px 54px rgba(2,8,16,.42),0 2px 10px rgba(2,8,16,.28);backdrop-filter:blur(20px) saturate(1.1);font-family:"Inter Tight",Inter,system-ui,sans-serif;animation:aparecer 140ms ease-out}
    .cabecera{display:flex;align-items:center;gap:8px;font:650 13px/1 "Inter Tight",Inter,system-ui,sans-serif}
    .cabecera svg{width:15px;height:15px;fill:none;stroke:#00d6be;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .cabecera .cerrar{margin-left:auto}
    .cita{max-height:62px;overflow:hidden;padding:8px 10px;border-left:2px solid #00d6be;border-radius:0 8px 8px 0;background:rgba(255,255,255,.05);color:#c3d0d4;font:400 12px/1.45 "Inter Tight",Inter,system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}
    textarea{width:100%;min-height:60px;max-height:150px;padding:9px 10px;border:1px solid rgba(255,255,255,.14);border-radius:11px;background:rgba(255,255,255,.05);color:inherit;font:400 13px/1.45 "Inter Tight",Inter,system-ui,sans-serif;resize:none}
    textarea::placeholder{color:#7f8d97}
    textarea:focus{outline:none;border-color:#00d6be}
    .fila{display:flex;align-items:center;gap:8px}
    .fila .pista{color:#7f8d97;font:400 11px/1.3 "Inter Tight",Inter,system-ui,sans-serif}
    .fila .derecha{margin-left:auto;display:flex;gap:8px}
    button{display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:inherit;cursor:pointer;white-space:nowrap;font:650 12px/1 "Inter Tight",Inter,system-ui,sans-serif;transition:background 140ms ease,color 140ms ease,transform 140ms ease}
    button:hover{background:rgba(255,255,255,.14);color:#00e1c7}
    button:active{transform:scale(.97)}
    button:focus-visible{outline:2px solid #00d6be;outline-offset:2px}
    button:disabled{cursor:not-allowed;opacity:.4}
    button.primary{background:#00d6be;color:#06211e}
    button.primary:hover{background:#22e3ca;color:#061b19}
    button.icono{width:26px;height:26px;padding:0;justify-content:center;background:transparent;color:#8b98a2}
    button.icono:hover{background:rgba(255,255,255,.1);color:#f6fbfa}
    button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .resultado{display:none;flex-direction:column;gap:9px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)}
    .panel[data-fase="working"] .resultado,.panel[data-fase="done"] .resultado,.panel[data-fase="error"] .resultado{display:flex}
    .propuesta{max-height:200px;overflow:auto;color:#e7f0ef;font:400 13px/1.5 "Inter Tight",Inter,system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text}
    .estado{display:flex;align-items:center;gap:7px;color:#9fb0b6;font:500 12px/1.3 "Inter Tight",Inter,system-ui,sans-serif}
    .punto{width:6px;height:6px;border-radius:999px;background:#00d6be;animation:latir 1s ease-in-out infinite}
    .panel[data-fase="error"] .estado{color:#fb7185}
    .acciones{display:flex;gap:8px}
    .panel:not([data-fase="done"]) .acciones{display:none}
    .panel[data-fase="working"] .propuesta,.panel[data-fase="error"] .propuesta{display:none}
    .panel:not([data-fase="working"]):not([data-fase="error"]) .estado{display:none}
    @keyframes aparecer{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
    @keyframes latir{50%{opacity:.3}}
    @media(prefers-color-scheme:light){
      .panel{background:rgba(255,255,255,.97);color:#10283f;border-color:rgba(0,142,130,.26);box-shadow:0 22px 48px rgba(17,37,58,.2),0 2px 8px rgba(17,37,58,.12)}
      .cita{background:rgba(10,47,73,.05);color:#40566b}
      textarea{background:rgba(10,47,73,.04);border-color:rgba(10,47,73,.14)}
      button{background:rgba(10,47,73,.07)}
      button:hover{background:rgba(10,47,73,.12);color:#008f82}
      button.icono{color:#5c6f80}
      .propuesta{color:#16324a}
      .resultado{border-top-color:rgba(10,47,73,.12)}
    }
    @media(prefers-reduced-motion:reduce){.panel{animation:none}button{transition:none}.punto{animation:none}}
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
  const boton = (clase: string, etiqueta: string, contenido: SVGElement | string) => {
    const elemento = document.createElement('button');
    elemento.type = 'button';
    if (clase) elemento.className = clase;
    elemento.title = etiqueta;
    elemento.setAttribute('aria-label', etiqueta);
    if (typeof contenido === 'string') elemento.textContent = contenido;
    else elemento.append(contenido);
    return elemento;
  };

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.dataset.fase = 'idle';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Mejorar redacción con SofLIA');

  const cabecera = document.createElement('div');
  cabecera.className = 'cabecera';
  const titulo = document.createElement('span');
  titulo.textContent = 'Mejorar redacción';
  const cerrar = boton('icono cerrar', 'Cerrar', icono('M7 7l10 10M17 7L7 17'));
  cabecera.append(icono('M5 19h3l9.3-9.3a2.1 2.1 0 0 0-3-3L5 16z', 'M13.3 7.4l3.3 3.3'), titulo, cerrar);

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

  const resultado = document.createElement('div');
  resultado.className = 'resultado';
  const estado = document.createElement('div');
  estado.className = 'estado';
  const punto = document.createElement('span');
  punto.className = 'punto';
  const estadoTexto = document.createElement('span');
  estadoTexto.textContent = 'Mejorando…';
  estado.append(punto, estadoTexto);
  const propuesta = document.createElement('div');
  propuesta.className = 'propuesta';
  propuesta.setAttribute('aria-live', 'polite');
  const acciones = document.createElement('div');
  acciones.className = 'acciones';
  const aplicar = boton('primary', 'Reemplazar el texto seleccionado', 'Reemplazar');
  const copiar = boton('', 'Copiar la propuesta', 'Copiar');
  const reintentar = boton('', 'Pedirlo otra vez', 'Reintentar');
  acciones.append(aplicar, copiar, reintentar);
  resultado.append(estado, propuesta, acciones);

  panel.append(cabecera, cita, peticion, filaEnvio, resultado);
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
    if (mensaje) estadoTexto.textContent = mensaje;
    if (valor === 'working') estadoTexto.textContent = 'Mejorando…';
    if (valor === 'done') {
      const enSitio = objetivo?.kind === 'field' || Boolean(objetivo?.kind === 'range' && objetivo.editable);
      aplicar.textContent = enSitio ? 'Reemplazar' : 'Insertar en el campo';
      aplicar.title = enSitio
        ? 'Reemplazar el texto seleccionado'
        : 'Escribir la propuesta en el campo de texto de la página';
      aplicar.setAttribute('aria-label', aplicar.title);
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
    ultimaPropuesta = '';
    pendiente = null;
    esperando = '';
    fase('idle');
    host.style.display = 'block';
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
    fase('error', 'No se pudo escribir en la página. Copia la propuesta.');
  };

  cerrar.addEventListener('click', cerrarPanel);
  mejorar.addEventListener('click', pedir);
  reintentar.addEventListener('click', pedir);
  aplicar.addEventListener('click', aplicarPropuesta);
  copiar.addEventListener('click', () => {
    if (!ultimaPropuesta) return;
    void navigator.clipboard?.writeText(ultimaPropuesta).catch(() => undefined);
    copiar.textContent = 'Copiado';
    window.setTimeout(() => { copiar.textContent = 'Copiar'; }, 1_400);
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
