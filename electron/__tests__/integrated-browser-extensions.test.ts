import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserExtensionManager } from '../integrated-browser';
import * as catalog from '../integrated-browser/extension-catalog';

let testRoot = '';
let sourceRoot = '';
let managedRoot = '';

beforeEach(async () => {
  vi.clearAllMocks();
  testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-browser-extension-'));
  sourceRoot = path.join(testRoot, 'source');
  managedRoot = path.join(testRoot, 'managed');
  await fs.mkdir(sourceRoot, { recursive: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(testRoot, { recursive: true, force: true });
});

describe('administracion de extensiones del navegador', () => {
  it.each(['éxito', 'carga', 'registro', 'concurrencia'] as const)('actualización conserva restricciones y no pierde la versión previa ante fallo: %s', async outcome => {
    // La autenticidad exacta se prueba aparte y en Electron real; aquí se fuerzan fallos de publicación.
    const entry = catalog.listExtensionCatalog()[0];
    vi.spyOn(catalog, 'verifyCatalogFiles').mockReturnValue(entry);
    await writeManifest({ manifest_version: 3, name: 'Catálogo fixture', version: '1.0', host_permissions: ['https://example.com/*'] });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow(); const session = window.webContents.session;
    const manager = new BrowserExtensionManager(managedRoot);
    const prepared = await manager.prepareFromDialog(window, () => {}, { id: entry.id });
    const previous = await manager.confirmInstall(prepared.preview!.token, session);
    await manager.setEnabled(previous.installId, false, session);
    await manager.restrictSites(previous.installId, [], () => {});
    const update = await manager.prepareFromDialog(window, () => {}, { id: entry.id, updateInstallId: previous.installId });
    expect(update.preview?.updateName).toBe(previous.name);
    if (outcome === 'carga') vi.mocked(session.extensions.loadExtension).mockRejectedValueOnce(new Error('Fallo nativo'));
    if (outcome === 'concurrencia') await manager.restrictSites(previous.installId, ['https://example.com'], () => {});
    if (outcome === 'registro') {
      const rename = fs.rename.bind(fs);
      vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
        if (String(to) === path.join(managedRoot, 'registry.json')) throw new Error('Disco');
        return rename(from, to);
      });
    }
    if (outcome === 'éxito') {
      const next = await manager.confirmInstall(update.preview!.token, session);
      expect(next).toMatchObject({ catalogId: entry.id, catalogRevision: entry.revision, siteAccess: [], hostPermissions: [], enabled: true });
      expect(next.installId).not.toBe(previous.installId);
      expect(await manager.list()).toHaveLength(1);
      await expect(fs.stat(path.join(managedRoot, previous.installId))).rejects.toMatchObject({ code: 'ENOENT' });
    } else {
      await expect(manager.confirmInstall(update.preview!.token, session)).rejects.toThrow();
      expect((await manager.list())[0].installId).toBe(previous.installId);
      expect((await fs.stat(path.join(managedRoot, previous.installId))).isDirectory()).toBe(true);
    }
  });
  it.each(['hosts', 'manifest', 'package'] as const)('rechaza expansión fuera de cuota antes de modificar disco: %s', async quota => {
    const base = { manifest_version: 3, name: 'Cuotas', version: '1.0.0',
      host_permissions: quota === 'hosts' ? ['https://*.example.test/a*', 'https://*.example.test/b*', 'https://*.example.test/c*'] : ['https://*.example.test/*'],
      ...(quota === 'manifest' ? { web_accessible_resources: Array.from({ length: 250 }, () => ({ resources: ['style.css'], matches: ['https://*.example.test/*'] })) } : {}) };
    await writeManifest(base);
    const previous = await fs.readFile(path.join(sourceRoot, 'manifest.json'));
    if (quota === 'package') await fs.writeFile(path.join(sourceRoot, 'padding.bin'), Buffer.alloc(20 * 1024 * 1024 - previous.length - 16));
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow(); const session = window.webContents.session;
    const manager = new BrowserExtensionManager(managedRoot);
    const preview = await manager.prepareFromDialog(window);
    const installed = await manager.confirmInstall(preview.preview!.token, session);
    await manager.setEnabled(installed.installId, false, session);
    const sites = Array.from({ length: 50 }, (_, index) => `https://host-${index}-long.example.test`);
    await expect(manager.restrictSites(installed.installId, sites, () => {})).rejects.toThrow();
    expect(await fs.readFile(path.join(managedRoot, installed.installId, 'manifest.json'))).toEqual(previous);
    expect((await manager.setEnabled(installed.installId, true, session)).status).toBe('loaded');
  });

  it('reduce el manifiesto real, conserva la huella y nunca recupera permisos retirados', async () => {
    await writeManifest({ manifest_version: 3, name: 'Sitios', version: '1.0.0', permissions: ['storage', 'scripting'], host_permissions: ['<all_urls>'], content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'] }] });
    await fs.writeFile(path.join(sourceRoot, 'content.js'), 'document.title;');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow(); const session = window.webContents.session;
    const manager = new BrowserExtensionManager(managedRoot);
    const preview = await manager.prepareFromDialog(window);
    const installed = await manager.confirmInstall(preview.preview!.token, session);
    await expect(manager.restrictSites(installed.installId, ['https://example.com'], () => {})).rejects.toThrow(/Deshabilita/);
    await manager.setEnabled(installed.installId, false, session);
    const restricted = await manager.restrictSites(installed.installId, ['https://example.com'], () => {});
    expect(restricted).toMatchObject({ siteAccess: ['https://example.com'], hostPermissions: ['https://example.com/*'], enabled: false });
    expect(restricted).not.toHaveProperty('integrity');
    const manifest = JSON.parse(await fs.readFile(path.join(managedRoot, installed.installId, 'manifest.json'), 'utf8'));
    expect(manifest.content_scripts[0]).toMatchObject({ matches: ['https://example.com/*'], all_frames: false });
    expect((await manager.setEnabled(installed.installId, true, session)).status).toBe('loaded');
    await manager.setEnabled(installed.installId, false, session);
    await expect(manager.restrictSites(installed.installId, [], () => { throw new Error('Perfil sustituido'); })).rejects.toThrow('Perfil sustituido');
    await manager.restrictSites(installed.installId, [], () => {});
    const reopen = new BrowserExtensionManager(managedRoot);
    expect((await reopen.list())[0].siteAccess).toEqual([]);
    expect((await reopen.restrictSites(installed.installId, ['https://example.com'], () => {})).hostPermissions).toEqual([]);
    expect((await reopen.setEnabled(installed.installId, true, session)).status).toBe('loaded');
  });

  it('un fallo de publicación no autoriza el manifiesto parcial y obliga a revisión', async () => {
    await writeManifest({ manifest_version: 3, name: 'Interrupción', version: '1.0.0', host_permissions: ['<all_urls>'] });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow(); const session = window.webContents.session;
    const manager = new BrowserExtensionManager(managedRoot);
    const preview = await manager.prepareFromDialog(window);
    const installed = await manager.confirmInstall(preview.preview!.token, session);
    await manager.setEnabled(installed.installId, false, session);
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (String(to) === path.join(managedRoot, 'registry.json')) throw new Error('Disco no disponible');
      return rename(from, to);
    });
    await expect(manager.restrictSites(installed.installId, [], () => {})).rejects.toThrow();
    vi.restoreAllMocks();
    const reopen = new BrowserExtensionManager(managedRoot);
    expect((await reopen.setEnabled(installed.installId, true, session)).status).toBe('error');
  });

  it.each(['content', 'added', 'removed', 'legacy', 'unchanged'] as const)('verifica huella antes de restaurar o habilitar: %s', async (mutation) => {
    await writeManifest({ manifest_version: 3, name: 'Revisada', version: '1.0.0' });
    await fs.writeFile(path.join(sourceRoot, 'content.js'), 'safe();');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow(); const session = window.webContents.session;
    const manager = new BrowserExtensionManager(managedRoot);
    const preview = await manager.prepareFromDialog(window);
    const installed = await manager.confirmInstall(preview.preview!.token, session);
    const registryFile = path.join(managedRoot, 'registry.json');
    const registry = JSON.parse(await fs.readFile(registryFile, 'utf8'));
    expect(registry.extensions[0].integrity).toMatch(/^[a-f0-9]{64}$/);
    expect(installed).not.toHaveProperty('integrity');
    const managed = path.join(managedRoot, installed.installId);
    manager.resetForProfileChange(); vi.mocked(session.extensions.loadExtension).mockClear();
    if (mutation === 'content') await fs.writeFile(path.join(managed, 'content.js'), 'evil();');
    if (mutation === 'added') await fs.writeFile(path.join(managed, 'new.js'), 'evil();');
    if (mutation === 'removed') await fs.unlink(path.join(managed, 'content.js'));
    if (mutation === 'legacy') { delete registry.extensions[0].integrity; await fs.writeFile(registryFile, JSON.stringify(registry)); }
    const reopened = new BrowserExtensionManager(managedRoot);
    const restored = await reopened.restore(session);
    expect(restored[0].status).toBe(mutation === 'unchanged' ? 'loaded' : 'error');
    const enabled = await reopened.setEnabled(installed.installId, true, session);
    expect(enabled.status).toBe(mutation === 'unchanged' ? 'loaded' : 'error');
    expect(session.extensions.loadExtension).toHaveBeenCalledTimes(mutation === 'unchanged' ? 1 : 0);
    expect(JSON.stringify(restored)).not.toContain(managedRoot);
  });

  it('prepara permisos sin rutas y solo instala la copia MV3 despues de confirmar', async () => {
    await writeManifest({
      manifest_version: 3,
      name: 'Extension de prueba',
      version: '1.2.3',
      permissions: ['storage'],
      host_permissions: ['https://api.example/*'],
      optional_permissions: ['tabs'],
      optional_host_permissions: ['https://optional.example/*'],
      content_scripts: [{ matches: ['https://app.example/*'], js: ['content.js'] }],
    });
    await fs.writeFile(path.join(sourceRoot, 'content.js'), 'document.title;', 'utf8');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow();
    const manager = new BrowserExtensionManager(managedRoot);

    const prepared = await manager.prepareFromDialog(window);
    expect(prepared.preview).toMatchObject({
      name: 'Extension de prueba',
      version: '1.2.3',
      permissions: expect.arrayContaining(['storage', 'tabs']),
      hostPermissions: expect.arrayContaining(['https://api.example/*', 'https://optional.example/*', 'https://app.example/*']),
    });
    expect(prepared.preview).not.toHaveProperty('sourceRoot');
    expect(dialog.showMessageBox).not.toHaveBeenCalled();

    const result = await manager.confirmInstall(prepared.preview!.token, window.webContents.session);

    expect(result.status).toBe('loaded');
    expect(result.hostPermissions).toEqual(expect.arrayContaining(['https://api.example/*', 'https://app.example/*']));
    expect(window.webContents.session.extensions.loadExtension).toHaveBeenCalledWith(
      expect.stringMatching(/managed/),
      { allowFileAccess: false },
    );
  });

  it('rechaza permisos de alto riesgo antes de copiar o confirmar', async () => {
    await writeManifest({ manifest_version: 3, name: 'Peligrosa', version: '1.0.0', permissions: ['debugger'] });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow();
    const manager = new BrowserExtensionManager(managedRoot);

    await expect(manager.prepareFromDialog(window)).rejects.toThrow(/permiso bloqueado debugger/i);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('rechaza confirmar una seleccion inexistente o con token distinto', async () => {
    const window = new BrowserWindow();
    const manager = new BrowserExtensionManager(managedRoot);

    await expect(manager.confirmInstall('12345678-1234-1234-1234-123456789abc', window.webContents.session))
      .rejects.toThrow(/ya no esta disponible/i);
  });

  it('invalida la autorizacion anterior si se abre y cancela un nuevo selector', async () => {
    await writeManifest({ manifest_version: 3, name: 'Temporal', version: '1.0.0' });
    vi.mocked(dialog.showOpenDialog)
      .mockResolvedValueOnce({ canceled: false, filePaths: [sourceRoot] })
      .mockResolvedValueOnce({ canceled: true, filePaths: [] });
    const window = new BrowserWindow();
    const manager = new BrowserExtensionManager(managedRoot);

    const prepared = await manager.prepareFromDialog(window);
    await expect(manager.prepareFromDialog(window)).resolves.toEqual({ canceled: true });
    await expect(manager.confirmInstall(prepared.preview!.token, window.webContents.session))
      .rejects.toThrow(/ya no esta disponible/i);
  });

  it('rechaza cambios de contenido aunque el archivo conserve el mismo tamaño', async () => {
    await writeManifest({ manifest_version: 3, name: 'Inmutable', version: '1.0.0' });
    await fs.writeFile(path.join(sourceRoot, 'content.js'), 'safe();', 'utf8');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow();
    const manager = new BrowserExtensionManager(managedRoot);

    const prepared = await manager.prepareFromDialog(window);
    await fs.writeFile(path.join(sourceRoot, 'content.js'), 'evil();', 'utf8');

    await expect(manager.confirmInstall(prepared.preview!.token, window.webContents.session)).rejects.toThrow(/cambio durante la instalacion/i);
    expect(window.webContents.session.extensions.loadExtension).not.toHaveBeenCalled();
  });

  it('falla cerrado si el registro intenta cargar una ruta externa', async () => {
    await fs.mkdir(managedRoot, { recursive: true });
    await fs.writeFile(path.join(managedRoot, 'registry.json'), JSON.stringify({
      version: 1,
      extensions: [{
        installId: '12345678-1234-1234-1234-123456789abc',
        extensionId: null,
        managedPath: sourceRoot,
        name: 'Manipulada',
        version: '1.0.0',
        permissions: [],
        hostPermissions: [],
        enabled: true,
        status: 'loaded',
        error: null,
      }],
    }), 'utf8');
    const window = new BrowserWindow();
    const manager = new BrowserExtensionManager(managedRoot);

    await expect(manager.restore(window.webContents.session)).rejects.toThrow(/registro.+danado/i);
    expect(window.webContents.session.extensions.loadExtension).not.toHaveBeenCalled();
  });

  it('no expone rutas locales en errores de carga y permite reintentar', async () => {
    await writeManifest({ manifest_version: 3, name: 'Recuperable', version: '1.0.0', permissions: ['storage'] });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow();
    const loadExtension = vi.mocked(window.webContents.session.extensions.loadExtension);
    loadExtension.mockRejectedValueOnce(new Error(`No se pudo abrir ${managedRoot}\\archivo.js`));
    const manager = new BrowserExtensionManager(managedRoot);

    const prepared = await manager.prepareFromDialog(window);
    const failed = await manager.confirmInstall(prepared.preview!.token, window.webContents.session);

    expect(failed.status).toBe('error');
    expect(failed.error).not.toContain(managedRoot);
    loadExtension.mockResolvedValueOnce({ id: 'extension-recuperada' } as never);
    const recovered = await manager.setEnabled(failed.installId, true, window.webContents.session);
    expect(recovered).toMatchObject({ status: 'loaded', extensionId: 'extension-recuperada', error: null });
  });

  it('retira una extensión activa alterada sin volver a ejecutarla', async () => {
    await writeManifest({ manifest_version: 3, name: 'Activa', version: '1.0.0' });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const window = new BrowserWindow(); const manager = new BrowserExtensionManager(managedRoot);
    const preview = await manager.prepareFromDialog(window);
    const installed = await manager.confirmInstall(preview.preview!.token, window.webContents.session);
    await fs.writeFile(path.join(managedRoot, installed.installId, 'nuevo.js'), 'alterado');
    vi.mocked(window.webContents.session.extensions.loadExtension).mockClear();
    expect((await manager.setEnabled(installed.installId, true, window.webContents.session)).status).toBe('error');
    expect(window.webContents.session.extensions.loadExtension).not.toHaveBeenCalled();
    expect(window.webContents.session.extensions.removeExtension).toHaveBeenCalledWith(installed.extensionId);
  });

  it('rechaza una raíz que sea enlace y directorios demasiado profundos', async () => {
    await writeManifest({ manifest_version: 3, name: 'Acotada', version: '1.0.0' });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const manager = new BrowserExtensionManager(managedRoot); const window = new BrowserWindow();
    const realStat = await fs.lstat(sourceRoot);
    vi.spyOn(fs, 'lstat').mockResolvedValueOnce({ ...realStat, isDirectory: () => true, isSymbolicLink: () => true } as never);
    await expect(manager.prepareFromDialog(window)).rejects.toThrow('sin enlaces');
    await fs.mkdir(path.join(sourceRoot, ...Array.from({ length: 34 }, () => 'd')), { recursive: true });
    await expect(manager.prepareFromDialog(window)).rejects.toThrow('profundidad');
    expect(window.webContents.session.extensions.loadExtension).not.toHaveBeenCalled();
  });

  it('rechaza cargar extensiones en sesiones no persistentes', async () => {
    const window = new BrowserWindow();
    vi.mocked(window.webContents.session.isPersistent).mockReturnValue(false);
    const manager = new BrowserExtensionManager(managedRoot);
    await expect(manager.restore(window.webContents.session)).rejects.toThrow(/privados o de invitado/);
    await expect(manager.confirmInstall('12345678-1234-1234-1234-123456789abc', window.webContents.session)).rejects.toThrow(/privados o de invitado/);
    expect(window.webContents.session.extensions.loadExtension).not.toHaveBeenCalled();
  });

  it('un token de otro perfil no autoriza instalación aunque se vuelva al perfil inicial', async () => {
    await writeManifest({ manifest_version: 3, name: 'Temporal', version: '1.0.0' });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    let currentRoot = managedRoot;
    const manager = new BrowserExtensionManager(() => currentRoot);
    const window = new BrowserWindow();
    const prepared = await manager.prepareFromDialog(window);
    manager.resetForProfileChange(); currentRoot = path.join(testRoot, 'otro');
    manager.resetForProfileChange(); currentRoot = managedRoot;
    await expect(manager.confirmInstall(prepared.preview!.token, window.webContents.session)).rejects.toThrow(/ya no esta disponible/);
    expect(window.webContents.session.extensions.loadExtension).not.toHaveBeenCalled();
  });

  it('descarta la selección que termina después de un cambio de cuenta', async () => {
    let finish!: (result: Electron.OpenDialogReturnValue) => void;
    vi.mocked(dialog.showOpenDialog).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const manager = new BrowserExtensionManager(managedRoot);
    const pending = manager.prepareFromDialog(new BrowserWindow());
    const outcome = pending.catch((error: Error) => error);
    manager.resetForProfileChange();
    finish({ canceled: false, filePaths: [sourceRoot] });
    expect(await outcome).toBeInstanceOf(Error);
    await expect(fs.access(managedRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('descarga una extensión que termina de cargar tras cambiar de perfil sin copiar registros', async () => {
    await writeManifest({ manifest_version: 3, name: 'Carga tardía', version: '1.0.0' });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    let currentRoot = managedRoot;
    const manager = new BrowserExtensionManager(() => currentRoot);
    const window = new BrowserWindow();
    const session = window.webContents.session;
    const prepared = await manager.prepareFromDialog(window);
    let finish!: (extension: Electron.Extension) => void;
    vi.mocked(session.extensions.loadExtension).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = manager.confirmInstall(prepared.preview!.token, session).catch((error: Error) => error);
    await vi.waitFor(() => expect(session.extensions.loadExtension).toHaveBeenCalledOnce());
    manager.resetForProfileChange(); currentRoot = path.join(testRoot, 'otro');
    finish({ id: 'extension-tardia' } as Electron.Extension);
    expect(await pending).toBeInstanceOf(Error);
    expect(session.extensions.removeExtension).toHaveBeenCalledWith('extension-tardia');
    await expect(fs.access(path.join(managedRoot, 'registry.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(currentRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('retira las extensiones activas al cerrar su perfil', async () => {
    await writeManifest({ manifest_version: 3, name: 'Aislada', version: '1.0.0' });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const manager = new BrowserExtensionManager(managedRoot);
    const window = new BrowserWindow();
    const prepared = await manager.prepareFromDialog(window);
    const extension = await manager.confirmInstall(prepared.preview!.token, window.webContents.session);
    manager.resetForProfileChange();
    expect(window.webContents.session.extensions.removeExtension).toHaveBeenCalledWith(extension.extensionId);
    expect((await manager.list())[0].installId).toBe(extension.installId);
  });

  it('retira una carga nueva si falla guardar su habilitación', async () => {
    await writeManifest({ manifest_version: 3, name: 'Transaccional', version: '1.0.0' });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const manager = new BrowserExtensionManager(managedRoot);
    const window = new BrowserWindow(); const session = window.webContents.session;
    const prepared = await manager.prepareFromDialog(window);
    const extension = await manager.confirmInstall(prepared.preview!.token, session);
    await manager.setEnabled(extension.installId, false, session);
    vi.mocked(session.extensions.removeExtension).mockClear();
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('No se pudo guardar.'));
    await expect(manager.setEnabled(extension.installId, true, session)).rejects.toThrow(/guardar/);
    expect(session.extensions.removeExtension).toHaveBeenCalledWith(extension.extensionId);
    expect((await manager.list())[0]).toMatchObject({ enabled: false, status: 'disabled' });
  });

  it('una eliminación concurrente espera una habilitación y retira el ID realmente cargado', async () => {
    await writeManifest({ manifest_version: 3, name: 'Concurrente', version: '1.0.0' });
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    const manager = new BrowserExtensionManager(managedRoot);
    const window = new BrowserWindow(); const session = window.webContents.session;
    const prepared = await manager.prepareFromDialog(window);
    const extension = await manager.confirmInstall(prepared.preview!.token, session);
    await manager.setEnabled(extension.installId, false, session);
    vi.mocked(session.extensions.loadExtension).mockResolvedValueOnce({ id: 'recargada' } as Electron.Extension);
    const enabled = manager.setEnabled(extension.installId, true, session);
    const removed = manager.remove(extension.installId, session);
    await enabled;
    await expect(removed).resolves.toBe(true);
    expect(session.extensions.removeExtension).toHaveBeenCalledWith('recargada');
    await expect(manager.list()).resolves.toEqual([]);
  });
});

async function writeManifest(manifest: Record<string, unknown>): Promise<void> {
  await fs.writeFile(path.join(sourceRoot, 'manifest.json'), JSON.stringify(manifest), 'utf8');
}
