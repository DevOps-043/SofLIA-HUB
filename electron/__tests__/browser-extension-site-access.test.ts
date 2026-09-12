import { describe, expect, it } from 'vitest';
import { normalizeExtensionSites, restrictExtensionManifest } from '../integrated-browser/extension-site-access';

const manifest = { manifest_version: 3, name: 'Prueba', version: '1', permissions: ['storage', 'scripting'], host_permissions: ['https://*.example.com/*'], optional_host_permissions: ['<all_urls>'],
  content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'], all_frames: true, match_about_blank: true, match_origin_as_fallback: true }] };
describe('compilación de permisos por sitio de extensiones', () => {
  it('intersecta sin ampliar los hosts declarados y quita concesiones dinámicas', () => {
    const result = restrictExtensionManifest(manifest, ['https://login.example.com', 'https://otro.test']);
    expect(result.host_permissions).toEqual(['https://login.example.com/*']);
    expect(result.optional_host_permissions).toBeUndefined();
    expect(result.incognito).toBe('not_allowed');
    expect(result.content_scripts).toEqual([{ matches: ['https://login.example.com/*', 'https://otro.test/*'], js: ['content.js'], all_frames: false, match_about_blank: false, match_origin_as_fallback: false }]);
    expect(manifest.content_scripts[0].all_frames).toBe(true);
  });
  it('conserva rutas más estrechas y revoca todos los sitios con lista vacía', () => {
    const original = { ...manifest, content_scripts: [{ matches: ['https://*.example.com/app/*'], js: ['content.js'] }] };
    expect(restrictExtensionManifest(original, ['https://example.com']).content_scripts).toMatchObject([{ matches: ['https://example.com/app/*'] }]);
    expect(restrictExtensionManifest(original, [])).toMatchObject({ host_permissions: [], content_scripts: [] });
    expect(restrictExtensionManifest(manifest, ['https://evil-example.com']).host_permissions).toEqual([]);
  });
  it.each(['tabs', 'activeTab', 'webRequest', 'cookies', 'debugger', 'nativeMessaging', 'proxy'])('no promete aislamiento para %s', permission => {
    expect(() => restrictExtensionManifest({ ...manifest, permissions: [permission] }, [])).toThrow();
    expect(() => restrictExtensionManifest({ ...manifest, optional_permissions: [permission] }, [])).toThrow();
  });
  it.each(['https://example.com:8443', 'file:///x', 'https://u:p@example.com', 'https://example.com/path', 'https://example.com/?q=x', 'https://*.example.com'])('rechaza sitios ambiguos %s', site => {
    expect(() => normalizeExtensionSites([site])).toThrow();
  });
  it('acota cuotas y recursos públicos sin ampliar a otras extensiones', () => {
    expect(() => normalizeExtensionSites(Array(51).fill('https://example.com'))).toThrow();
    expect(normalizeExtensionSites(['https://EXAMPLE.com/', 'https://example.com'])).toEqual(['https://example.com']);
    const original = { ...manifest, web_accessible_resources: [{ resources: ['style.css'], matches: ['<all_urls>'] }] };
    expect(restrictExtensionManifest(original, ['https://example.com']).web_accessible_resources).toEqual([{ resources: ['style.css'], matches: ['https://example.com/*'] }]);
    expect(() => restrictExtensionManifest({ ...manifest, web_accessible_resources: [{ extension_ids: ['*'] }] }, [])).toThrow();
  });
});
