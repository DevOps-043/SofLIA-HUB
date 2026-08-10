// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  clearReadingHighlightInPage,
  clearReadingToolbarInPage,
  collectBrowserReadingContent,
  installReadingHighlightInPage,
  installReadingToolbarInPage,
  updateReadingHighlightInPage,
  updateReadingToolbarCueInPage,
  updateReadingToolbarInPage,
  waitForReadingToolbarActionInPage,
} from '../integrated-browser/reading-mode-content';

function createContents(input: {
  url?: string;
  title?: string;
  extracted?: unknown;
  sessionFetch?: ReturnType<typeof vi.fn>;
  debuggerClient?: unknown;
}) {
  return {
    getURL: vi.fn(() => input.url ?? 'https://example.com/documento'),
    getTitle: vi.fn(() => input.title ?? 'Documento de prueba'),
    isDestroyed: vi.fn(() => false),
    executeJavaScript: vi.fn(async () => input.extracted),
    session: {
      fetch: input.sessionFetch ?? vi.fn(),
    },
    debugger: input.debuggerClient,
  } as unknown as Electron.WebContents;
}

describe('extraccion del modo lectura', () => {
  it('READ-001: prioriza la seleccion explicita sin inspeccionar el DOM', async () => {
    const contents = createContents({ title: 'Guia ejecutiva' });

    const result = await collectBrowserReadingContent({
      contents,
      tabId: 'tab-1',
      request: { sourceUrl: 'https://example.com/documento#seccion', selection: '  Primer parrafo.\n\nSegundo parrafo.  ' },
    });

    expect(result).toMatchObject({
      tabId: 'tab-1',
      title: 'Guia ejecutiva',
      selectionOnly: true,
      text: 'Primer parrafo.\n\nSegundo parrafo.',
    });
    expect(result.blocks).toHaveLength(2);
    expect(contents.executeJavaScript).not.toHaveBeenCalled();
  });

  it('READ-002: conserva estructura y offsets de un documento extraido', async () => {
    const contents = createContents({
      extracted: {
        title: 'Modelo organizacional',
        language: 'es-MX',
        truncated: false,
        blocks: [
          { kind: 'heading', text: 'Introduccion', level: 1 },
          { kind: 'paragraph', text: 'Este es el contenido principal.', level: null },
          { kind: 'paragraph', text: 'Buscar', level: null },
        ],
      },
    });

    const result = await collectBrowserReadingContent({ contents, tabId: 'tab-2', request: {} });

    expect(result.selectionOnly).toBe(false);
    expect(result.language).toBe('es-mx');
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[1]).toMatchObject({ start: 14, end: 45 });
    expect(result.text.slice(result.blocks[1].start, result.blocks[1].end)).toBe(result.blocks[1].text);
  });

  it('READ-003: rechaza selecciones de otra pagina y protocolos no web', async () => {
    const contents = createContents({ url: 'https://example.com/actual' });
    await expect(collectBrowserReadingContent({
      contents,
      tabId: 'tab-3',
      request: { sourceUrl: 'https://example.com/anterior', selection: 'Texto' },
    })).rejects.toThrow(/otra pestaña/i);

    const internal = createContents({ url: 'about:blank' });
    await expect(collectBrowserReadingContent({ contents: internal, tabId: 'tab-4', request: {} }))
      .rejects.toThrow(/compatible/i);
  });

  it('READ-023: extrae Google Docs con la sesión autenticada sin leer su interfaz', async () => {
    const sessionFetch = vi.fn(async () => new Response(
      'DOCUMENTO CORPORATIVO\n\nModelo SofLIA de Evolución Organizacional\n\nContenido principal del documento.',
      { status: 200, headers: { 'Content-Type': 'text/plain' } },
    ));
    const contents = createContents({
      url: 'https://docs.google.com/document/d/1EVhZbFG8zsZSEJ90gqLX0SkNzHayM9oE6uZT6ttplw/edit',
      title: 'Modelo organizacional',
      sessionFetch,
    });

    const result = await collectBrowserReadingContent({ contents, tabId: 'tab-docs', request: {} });

    expect(sessionFetch).toHaveBeenCalledWith(
      'https://docs.google.com/document/d/1EVhZbFG8zsZSEJ90gqLX0SkNzHayM9oE6uZT6ttplw/export?format=txt',
      expect.objectContaining({ credentials: 'include', redirect: 'follow' }),
    );
    expect(result.text).toContain('Modelo SofLIA de Evolución Organizacional');
    expect(result.text).not.toContain('Pestañas del documento');
    expect(contents.executeJavaScript).not.toHaveBeenCalled();
  });

  it('READ-026: Google Docs falla de forma segura sin usar el DOM de la interfaz', async () => {
    const sessionFetch = vi.fn(async () => new Response('No disponible', { status: 403 }));
    const debuggerClient = {
      isAttached: vi.fn(() => false),
      attach: vi.fn(),
      detach: vi.fn(),
      sendCommand: vi.fn(async (method: string) => method === 'Accessibility.getFullAXTree' ? { nodes: [] } : {}),
    };
    const contents = createContents({
      url: 'https://docs.google.com/document/d/1EVhZbFG8zsZSEJ90gqLX0SkNzHayM9oE6uZT6ttplw/edit',
      extracted: {
        title: 'Interfaz', language: 'es', truncated: false,
        blocks: [{ kind: 'paragraph', text: 'Pestañas del documento', level: null }],
      },
      sessionFetch,
      debuggerClient,
    });

    await expect(collectBrowserReadingContent({ contents, tabId: 'tab-docs-fail', request: {} }))
      .rejects.toThrow(/no expuso el contenido/i);
    expect(contents.executeJavaScript).not.toHaveBeenCalled();
  });
});

describe('resaltado temporal del modo lectura', () => {
  it('relaciona offsets con el DOM sin envolver ni reemplazar el texto', () => {
    document.body.innerHTML = '<main><p>Hola mundo desde SofLIA.</p><img alt="Gráfica ejecutiva"></main>';
    const originalHtml = document.body.innerHTML;
    const highlights = { set: vi.fn(), delete: vi.fn() };
    vi.stubGlobal('CSS', { highlights });
    vi.stubGlobal('Highlight', class {
      constructor(public readonly range: Range) {}
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: vi.fn(), configurable: true });

    expect(installReadingHighlightInPage({ readingId: 'reading-123', text: 'Hola mundo desde SofLIA.' })).toBe(true);
    expect(updateReadingHighlightInPage({ readingId: 'reading-123', revision: 1, start: 5, end: 10 })).toBe(true);
    const highlight = highlights.set.mock.calls[0][1] as { range: Range };
    expect(highlight.range.toString()).toBe('mundo');
    expect(updateReadingHighlightInPage({ readingId: 'reading-123', revision: 1, start: 0, end: 4 })).toBe(false);
    expect(highlights.set).toHaveBeenCalledTimes(1);
    expect(document.body.innerHTML).toContain('<img alt="Gráfica ejecutiva">');
    expect(document.body.innerHTML.replace(/<style[^>]*>[\s\S]*?<\/style>/u, '')).toBe(originalHtml);

    expect(clearReadingHighlightInPage('reading-123')).toBe(true);
    expect(highlights.delete).toHaveBeenCalledWith('soflia-pulsehub-reading-active-v1');
    vi.unstubAllGlobals();
  });

  it('degrada el resaltado sin mutar la página cuando el rango es inválido', () => {
    document.body.innerHTML = '<p>Texto breve</p>';
    vi.stubGlobal('CSS', { highlights: { set: vi.fn(), delete: vi.fn() } });
    vi.stubGlobal('Highlight', class {});
    installReadingHighlightInPage({ readingId: 'reading-456', text: 'Texto breve' });

    expect(updateReadingHighlightInPage({ readingId: 'reading-456', revision: 1, start: 20, end: 30 })).toBe(false);
    expect(document.body.textContent).toBe('Texto breve');
    clearReadingHighlightInPage('reading-456');
    vi.unstubAllGlobals();
  });
});

describe('cápsula flotante del modo lectura', () => {
  it('READ-018: funciona cuando la página exige Trusted Types y bloquea innerHTML', () => {
    document.body.textContent = '';
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Documento protegido por Trusted Types.';
    document.body.append(paragraph);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const innerHtmlSetter = vi.spyOn(Element.prototype, 'innerHTML', 'set').mockImplementation(() => {
      throw new TypeError("This document requires 'TrustedHTML' assignment.");
    });

    try {
      expect(installReadingToolbarInPage({
        readingId: 'reading-trusted-types', selectionOnly: false, text: paragraph.textContent,
      })).toBe(true);
      expect(innerHtmlSetter).not.toHaveBeenCalled();
      expect(document.querySelector('[data-soflia-reading-toolbar="reading-trusted-types"]')).toBeTruthy();
      expect(clearReadingToolbarInPage('reading-trusted-types')).toBe(true);
    } finally {
      innerHtmlSetter.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('se ancla a la selección, usa bordes redondeados y entrega acciones sin polling', async () => {
    document.body.innerHTML = '<main><p id="texto">Texto seleccionado con una gráfica cercana.</p><img alt="Gráfica"></main>';
    const node = document.getElementById('texto')!.firstChild!;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 18);
    Object.defineProperty(range, 'getClientRects', { value: () => [{ left: 180, top: 220, right: 340, bottom: 244, width: 160, height: 24 }] });
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    expect(installReadingToolbarInPage({ readingId: 'reading-toolbar-1', selectionOnly: true, text: 'Texto seleccionado' })).toBe(true);
    const host = document.querySelector<HTMLElement>('[data-soflia-reading-toolbar="reading-toolbar-1"]')!;
    expect(host).toBeTruthy();
    expect(host.shadowRoot?.textContent).toContain('1×');
    expect(host.shadowRoot?.querySelector('style')?.textContent).toContain('border-radius:18px');
    expect(document.querySelector('img')?.getAttribute('alt')).toBe('Gráfica');

    host.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="toggle"]')?.click();
    await expect(waitForReadingToolbarActionInPage('reading-toolbar-1')).resolves.toEqual({
      readingId: 'reading-toolbar-1', action: 'toggle',
    });
    expect(updateReadingToolbarInPage({
      readingId: 'reading-toolbar-1', status: 'playing', speed: 1.25,
    })).toBe(true);
    expect(updateReadingToolbarCueInPage({
      readingId: 'reading-toolbar-1', text: 'SofLIA',
    })).toBe(true);
    expect(host.shadowRoot?.querySelector('[data-action="toggle"]')?.getAttribute('aria-label')).toBe('Pausar narración');
    expect(host.shadowRoot?.textContent).toContain('1.25×');
    expect(host.shadowRoot?.querySelector<HTMLElement>('.cue')?.textContent).toBe('SofLIA');
    expect(host.shadowRoot?.querySelector<HTMLElement>('.cue')?.dataset.visible).toBe('true');
    expect(host.shadowRoot?.querySelector('style')?.textContent).toContain('text-decoration:underline 2px');
    expect(host.shadowRoot?.querySelector('[data-action="download"]')).toBeNull();

    const pendingAction = waitForReadingToolbarActionInPage('reading-toolbar-1');
    expect(clearReadingToolbarInPage('reading-toolbar-1')).toBe(true);
    await expect(pendingAction).resolves.toEqual({ readingId: 'reading-toolbar-1', action: 'closed' });
    expect(document.querySelector('[data-soflia-reading-toolbar]')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('READ-019: permite mover la cápsula dentro del viewport y restablecer su anclaje', () => {
    document.body.innerHTML = '<main><p id="texto-movible">Texto movible para lectura.</p></main>';
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    expect(installReadingToolbarInPage({
      readingId: 'reading-draggable', selectionOnly: false, text: 'Texto movible para lectura.',
    })).toBe(true);
    const host = document.querySelector<HTMLElement>('[data-soflia-reading-toolbar="reading-draggable"]')!;
    expect(host.shadowRoot).toBeTruthy();
    const handle = host.shadowRoot!.querySelector<HTMLButtonElement>('.drag');
    expect(handle).toBeTruthy();
    if (!handle) throw new Error('No se instaló el asa de la cápsula.');
    expect(handle.getAttribute('aria-label')).toBe('Mover reproductor');

    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
      Object.defineProperty(event, 'pointerId', { value: 7 });
      return event;
    };
    handle.dispatchEvent(pointer('pointerdown', 100, 50));
    handle.dispatchEvent(pointer('pointermove', 500, 300));
    handle.dispatchEvent(pointer('pointerup', 500, 300));

    expect(host.style.left).toBe('400px');
    expect(host.style.top).toBe('250px');
    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.style.top).toBe('16px');

    expect(clearReadingToolbarInPage('reading-draggable')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('READ-028: no ancla la cápsula de Google Docs a texto de sus menús', () => {
    document.body.innerHTML = '<nav>Pestañas del documento</nav><div>Modelo SofLIA</div>';
    vi.stubGlobal('location', { hostname: 'docs.google.com', pathname: '/document/d/documento123/edit' });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    expect(installReadingToolbarInPage({
      readingId: 'reading-docs-toolbar', selectionOnly: false, text: 'Modelo SofLIA',
    })).toBe(true);
    const sessions = (globalThis as typeof globalThis & {
      __sofliaReadingToolbars?: Map<string, { anchorRange: Range | null }>;
    }).__sofliaReadingToolbars;
    expect(sessions?.get('reading-docs-toolbar')?.anchorRange).toBeNull();

    clearReadingToolbarInPage('reading-docs-toolbar');
    vi.unstubAllGlobals();
  });
});
