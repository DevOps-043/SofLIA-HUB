import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { AGENT_WORLD_ID } from '../integrated-browser/agent-world';
import { collectIntegratedBrowserDom, preferredDomBackend } from '../integrated-browser/page-observation';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, options: { url: string; runScripts: string }) => { window: Window & typeof globalThis };
};

describe('percepción DOM del navegador integrado', () => {
  it('revela un enlace renderizado por su ruta y mantiene su identidad al renovar el DOM', async () => {
    const { window } = new JSDOM('<a hidden href="/paquete.bin">Oculto</a><a id="archivo" href="/paquete.bin?key=privado"></a>', {
      url: 'https://example.com/notas', runScripts: 'outside-only',
    });
    const rect = () => new window.DOMRect(10, 2400 - window.scrollY, 140, 30);
    Object.defineProperties(window.HTMLAnchorElement.prototype, {
      checkVisibility: { value(this: HTMLAnchorElement) { return !this.hidden; } },
      getBoundingClientRect: { value: rect },
      getClientRects: { value: () => [rect()] },
      scrollIntoView: { value: () => { Object.defineProperty(window, 'scrollY', { value: 2100, configurable: true }); } },
    });
    const contents = { executeJavaScript: async (script: string): Promise<unknown> => window.eval(script) } as unknown as Parameters<typeof collectIntegratedBrowserDom>[0];
    try {
      const normal = { backend: 'script' } as const;
      expect((await collectIntegratedBrowserDom(contents, normal)).controls).toEqual([]);
      const result = await collectIntegratedBrowserDom(contents, { findLink: 'paquete.bin' });
      const { matchedLinkRef } = result;
      expect(matchedLinkRef).toBeTruthy();
      expect(result.controls[0]).toMatchObject({ ref: matchedLinkRef, href: 'https://example.com/paquete.bin', name: 'paquete.bin' });
      expect(result.viewport.scrollY).toBe(2100);
      expect((await collectIntegratedBrowserDom(contents, normal)).controls[0].ref).toBe(matchedLinkRef);
      const oldLink = window.document.getElementById('archivo')!;
      oldLink.replaceWith(oldLink.cloneNode());
      expect((await collectIntegratedBrowserDom(contents, normal)).controls[0].ref).not.toBe(matchedLinkRef);
      const secret = await collectIntegratedBrowserDom(contents, { findLink: 'key=privado' });
      expect(secret.matchedLinkRef).toBeNull();
      expect(JSON.stringify(secret)).not.toContain('privado');
    } finally { window.close(); }
  });

  it('acota el payload, elimina credenciales de URLs y nunca conserva valores de formularios', async () => {
    const executeJavaScript = vi.fn(async (script: string) => ({
      title: script.length ? ' Acceso ' : '',
      url: 'https://persona:secreto@example.com/login?token=privado#paso',
      language: 'es',
      text: 'Contenido público',
      headings: [{ level: 2, text: 'Iniciar sesión', scope: 'document' }],
      landmarks: [],
      controls: [{
        ref: 'dom-1', tag: 'input', role: 'textbox', name: 'Contraseña', text: '', type: 'password',
        href: 'https://persona:secreto@example.com/cuenta?token=privado', disabled: false, checked: null,
        rect: { x: 10, y: 20, width: 300, height: 40 }, scope: 'document', value: 'NO-DEBE-SALIR',
      }],
      frames: [],
      viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 1200 },
      truncated: false,
    }));

    const contents = { executeJavaScript } as unknown as Parameters<typeof collectIntegratedBrowserDom>[0];
    const snapshot = await collectIntegratedBrowserDom(contents);
    const script = executeJavaScript.mock.calls[0]?.[0];
    expect(snapshot.url).toBe('https://example.com/login');
    expect(snapshot.controls[0]).toMatchObject({ type: 'password-redacted', href: 'https://example.com/cuenta', text: '' });
    expect(JSON.stringify(snapshot)).not.toContain('NO-DEBE-SALIR');
    expect(JSON.stringify(snapshot)).not.toContain('secreto');
    expect(JSON.stringify(snapshot)).not.toContain('token=privado');
    expect(script).not.toMatch(/\.value\b/);
    expect(script).not.toContain('selectedOptions');
    expect(script).toContain('scanned: 1800');
    expect(script).toContain('viewportMargin: 240');
    expect(script).toContain('const measurements = new WeakMap()');
    expect(script).not.toContain('textNodesScanned < 6000');
  });

  it('expone las imagenes de contenido conservando su query y sin credenciales', async () => {
    const executeJavaScript = vi.fn(async (script: string) => ({
      title: script.length ? 'Informe' : '', url: 'https://example.com/doc', language: 'es', text: 'Contenido',
      headings: [], landmarks: [], controls: [], frames: [],
      images: [
        // La query lleva el tamano o la firma: quitarla devolveria un 403, asi
        // que aqui SI se conserva, al reves que en las URL de pagina.
        { url: 'https://cdn.example.com/grafica.png?w=1200&sig=abc', alt: 'Evolucion de ingresos', width: 1200, height: 800 },
        { url: 'https://usuario:secreto@cdn.example.com/foto.jpg?v=2', alt: '', width: 900, height: 600 },
        { url: 'data:image/png;base64,AAAA', alt: 'incrustada', width: 900, height: 600 },
        { url: 'no-es-una-url', alt: 'rota', width: 900, height: 600 },
      ],
      viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 1200 },
      truncated: false,
    }));

    const contents = { executeJavaScript } as unknown as Parameters<typeof collectIntegratedBrowserDom>[0];
    const snapshot = await collectIntegratedBrowserDom(contents);
    const script = executeJavaScript.mock.calls[0]?.[0];

    expect(snapshot.images).toEqual([
      { url: 'https://cdn.example.com/grafica.png?w=1200&sig=abc', alt: 'Evolucion de ingresos', width: 1200, height: 800 },
      { url: 'https://cdn.example.com/foto.jpg?v=2', alt: '', width: 900, height: 600 },
    ]);
    // `data:` y `blob:` no se pueden volver a pedir desde el proceso principal.
    expect(JSON.stringify(snapshot)).not.toContain('data:image');
    expect(JSON.stringify(snapshot)).not.toContain('secreto');
    // Los iconos y pixeles de seguimiento se descartan dentro de la pagina.
    expect(script).toContain('minImage: 200');
  });

  describe('eleccion de backend', () => {
    const original = process.env.SOFLIA_BROWSER_CDP_DOM;
    afterEach(() => {
      if (original === undefined) delete process.env.SOFLIA_BROWSER_CDP_DOM;
      else process.env.SOFLIA_BROWSER_CDP_DOM = original;
    });

    it('usa el recorrido en script mientras el flag este apagado', () => {
      delete process.env.SOFLIA_BROWSER_CDP_DOM;
      expect(preferredDomBackend()).toBe('script');
      process.env.SOFLIA_BROWSER_CDP_DOM = '1';
      expect(preferredDomBackend()).toBe('cdp');
    });

    it('lee dentro del mundo aislado del agente, no en el de la pagina', async () => {
      const executeJavaScript = vi.fn(async () => ({ url: 'https://example.com', text: 'hola' }));
      const executeJavaScriptInIsolatedWorld = vi.fn(async () => ({ url: 'https://example.com', text: 'hola' }));
      const contents = { executeJavaScript, executeJavaScriptInIsolatedWorld } as unknown as
        Parameters<typeof collectIntegratedBrowserDom>[0];

      await collectIntegratedBrowserDom(contents, { backend: 'script' });

      expect(executeJavaScript).not.toHaveBeenCalled();
      expect(executeJavaScriptInIsolatedWorld).toHaveBeenCalledWith(
        AGENT_WORLD_ID,
        [{ code: expect.stringContaining('const LIMITS = { text:') }],
        true,
      );
    });

    it('cae al recorrido en script cuando la captura por CDP falla', async () => {
      const executeJavaScript = vi.fn(async () => ({ url: 'https://example.com/respaldo', text: 'respaldo' }));
      const contents = {
        executeJavaScript,
        isDestroyed: () => false,
        getURL: () => 'https://example.com/respaldo',
        debugger: {
          isAttached: () => false,
          // Con DevTools abierto la sesion no se puede tomar. Dejar al agente
          // sin lectura seria peor que devolver la observacion acotada.
          attach: () => { throw new Error('Another debugger is already attached'); },
          detach: vi.fn(),
          once: vi.fn(),
          sendCommand: vi.fn(async () => ({})),
        },
      } as unknown as Parameters<typeof collectIntegratedBrowserDom>[0];

      const snapshot = await collectIntegratedBrowserDom(contents, { backend: 'cdp' });

      expect(snapshot.url).toBe('https://example.com/respaldo');
      expect(executeJavaScript).toHaveBeenCalledOnce();
    });
  });
});
