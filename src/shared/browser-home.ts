/** Único documento interno permitido en las vistas del navegador. */
export const BROWSER_HOME_URL = 'soflia-inicio://inicio/';
export const BROWSER_HOME_TITLE = 'Inicio · SofLIA';

export function isBrowserHomeUrl(value: unknown): value is typeof BROWSER_HOME_URL {
  return value === BROWSER_HOME_URL;
}

export function browserAddressValue(url: string): string {
  return isBrowserHomeUrl(url) || url === 'about:blank' ? '' : url;
}
