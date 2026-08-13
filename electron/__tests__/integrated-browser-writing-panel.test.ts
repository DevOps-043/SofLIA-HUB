// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeWritingPanelInPage,
  deliverWritingResultInPage,
  installWritingPanelInPage,
  normalizeWritingRequest,
  takeWritingRequestInPage,
  WRITING_PANEL_BEACON,
} from '../integrated-browser/writing-panel';
import {
  installSelectionMenuInPage,
  SELECTION_MENU_BEACON,
  SELECTION_MENU_ITEMS,
} from '../integrated-browser/selection-menu';

type PanelScope = typeof globalThis & {
  __sofliaWritingPanel?: { host: HTMLElement; open: () => boolean };
  __sofliaSelectionMenu?: { host: HTMLElement };
};

const RECTS = [{ left: 200, top: 300, right: 420, bottom: 324, width: 220, height: 24 }];

function installPanel(): { host: HTMLElement; shadow: ShadowRoot } {
  expect(installWritingPanelInPage({ beacon: WRITING_PANEL_BEACON, maxPrompt: 500 })).toBe(true);
  const host = document.querySelector<HTMLElement>('[data-soflia-writing-panel="v1"]');
  if (!host?.shadowRoot) throw new Error('No se instaló el panel de redacción.');
  return { host, shadow: host.shadowRoot };
}

function query<T extends HTMLElement>(shadow: ShadowRoot, selector: string): T {
  const element = shadow.querySelector<T>(selector);
  if (!element) throw new Error(`Falta ${selector} en el panel.`);
  return element;
}

function boton(shadow: ShadowRoot, etiqueta: string): HTMLButtonElement {
  const encontrado = Array.from(shadow.querySelectorAll('button'))
    .find((candidato) => candidato.textContent?.trim() === etiqueta);
  if (!encontrado) throw new Error(`Falta el botón "${etiqueta}".`);
  return encontrado;
}

/** Marca el párrafo de la página, que no es editable. */
function selectParagraph(): void {
  const node = document.getElementById('mensaje')?.firstChild;
  if (!node) throw new Error('Falta el mensaje de prueba.');
  const range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, 12);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** Marca texto dentro del compositor editable. */
function selectComposer(): void {
  const node = document.getElementById('compositor')?.firstChild;
  if (!node) throw new Error('Falta el compositor de prueba.');
  const range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, 10);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

beforeEach(() => {
  const scope = globalThis as PanelScope;
  scope.__sofliaWritingPanel?.host.remove();
  scope.__sofliaSelectionMenu?.host.remove();
  delete scope.__sofliaWritingPanel;
  delete scope.__sofliaSelectionMenu;
  document.body.textContent = '';
  const mensaje = document.createElement('p');
  mensaje.id = 'mensaje';
  mensaje.textContent = 'Buenos dias Fer, este es un gran dia para avanzar.';
  const compositor = document.createElement('div');
  compositor.id = 'compositor';
  compositor.setAttribute('contenteditable', 'true');
  compositor.textContent = 'hola q tal';
  Object.defineProperty(compositor, 'isContentEditable', { value: true, configurable: true });
  // jsdom no calcula diseño: sin medidas el compositor no pasaria el filtro de
  // campo visible que usa el panel para elegir donde escribir.
  Object.defineProperty(compositor, 'getBoundingClientRect', {
    value: () => ({ left: 40, top: 600, right: 700, bottom: 660, width: 660, height: 60 }),
    configurable: true,
  });
  document.body.append(mensaje, compositor);
  Object.defineProperty(Range.prototype, 'getClientRects', { value: () => RECTS, configurable: true });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Panel de redacción de la página', () => {
  it('WP-001: nace oculto y lo abre el menú flotante sin pasar por el chat', () => {
    const { host } = installPanel();
    installSelectionMenuInPage({ beacon: SELECTION_MENU_BEACON, items: SELECTION_MENU_ITEMS });
    const menu = document.querySelector<HTMLElement>('[data-soflia-selection-menu="v1"]');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(host.style.display).toBe('none');

    selectComposer();
    menu?.shadowRoot?.querySelector<HTMLButtonElement>('button[data-action="improve"]')?.click();

    expect(host.style.display).toBe('block');
    // La accion no viaja al chat: se resuelve en la propia pagina.
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('WP-002: pedir avisa una vez y entrega la petición con el texto y la instrucción', () => {
    const { shadow } = installPanel();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    selectComposer();
    (globalThis as PanelScope).__sofliaWritingPanel?.open();

    query<HTMLTextAreaElement>(shadow, 'textarea').value = '  hazlo mas formal  ';
    boton(shadow, 'Mejorar').click();

    expect(log).toHaveBeenCalledWith(WRITING_PANEL_BEACON);
    const solicitud = takeWritingRequestInPage();
    expect(solicitud).toMatchObject({ prompt: 'hazlo mas formal', text: 'hola q tal' });
    expect(solicitud?.requestId).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    // Una peticion se entrega una sola vez: el aviso no puede recogerse dos veces.
    expect(takeWritingRequestInPage()).toBeNull();
    log.mockRestore();
  });

  it('WP-003: la propuesta se escribe en el campo editable sin copiar ni pegar', () => {
    const { host, shadow } = installPanel();
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    selectComposer();
    (globalThis as PanelScope).__sofliaWritingPanel?.open();
    boton(shadow, 'Mejorar').click();
    const requestId = takeWritingRequestInPage()?.requestId ?? '';

    expect(deliverWritingResultInPage({ requestId, text: '  Hola, ¿qué tal?  ' })).toBe(true);
    expect(query(shadow, '.propuesta').textContent).toBe('Hola, ¿qué tal?');
    const aplicar = boton(shadow, 'Reemplazar');
    expect(aplicar.disabled).toBe(false);

    aplicar.click();

    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'Hola, ¿qué tal?');
    // Aplicar cierra el panel: el trabajo termino en la pagina.
    expect(host.style.display).toBe('none');
  });

  it('WP-004: si el texto de origen no es editable, la propuesta entra al campo de la página', () => {
    const { shadow } = installPanel();
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    selectParagraph();
    (globalThis as PanelScope).__sofliaWritingPanel?.open();
    boton(shadow, 'Mejorar').click();
    const requestId = takeWritingRequestInPage()?.requestId ?? '';
    deliverWritingResultInPage({ requestId, text: 'Buenos días Fernando.' });

    const aplicar = boton(shadow, 'Insertar en el campo');
    expect(aplicar.disabled).toBe(false);
    aplicar.click();

    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'Buenos días Fernando.');
    expect(document.activeElement?.id).toBe('compositor');
  });

  it('WP-005: un fallo del modelo se muestra en el panel y deja reintentar', () => {
    const { host, shadow } = installPanel();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    selectComposer();
    (globalThis as PanelScope).__sofliaWritingPanel?.open();
    boton(shadow, 'Mejorar').click();
    const requestId = takeWritingRequestInPage()?.requestId ?? '';

    expect(deliverWritingResultInPage({ requestId, error: 'Sin conexión con el modelo.' })).toBe(true);

    expect(query(shadow, '.panel').dataset.fase).toBe('error');
    expect(query(shadow, '.estado').textContent).toContain('Sin conexión con el modelo.');
    expect(host.style.display).toBe('block');
    // Una respuesta de otra peticion ya no encuentra a quien contestar.
    expect(deliverWritingResultInPage({ requestId, text: 'tarde' })).toBe(false);
  });

  it('WP-006: el panel se cierra cuando el agente toma el control', () => {
    const { host, shadow } = installPanel();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    selectComposer();
    (globalThis as PanelScope).__sofliaWritingPanel?.open();
    boton(shadow, 'Mejorar').click();

    expect(closeWritingPanelInPage()).toBe(true);

    expect(host.style.display).toBe('none');
    // Al cerrar tampoco queda una peticion viva esperando respuesta.
    expect(takeWritingRequestInPage()).toBeNull();
  });
});

describe('Petición de redacción que llega de la página', () => {
  it('WP-007: descarta identificadores inventados y texto vacío, y acota lo demás', () => {
    expect(normalizeWritingRequest({ requestId: 'x', prompt: '', text: 'hola' })).toBeNull();
    expect(normalizeWritingRequest({ requestId: 'w12345678', prompt: '', text: '   ' })).toBeNull();
    expect(normalizeWritingRequest('__proto__')).toBeNull();

    const acotada = normalizeWritingRequest({
      requestId: 'w12345678',
      prompt: 'p'.repeat(900),
      text: 't'.repeat(9_000),
    });

    expect(acotada?.prompt).toHaveLength(500);
    expect(acotada?.text).toHaveLength(8_000);
  });
});
