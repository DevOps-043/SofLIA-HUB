import { describe, expect, it } from 'vitest';
import {
  isAllowedBrowserUrl,
  normalizeBrowserTarget,
  parseBrowserViewport,
} from '../integrated-browser';

describe('validacion del navegador integrado', () => {
  it('normaliza dominios y busquedas a HTTPS', () => {
    expect(normalizeBrowserTarget('example.com/ruta')).toBe('https://example.com/ruta');
    expect(normalizeBrowserTarget('reporte mensual')).toBe('https://www.google.com/search?q=reporte%20mensual');
  });

  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hola', 'chrome://settings'])(
    'rechaza el protocolo peligroso %s',
    (target) => {
      expect(() => normalizeBrowserTarget(target)).toThrow(/protocolo/i);
      expect(isAllowedBrowserUrl(target)).toBe(false);
    },
  );

  it('acepta HTTP(S) y about:blank', () => {
    expect(isAllowedBrowserUrl('https://soflia.ai')).toBe(true);
    expect(isAllowedBrowserUrl('http://localhost:5173')).toBe(true);
    expect(isAllowedBrowserUrl('about:blank')).toBe(true);
  });

  it('ajusta el viewport al contenido y rechaza coordenadas invalidas', () => {
    expect(parseBrowserViewport(
      { x: 200, y: 100, width: 1000, height: 900 },
      { x: 0, y: 0, width: 1200, height: 800 },
    )).toEqual({ x: 200, y: 100, width: 1000, height: 700 });
    expect(() => parseBrowserViewport(
      { x: -1, y: 0, width: 500, height: 400 },
      { x: 0, y: 0, width: 1200, height: 800 },
    )).toThrow(/fuera de rango/i);
    expect(() => parseBrowserViewport(
      { x: 0.5, y: 0, width: 500, height: 400 },
      { x: 0, y: 0, width: 1200, height: 800 },
    )).toThrow(/enteros/i);
  });
});
