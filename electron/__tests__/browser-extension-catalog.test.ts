import { describe, expect, it } from 'vitest';
import { getCatalogFilePins, listExtensionCatalog, verifyCatalogFiles } from '../integrated-browser/extension-catalog';
import { validateExtensionCatalogRequest } from '../../src/shared/browser-extension-catalog';
describe('catálogo fijado de extensiones', () => {
  it('sólo admite exactamente el inventario autorizado, no identidad autodeclarada', () => {
    const entry = listExtensionCatalog()[0]; const files = getCatalogFilePins(entry.id);
    expect(verifyCatalogFiles(entry.id, files)).toEqual(entry);
    for (const changed of [files.slice(1), [...files, files[0]], files.map((file, index) => index ? file : { ...file, sha256: '0'.repeat(64) }), files.map((file, index) => index ? file : { ...file, relative: '../manifest.json' })]) {
      expect(() => verifyCatalogFiles(entry.id, changed)).toThrow();
    }
    expect(() => verifyCatalogFiles('ajena', files)).toThrow();
    files[0].sha256 = '0'.repeat(64); expect(getCatalogFilePins(entry.id)[0].sha256).not.toBe(files[0].sha256);
  });
  it('rechaza rutas, URLs o aprobaciones como comandos', () => {
    expect(validateExtensionCatalogRequest({ action: 'list' })).toEqual({ action: 'list' });
    expect(validateExtensionCatalogRequest({ action: 'prepare', catalogId: 'chrome-reading-time' })).toHaveProperty('catalogId');
    for (const input of [null, { action: 'install' }, { action: 'list', approved: true }, { action: 'prepare', catalogId: '../path' }, { action: 'prepare', catalogId: 'correcto', updateInstallId: '../path' }]) expect(() => validateExtensionCatalogRequest(input)).toThrow();
  });
});
