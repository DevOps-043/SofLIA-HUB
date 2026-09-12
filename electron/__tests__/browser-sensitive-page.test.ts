import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { WebContents } from 'electron';
import { BROWSER_SENSITIVE_PROBE, inspectBrowserSensitivePage } from '../integrated-browser/sensitive-page';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string, options: { url: string; runScripts: string }) => { window: Window & { Element: typeof Element; eval: (source: string) => unknown } } };

function page(html: string) {
  const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only' });
  vi.spyOn(dom.window.performance, 'now').mockReturnValue(0);
  // JSDOM no tiene layout: simular sólo visibilidad, nunca el dictamen de seguridad.
  Object.defineProperty(dom.window.Element.prototype, 'getClientRects', { value: () => [{ width: 100, height: 30 }] });
  const inspect = () => dom.window.eval(BROWSER_SENSITIVE_PROBE) as { reason: string | null };
  return { dom, inspect };
}
describe('sonda local de formularios sensibles', () => {
  it('comparte el presupuesto entre documento y shadow DOM', () => {
    const f = page('<section id="host"></section>' + '<i></i>'.repeat(200));
    try {
      f.dom.window.document.getElementById('host')!.attachShadow({ mode: 'open' }).innerHTML = '<i></i>'.repeat(3900);
      expect(f.inspect()).toEqual({ reason: 'uninspectable' });
    } finally { f.dom.window.close(); }
  });
  it.each([
    ['<input type="password" value="NO-TRANSMITIR">', 'secret'],
    ['<input autocomplete="cc-number" value="FICTICIO">', 'payment'],
    ['<input autocomplete="street-address">', 'identity'],
    ['<h1>Historial médico</h1>', 'medical'],
    ['<textarea>Texto sin clasificar</textarea>', 'form'],
    ['<canvas></canvas>', 'uninspectable'], ['<iframe></iframe>', 'uninspectable'],
  ])('retorna sólo categoría: %s', (html, reason) => {
    const f = page(html);
    try { expect(f.inspect()).toEqual({ reason }); expect(JSON.stringify(f.inspect())).not.toContain('NO-TRANSMITIR'); }
    finally { f.dom.window.close(); }
  });
  it('permite lectura pública y búsqueda identificada, no campos genéricos', () => {
    const f = page('<h1>Astronomía</h1><form role="search"><input type="search" name="q" value="estrellas"></form>');
    try { expect(f.inspect()).toEqual({ reason: null }); }
    finally { f.dom.window.close(); }
  });
  it('el indicador permanece después de retirar el formulario y cambiar el hash', async () => {
    const f = page('<p>Lectura pública</p>');
    try {
      expect(f.inspect()).toEqual({ reason: null });
      f.dom.window.document.body.innerHTML = '<input type="password" value="NO-TRANSMITIR">';
      await Promise.resolve();
      f.dom.window.document.body.innerHTML = '<p>Lectura pública</p>'; f.dom.window.location.hash = 'otra-seccion';
      expect(f.inspect()).toEqual({ reason: 'secret' });
    } finally { f.dom.window.close(); }
  });
  it('sin mundo aislado, respuesta inválida o rechazo no cae al mundo principal', async () => {
    const executeJavaScript = vi.fn();
    expect(await inspectBrowserSensitivePage({ executeJavaScript } as unknown as WebContents)).toBe('uninspectable');
    const target = { executeJavaScript, executeJavaScriptInIsolatedWorld: vi.fn(async () => ({ reason: 'permitir' })) };
    expect(await inspectBrowserSensitivePage(target as unknown as WebContents)).toBe('uninspectable');
    target.executeJavaScriptInIsolatedWorld.mockRejectedValueOnce(new Error('privado'));
    expect(await inspectBrowserSensitivePage(target as unknown as WebContents)).toBe('uninspectable');
    expect(executeJavaScript).not.toHaveBeenCalled();
  });
});
