import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserExtensionManager } from '../integrated-browser';

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
  await fs.rm(testRoot, { recursive: true, force: true });
});

describe('administracion de extensiones del navegador', () => {
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
});

async function writeManifest(manifest: Record<string, unknown>): Promise<void> {
  await fs.writeFile(path.join(sourceRoot, 'manifest.json'), JSON.stringify(manifest), 'utf8');
}
