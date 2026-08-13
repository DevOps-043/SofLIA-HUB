import { describe, expect, it } from 'vitest';
import {
  describeBlockedUrl,
  isAllowedBrowserUrl,
  normalizeBrowserTarget,
  parseBrowserViewport,
} from '../integrated-browser';

// Los flujos de inicio de sesion de Google encadenan `continue` anidados y
// tokens opacos: la direccion de la verificacion en dos pasos supera con
// holgura los 2 KB que antes se consideraban el maximo aceptable.
const URL_AUTENTICACION_LARGA = `https://accounts.google.com/v3/signin/challenge/dp?TL=${'A'.repeat(3_000)}&continue=https%3A%2F%2Fmail.google.com%2Fmail%2Fu%2F0%2F`;

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

  it('acepta direcciones de autenticacion largas y sigue acotando el tamaño', () => {
    expect(URL_AUTENTICACION_LARGA.length).toBeGreaterThan(2_048);
    expect(isAllowedBrowserUrl(URL_AUTENTICACION_LARGA)).toBe(true);
    expect(normalizeBrowserTarget(URL_AUTENTICACION_LARGA)).toBe(URL_AUTENTICACION_LARGA);

    const desmedida = `https://example.com/?q=${'a'.repeat(40_000)}`;
    expect(isAllowedBrowserUrl(desmedida)).toBe(false);
    expect(() => normalizeBrowserTarget(desmedida)).toThrow(/limite/i);
  });

  it('describe un destino bloqueado sin exponer sus parametros', () => {
    const descripcion = describeBlockedUrl('https://accounts.google.com/CheckCookie?token=secreto-de-sesion');
    expect(descripcion).toContain('accounts.google.com');
    expect(descripcion).not.toContain('secreto-de-sesion');
    expect(describeBlockedUrl('javascript:alert(1)')).toMatch(/javascript:/);
    expect(describeBlockedUrl('no-es-una-url')).toMatch(/sin protocolo/i);
    expect(describeBlockedUrl('   ')).toBe('destino vacio');
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
