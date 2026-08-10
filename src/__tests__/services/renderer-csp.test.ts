import { describe, expect, it } from 'vitest';
import { injectCSP } from '../../../electron/preload/security';

/**
 * Vive en el proyecto `renderer` porque `injectCSP` manipula el DOM y las
 * pruebas de main corren en Node sin `document`.
 *
 * La CSP que preload inyecta en el renderer decide que puede embeberse.
 *
 * Regresion: sin `frame-src` explicito la directiva cae a `default-src 'self'`
 * —el origen de la aplicacion—, asi que el iframe de la vista previa, que vive
 * en `pulse-presentacion://`, quedaba BLOQUEADO y se veia en blanco. La vista
 * a pantalla completa funcionaba porque es un documento de nivel superior y no
 * esta sujeta a esta politica.
 */
function cspInyectada(): string {
  document.head.innerHTML = '';
  injectCSP();
  return document.head.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '';
}

describe('CSP del renderer', () => {
  it('permite embeber la vista previa de una presentacion', () => {
    const csp = cspInyectada();

    expect(csp).toContain('frame-src');
    expect(csp).toMatch(/frame-src[^;]*pulse-presentacion:/);
  });

  it('no abre el embebido a origenes remotos', () => {
    const csp = cspInyectada();

    const frameSrc = csp.split(';').find((directiva) => directiva.trim().startsWith('frame-src')) ?? '';
    expect(frameSrc).not.toContain('http');
    expect(frameSrc).not.toContain('*');
  });

  it('conserva las demas restricciones', () => {
    const csp = cspInyectada();

    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });
});
