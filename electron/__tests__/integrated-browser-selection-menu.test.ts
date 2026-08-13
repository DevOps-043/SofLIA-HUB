// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installSelectionMenuInPage,
  parseSelectionMenuBeacon,
  SELECTION_MENU_BEACON,
  SELECTION_MENU_ITEMS,
  setSelectionMenuEnabledInPage,
} from '../integrated-browser/selection-menu';

type MenuScope = typeof globalThis & { __sofliaSelectionMenu?: { host: HTMLElement } };

const RECTS = [{ left: 180, top: 220, right: 340, bottom: 244, width: 160, height: 24 }];

function installMenu(): HTMLElement {
  expect(installSelectionMenuInPage({ beacon: SELECTION_MENU_BEACON, items: SELECTION_MENU_ITEMS })).toBe(true);
  const host = document.querySelector<HTMLElement>('[data-soflia-selection-menu="v1"]');
  if (!host) throw new Error('No se instaló el menú flotante.');
  return host;
}

/** Marca un fragmento del parrafo de prueba y termina el gesto del raton. */
function selectParagraph(): void {
  const node = document.getElementById('texto')?.firstChild;
  if (!node) throw new Error('Falta el párrafo de prueba.');
  const range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, 18);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  vi.advanceTimersByTime(20);
}

function actions(host: HTMLElement): string[] {
  return Array.from(host.shadowRoot?.querySelectorAll<HTMLButtonElement>('button[data-action]') ?? [])
    .map((button) => button.dataset.action ?? '');
}

beforeEach(() => {
  vi.useFakeTimers();
  const scope = globalThis as MenuScope;
  scope.__sofliaSelectionMenu?.host.remove();
  delete scope.__sofliaSelectionMenu;
  document.body.textContent = '';
  const paragraph = document.createElement('p');
  paragraph.id = 'texto';
  paragraph.textContent = 'Texto seleccionado en la página del navegador integrado.';
  document.body.append(paragraph);
  // jsdom no mide el diseño: sin rectangulos el menú se creería fuera de vista.
  Object.defineProperty(Range.prototype, 'getClientRects', { value: () => RECTS, configurable: true });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Menú flotante de selección', () => {
  it('SM-001: ofrece preguntar, mejorar, traducir, resumir y lectura', () => {
    const host = installMenu();

    expect(actions(host)).toEqual(['ask', 'improve', 'translate', 'summarize', 'read']);
    expect(host.shadowRoot?.textContent).toContain('Preguntar a SofLIA');
    expect(host.shadowRoot?.textContent).toContain('Mejorar redacción');
    expect(host.shadowRoot?.textContent).toContain('Traducir');
    expect(host.shadowRoot?.textContent).toContain('Resumir');
    expect(host.shadowRoot?.textContent).toContain('Lectura');
    // Nace escondido: solo hay menú cuando hay texto marcado.
    expect(host.style.display).toBe('none');
  });

  it('SM-002: aparece sobre el texto al terminar la selección, sin pedir clic derecho', () => {
    const host = installMenu();

    selectParagraph();

    expect(host.style.display).toBe('block');
    // Centrado sobre la selección y por encima de ella.
    expect(host.style.left).toBe('260px');
    expect(host.style.top).toBe('210px');
  });

  it('SM-003: la acción avisa al proceso principal y conserva la selección viva', () => {
    const host = installMenu();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    selectParagraph();

    // El proceso principal lee la selección al recibir el aviso: si el clic la
    // deshiciera, la acción llegaría sin texto.
    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    host.dispatchEvent(mousedown);
    host.shadowRoot?.querySelector<HTMLButtonElement>('button[data-action="translate"]')?.click();

    expect(mousedown.defaultPrevented).toBe(true);
    expect(log).toHaveBeenCalledWith(`${SELECTION_MENU_BEACON}:translate`);
    expect(window.getSelection()?.isCollapsed).toBe(false);
    expect(host.style.display).toBe('none');
    log.mockRestore();
  });

  it('SM-004: se retira al deshacer la selección y con Escape', () => {
    const host = installMenu();

    selectParagraph();
    window.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    expect(host.style.display).toBe('none');

    selectParagraph();
    expect(host.style.display).toBe('block');
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    expect(host.style.display).toBe('none');
  });

  it('SM-005: se apaga mientras el agente conduce el navegador', () => {
    const host = installMenu();

    expect(setSelectionMenuEnabledInPage(false)).toBe(true);
    selectParagraph();
    expect(host.style.display).toBe('none');

    expect(setSelectionMenuEnabledInPage(true)).toBe(true);
    selectParagraph();
    expect(host.style.display).toBe('block');
  });

  it('SM-006: reinstalar sobre la misma página no duplica el menú', () => {
    const host = installMenu();

    installMenu();

    expect(document.querySelectorAll('[data-soflia-selection-menu]')).toHaveLength(1);
    expect(document.querySelector('[data-soflia-selection-menu]')).toBe(host);
  });
});

describe('Aviso del menú flotante', () => {
  it('SM-007: reconoce las acciones publicadas por el menú', () => {
    for (const item of SELECTION_MENU_ITEMS) {
      expect(parseSelectionMenuBeacon(`${SELECTION_MENU_BEACON}:${item.action}`)).toBe(item.action);
    }
  });

  it('SM-008: descarta cualquier otra cosa que imprima la página', () => {
    // La pagina es contenido no confiable: solo puede pedir lo que el menu ofrece.
    expect(parseSelectionMenuBeacon('__SOFLIA_SELECTION__')).toBeNull();
    expect(parseSelectionMenuBeacon(`${SELECTION_MENU_BEACON}:eval`)).toBeNull();
    expect(parseSelectionMenuBeacon(`${SELECTION_MENU_BEACON}:`)).toBeNull();
    expect(parseSelectionMenuBeacon('cualquier registro de la página')).toBeNull();
  });
});
