import type { CustomScheme, Protocol } from 'electron';
import { BROWSER_HOME_URL, isBrowserHomeUrl } from '../../../src/shared/browser-home';
import lightTheme from '../../../src/styles/theme-light.css?raw';
import darkTheme from '../../../src/styles/theme-dark.css?raw';
import logo from '../../../public/assets/Icono.png?inline';
import template from './home.html?raw';
import styles from '../../../src/shared/browser-home/home.css?raw';
import content from '../../../src/shared/browser-home/home-content.html?raw';

export const BROWSER_HOME_SCHEME = new URL(BROWSER_HOME_URL).protocol.slice(0, -1);
export const BROWSER_HOME_CSP = [
  "default-src 'none'", "script-src 'none'", "style-src 'unsafe-inline'",
  'img-src data:', "connect-src 'none'", "frame-src 'none'", "object-src 'none'",
  "base-uri 'none'", 'form-action https://www.google.com', "frame-ancestors 'none'",
].join('; ');

// La preferencia nativa ya sigue el tema de la aplicación. Sólo cambia el
// selector; los valores provienen de la misma fuente que el renderer.
const themeStyles = `${lightTheme}\n@media (prefers-color-scheme: dark) { ${darkTheme.replace(/\.dark\s*\{/, ':root {')} }`;
const document = template.replace('__HOME_STYLES__', () => `${themeStyles}\n${styles}`)
  .replace('__HOME_CONTENT__', () => content.replace('__HOME_LOGO__', () => logo));

/** Se agrega al registro único antes de app.whenReady; conserva CSP y aislamiento. */
export const BROWSER_HOME_SCHEME_REGISTRATION: CustomScheme = {
  scheme: BROWSER_HOME_SCHEME, privileges: { standard: true, secure: true },
};

export function resolveBrowserHomeRequest(request: { url: string; method: string }): Response {
  if (!isBrowserHomeUrl(request.url)) return new Response('No encontrado', { status: 404 });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Método no permitido', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  return new Response(request.method === 'HEAD' ? null : document, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': BROWSER_HOME_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

/** Cada perfil y partición privada registra su propia ruta, de forma idempotente. */
export function registerBrowserHomeProtocol(target: Protocol): void {
  if (!target.isProtocolHandled(BROWSER_HOME_SCHEME)) target.handle(BROWSER_HOME_SCHEME, resolveBrowserHomeRequest);
}
