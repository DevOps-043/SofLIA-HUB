/** Compila permisos de sitios en el manifiesto que Chromium ejecuta, no en una UI decorativa. */
export function normalizeExtensionSites(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error('Elige hasta 50 sitios para la extensión.');
  return [...new Set(value.map(item => {
    if (typeof item !== 'string' || item.length > 300) throw new Error('Sitio de extensión inválido.');
    let url: URL;
    try { url = new URL(item); } catch { throw new Error('Sitio de extensión inválido.'); }
    // La selección identifica esquema y dominio; Chromium aplica el patrón a todos sus puertos.
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port
      || url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*')) throw new Error('Usa un origen HTTP(S) sin ruta ni puerto no estándar.');
    return url.origin;
  }))];
}

export function restrictExtensionManifest(raw: unknown, rawSites: unknown): Record<string, unknown> {
  const sites = normalizeExtensionSites(rawSites);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Manifiesto inválido.');
  const manifest = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  if (manifest.manifest_version !== 3) throw new Error('Se requiere Manifest V3.');
  // No simular aislamiento de APIs que entregan metadata global o elevan permisos.
  for (const key of ['permissions', 'optional_permissions']) {
    const values = manifest[key] ?? [];
    if (!Array.isArray(values) || values.some(value => value !== 'storage' && value !== 'scripting')) {
      throw new Error('El control por sitio sólo admite permisos storage y scripting; reinstala una variante compatible.');
    }
  }
  if (manifest.devtools_page || manifest.chrome_url_overrides || manifest.oauth2 || manifest.externally_connectable) throw new Error('Esta extensión declara capacidades fuera del aislamiento por sitio.');
  delete manifest.optional_permissions; delete manifest.optional_host_permissions;
  manifest.host_permissions = intersectPatterns(rawPatterns(manifest.host_permissions), sites);
  manifest.incognito = 'not_allowed';
  if (manifest.content_scripts !== undefined) {
    if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length > 100) throw new Error('Scripts inválidos.');
    manifest.content_scripts = manifest.content_scripts.flatMap(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Script inválido.');
      const script = value as Record<string, unknown>;
      const matches = intersectPatterns(rawPatterns(script.matches), sites);
      // No heredar permisos hacia about:blank, data: o marcos no seleccionados.
      return matches.length ? [{ ...script, matches, all_frames: false, match_about_blank: false, match_origin_as_fallback: false }] : [];
    });
  }
  if (manifest.web_accessible_resources !== undefined) {
    if (!Array.isArray(manifest.web_accessible_resources)) throw new Error('Recursos inválidos.');
    manifest.web_accessible_resources = manifest.web_accessible_resources.flatMap(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || 'extension_ids' in value) throw new Error('Recursos fuera del aislamiento por sitio.');
      const resource = value as Record<string, unknown>;
      const matches = intersectPatterns(rawPatterns(resource.matches), sites);
      return matches.length ? [{ ...resource, matches }] : [];
    });
  }
  return manifest;
}

function rawPatterns(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 300 || value.some(item => typeof item !== 'string' || item.length > 300)) throw new Error('Patrones de sitio inválidos.');
  return value;
}

function intersectPatterns(patterns: string[], sites: string[]): string[] {
  const result = [...new Set(patterns.flatMap(pattern => {
    const parsed = pattern === '<all_urls>' ? ['*', '*', '/*'] : /^([a-z*]+):\/\/([^/]+)(\/.*)$/.exec(pattern)?.slice(1);
    if (!parsed) throw new Error('Patrón de extensión no compatible.');
    const [scheme, host, pathname] = parsed;
    if (!['*', 'https', 'http', 'file', 'ftp'].includes(scheme)) throw new Error('Protocolo no compatible.');
    return sites.flatMap(site => {
      const url = new URL(site);
      const hostMatches = host === '*' || host === url.hostname || host.startsWith('*.') && (url.hostname === host.slice(2) || url.hostname.endsWith(host.slice(1)));
      return hostMatches && (scheme === '*' || `${scheme}:` === url.protocol) ? [`${url.origin}${pathname}`] : [];
    });
  }))];
  if (result.length > 300) throw new Error('La selección genera demasiados patrones de sitio.');
  return result;
}
