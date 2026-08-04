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
  it('instala una copia MV3 administrada y muestra todos los sitios alcanzados', async () => {
    await writeManifest({
      manifest_version: 3,
      name: 'Extension de prueba',
      version: '1.2.3',
      permissions: ['storage'],
      host_permissions: ['https://api.example/*'],
      content_scripts: [{ matches: ['https://app.example/*'], js: ['content.js'] }],
    });
    await fs.writeFile(path.join(sourceRoot, 'content.js'), 'document.title;', 'utf8');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [sourceRoot] });
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    const window = new BrowserWindow();
    const manager = new BrowserExtensionManager(managedRoot);

    const result = await manager.installFromDialog(window, window.webContents.session);

    expect(result.extension?.status).toBe('loaded');
    expect(result.extension?.hostPermissions).toEqual(expect.arrayContaining(['https://api.example/*', 'https://app.example/*']));
    expect(dialog.showMessageBox).toHaveBeenCalledWith(window, expect.objectContaining({ detail: expect.stringContaining('https://app.example/*') }));
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

    await expect(manager.installFromDialog(window, window.webContents.session)).rejects.toThrow(/permiso bloqueado debugger/i);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
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
});

async function writeManifest(manifest: Record<string, unknown>): Promise<void> {
  await fs.writeFile(path.join(sourceRoot, 'manifest.json'), JSON.stringify(manifest), 'utf8');
}
