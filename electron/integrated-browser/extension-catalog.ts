import type { BrowserExtensionCatalogEntry } from '../../src/shared/browser-extension-catalog';

// Raíz de confianza distribuida con la aplicación: nunca tomada de un manifiesto del usuario.
// Fuente oficial GoogleChrome, commit verificado por GitHub el 2025-06-23.
// Pines contrastados por HTTPS el 2026-09-11; no equivalen a verificar PGP en runtime.
const revision = 'b55612ae647f6b9ef0401db91127489a4a80c070';
const readingTime: BrowserExtensionCatalogEntry = {
  id: 'chrome-reading-time', name: 'Tiempo de lectura de Chrome Developers',
  publisher: 'GoogleChrome · ejemplo oficial', version: '1.0', revision,
  sourceUrl: 'https://github.com/GoogleChrome/chrome-extensions-samples/tree/' + revision + '/functional-samples/tutorial.reading-time',
  description: 'Ejemplo Apache-2.0 para artículos de developer.chrome.com/docs/extensions y /docs/webstore. No es una extensión general ni una publicación de Chrome Web Store.',
};
const fingerprints: Record<string, string> = {
  'manifest.json': '5e3018b9e4fabeca7395b9726da6776da8a535dd47c30f10c46f12e984465bce',
  'README.md': '88c5f82a37bb87703b3f81304c03e048f579bdbf1672df292f9edd4bfb22b9fe',
  'scripts/content.js': '63f22f422cc803215530a35d729983aa2b0feff005c58088adc31e3739e664eb',
  'images/icon-16.png': '57c2e0a95f3f98fe8c5ab1beae0147a89b4bebbd0816b519f9aa721fdc254ca2',
  'images/icon-32.png': '2165186ed47217c570c6d48b72310fb13ac72c2d85a847380a2046a2bbcf9edd',
  'images/icon-48.png': 'c32764e0d059360ddfa4f27d181ca12b66c7aa093c877859d6e02b2fcc0c962a',
  'images/icon-128.png': '5c856279beb01888b2d4a1d7ff2cad753990cac245beebf443c7d39f1a0dd246',
};
export function listExtensionCatalog(): BrowserExtensionCatalogEntry[] { return [{ ...readingTime }]; }
export function getCatalogFilePins(id: string): Array<{ relative: string; sha256: string }> {
  getExtensionCatalogEntry(id);
  return Object.entries(fingerprints).map(([relative, sha256]) => ({ relative, sha256 }));
}
export function getExtensionCatalogEntry(id: string): BrowserExtensionCatalogEntry {
  if (id !== readingTime.id) throw new Error('Extensión fuera del catálogo.');
  return { ...readingTime };
}
export function verifyCatalogFiles(id: string, files: ReadonlyArray<{ relative: string; sha256: string }>): BrowserExtensionCatalogEntry {
  const entry = getExtensionCatalogEntry(id);
  const names = files.map(file => file.relative.replace(/\\/g, '/'));
  if (files.length !== Object.keys(fingerprints).length || new Set(names).size !== names.length
    || files.some((file, index) => fingerprints[names[index]] !== file.sha256)) throw new Error('La carpeta no coincide con la revisión oficial del catálogo.');
  return entry;
}
