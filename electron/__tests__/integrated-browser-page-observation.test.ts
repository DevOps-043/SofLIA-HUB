import { describe, expect, it, vi } from 'vitest';
import { collectIntegratedBrowserDom } from '../integrated-browser/page-observation';

describe('percepción DOM del navegador integrado', () => {
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
});
