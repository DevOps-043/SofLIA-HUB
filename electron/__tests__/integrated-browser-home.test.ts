import { describe, expect, it, vi } from 'vitest';
import type { Protocol } from 'electron';
import { protocol, session } from 'electron';
import { BROWSER_HOME_URL, browserAddressValue } from '../../src/shared/browser-home';
import { BROWSER_HOME_CSP, BROWSER_HOME_SCHEME, BROWSER_HOME_SCHEME_REGISTRATION, registerBrowserHomeProtocol, resolveBrowserHomeRequest } from '../integrated-browser/home/protocol';
import { registerPresentationScheme, PRESENTATION_SCHEME } from '../skill-workspace/protocol';
import { isAllowedBrowserUrl, normalizeBrowserTarget } from '../integrated-browser/validation';
import { checkBrowserNavigation } from '../integrated-browser/safe-navigation';
import { parseBrowserSession } from '../integrated-browser/session-store';

describe('inicio local del navegador', () => {
  it('agrupa presentación e inicio en una sola declaración de esquemas, sin saltarse CSP', () => {
    const initial = vi.mocked(protocol.registerSchemesAsPrivileged).mock.calls.length;
    registerPresentationScheme([BROWSER_HOME_SCHEME_REGISTRATION]);
    expect(vi.mocked(protocol.registerSchemesAsPrivileged).mock.calls.length - initial).toBe(1);
    const [schemes] = vi.mocked(protocol.registerSchemesAsPrivileged).mock.calls[initial];
    expect(schemes.map((entry: { scheme: string }) => entry.scheme)).toEqual([PRESENTATION_SCHEME, BROWSER_HOME_SCHEME]);
    expect(BROWSER_HOME_SCHEME_REGISTRATION.privileges).toEqual({ standard: true, secure: true });
  });

  it('sirve un documento autónomo con búsqueda accesible y CSP sin scripts ni conexiones', async () => {
    const response = resolveBrowserHomeRequest({ url: BROWSER_HOME_URL, method: 'GET' });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBe(BROWSER_HOME_CSP);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(html).toContain('lang="es"');
    expect(html).toContain('action="https://www.google.com/search" method="get" role="search"');
    expect(html).toContain('for="query"');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('prefers-reduced-motion: reduce');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).not.toMatch(/<script\b|<link\b|__HOME_/i);
    expect(html).not.toMatch(/masthead|orbit|TU ESPACIO PARA EXPLORAR|Conecta tus ideas/i);
    expect(BROWSER_HOME_CSP).toContain("script-src 'none'");
    expect(BROWSER_HOME_CSP).toContain("connect-src 'none'");
  });

  it.each([
    'soflia-inicio://otro/', 'soflia-inicio://inicio/archivo',
    'soflia-inicio://inicio/?q=secreto', 'soflia-inicio://inicio/#fragmento',
    'soflia-inicio://usuario:secreto@inicio/', 'soflia-inicio://inicio:99/',
    'soflia-inicio://inicio/../secreto', 'soflia-inicio://inicio/%2e%2e/secreto',
    'file:///secreto', 'javascript:alert(1)', 'data:text/html,hola',
  ])('rechaza %s tanto en el handler como en navegación y restauración', async url => {
    expect(resolveBrowserHomeRequest({ url, method: 'GET' }).status).toBe(404);
    expect(isAllowedBrowserUrl(url)).toBe(false);
    expect(() => normalizeBrowserTarget(url)).toThrow();
    expect(await checkBrowserNavigation(url, { env: {} })).toMatchObject({ action: 'block' });
    expect(() => parseBrowserSession(savedHome(url))).toThrow();
  });

  it('no consulta reputación remota para el inicio y conserva su URL al restaurar', async () => {
    const fetcher = vi.fn();
    expect(isAllowedBrowserUrl(BROWSER_HOME_URL)).toBe(true);
    expect(normalizeBrowserTarget(` ${BROWSER_HOME_URL} `)).toBe(BROWSER_HOME_URL);
    expect(await checkBrowserNavigation(BROWSER_HOME_URL, {
      fetcher, env: { BROWSER_SAFE_BROWSING_ENDPOINT: 'https://safe.example/check' },
    })).toMatchObject({ action: 'allow', source: 'local' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(parseBrowserSession(savedHome(BROWSER_HOME_URL)).tabs[0].url).toBe(BROWSER_HOME_URL);
    expect(browserAddressValue(BROWSER_HOME_URL)).toBe('');
    expect(browserAddressValue('https://example.com/')).toBe('https://example.com/');
  });

  it('registra una sola vez por partición y cubre perfiles diferentes', () => {
    const first = session.fromPartition('home-test-1').protocol;
    const second = session.fromPartition('home-test-2').protocol;
    const initial = vi.mocked(first.handle).mock.calls.length;
    registerBrowserHomeProtocol(first as unknown as Protocol);
    registerBrowserHomeProtocol(first as unknown as Protocol);
    registerBrowserHomeProtocol(second as unknown as Protocol);
    expect(vi.mocked(first.handle).mock.calls.length - initial).toBe(1);
    expect(second.isProtocolHandled(BROWSER_HOME_SCHEME)).toBe(true);
  });

  it('HEAD no devuelve contenido y POST no ejecuta acciones', async () => {
    expect(await resolveBrowserHomeRequest({ url: BROWSER_HOME_URL, method: 'HEAD' }).text()).toBe('');
    expect(resolveBrowserHomeRequest({ url: BROWSER_HOME_URL, method: 'POST' }).status).toBe(405);
  });
});

function savedHome(url: string): string {
  return JSON.stringify({
    version: 2, savedAt: '2026-10-10T00:00:00.000Z', cleanExit: true,
    activeTabId: 'home', primaryTabId: 'home', secondaryTabId: null,
    detachedTabIds: [], viewMode: 'single', tabLayout: 'horizontal', groups: [],
    tabs: [{ id: 'home', url, title: 'Inicio · SofLIA', pinned: false, muted: false, groupId: null, position: 0 }],
  });
}
