import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { IntegratedBrowserService } from './integrated-browser';
import { denyIfUnauthenticated } from './main/require-auth';

export function registerIntegratedBrowserHandlers(
  service: IntegratedBrowserService,
  getMainWindow: () => BrowserWindow | null,
): void {
  const handle = (
    channel: string,
    operation: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>,
    serialize: (value: unknown) => Record<string, unknown> = (state) => ({ state }),
  ) => {
    ipcMain.handle(channel, async (event, ...args) => {
      const denied = denyIfUnauthenticated(channel);
      if (denied) return { success: false, error: denied.error };
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
        console.warn(`[Navegador] Emisor IPC rechazado en ${channel}.`);
        return { success: false, error: 'sender_denied' };
      }
      try {
        const value = await operation(event, ...args);
        return { success: true, ...serialize(value) };
      } catch (error) {
        return { success: false, error: safeBrowserError(error) };
      }
    });
  };

  handle('integrated-browser:get-state', () => service.getState());
  handle('integrated-browser:capture-visible', async () => ({
    screenshot: await service.captureVisiblePage(),
    state: service.getState(),
  }), (result) => result as Record<string, unknown>);
  handle('integrated-browser:get-observation', async (_event, input) => ({
    ...(await service.getObservation(readForceFresh(input))),
    state: service.getState(),
  }), (result) => result as Record<string, unknown>);
  handle('integrated-browser:set-observation-enabled', async (_event, input) => ({
    ...(await service.setObservationEnabled(readEnabled(input))),
    state: service.getState(),
  }), (result) => result as Record<string, unknown>);
  handle('integrated-browser:open', (_event, input) => {
    const url = readOptionalUrl(input);
    return service.open(url);
  });
  handle('integrated-browser:navigate', (_event, input) => service.navigate(readTarget(input)));
  handle('integrated-browser:tab-create', (_event, input) => service.createTab(readOptionalUrl(input)));
  handle('integrated-browser:tab-close', (_event, input) => service.closeTab(readTabId(input)));
  handle('integrated-browser:tab-activate', (_event, input) => service.activateTab(readTabId(input)));
  handle('integrated-browser:tab-detach', (_event, input) => service.detachTab(readTabId(input)));
  handle('integrated-browser:tab-reattach', (_event, input) => service.reattachTab(readTabId(input)));
  handle('integrated-browser:view-mode', (_event, input) => {
    const value = readViewMode(input);
    return service.setViewMode(value.mode, value.secondaryTabId);
  });
  handle('integrated-browser:go-back', () => service.goBack());
  handle('integrated-browser:go-forward', () => service.goForward());
  handle('integrated-browser:reload', () => service.reload());
  handle('integrated-browser:stop', () => service.stop());
  handle('integrated-browser:focus', () => service.focus());
  handle('integrated-browser:set-viewport', (_event, viewport) => service.setViewport(viewport));
  handle('integrated-browser:hide', () => service.hide());
  handle('integrated-browser:history-list', (_event, input) => service.listHistory(readHistoryQuery(input)), (history) => ({ history }));
  handle('integrated-browser:history-clear', () => service.clearHistory(), (cleared) => ({ cleared }));
  handle('integrated-browser:credentials-list', () => service.listCredentials(), (credentials) => ({ credentials }));
  handle('integrated-browser:credentials-save', (_event, input) => service.saveCredential(readCredentialInput(input)), (credential) => ({ credential }));
  handle('integrated-browser:credentials-fill', (_event, input) => service.fillCredential(readId(input, 'credencial')), (credential) => ({ credential }));
  handle('integrated-browser:credentials-remove', (_event, input) => service.removeCredential(readId(input, 'credencial')), (removed) => ({ removed }));
  handle('integrated-browser:extensions-list', () => service.listExtensions(), (extensions) => ({ extensions }));
  handle('integrated-browser:extensions-install', () => service.prepareExtensionInstall(), (result) => result as Record<string, unknown>);
  handle('integrated-browser:extensions-confirm-install', (_event, input) => (
    service.confirmExtensionInstall(readId(input, 'instalacion', 'token'))
  ), (extension) => ({ extension }));
  handle('integrated-browser:extensions-set-enabled', (_event, input) => {
    if (!input || typeof input !== 'object' || typeof (input as { enabled?: unknown }).enabled !== 'boolean') {
      throw new Error('El estado de la extension es invalido.');
    }
    return service.setExtensionEnabled(readId(input, 'extension', 'installId'), (input as { enabled: boolean }).enabled);
  }, (extension) => ({ extension }));
  handle('integrated-browser:extensions-remove', (_event, input) => service.removeExtension(readId(input, 'extension', 'installId')), (removed) => ({ removed }));
}

function readOptionalUrl(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (!input || typeof input !== 'object') throw new Error('Payload de apertura invalido.');
  const url = (input as { url?: unknown }).url;
  if (url === undefined) return undefined;
  if (typeof url !== 'string') throw new Error('La URL debe ser texto.');
  return url;
}

function readTarget(input: unknown): string {
  if (!input || typeof input !== 'object') throw new Error('Payload de navegacion invalido.');
  const target = (input as { target?: unknown }).target;
  if (typeof target !== 'string') throw new Error('La direccion debe ser texto.');
  return target;
}

function readForceFresh(input: unknown): boolean {
  if (input === undefined || input === null) return false;
  if (!input || typeof input !== 'object') throw new Error('Payload de observación inválido.');
  const forceFresh = (input as { forceFresh?: unknown }).forceFresh;
  if (forceFresh === undefined) return false;
  if (typeof forceFresh !== 'boolean') throw new Error('El modo de actualización de percepción es inválido.');
  return forceFresh;
}

function readEnabled(input: unknown): boolean {
  if (!input || typeof input !== 'object' || typeof (input as { enabled?: unknown }).enabled !== 'boolean') {
    throw new Error('El estado de percepción es inválido.');
  }
  return (input as { enabled: boolean }).enabled;
}

function readTabId(input: unknown): string {
  if (!input || typeof input !== 'object') throw new Error('El identificador de pestaña es inválido.');
  const tabId = (input as { tabId?: unknown }).tabId;
  if (typeof tabId !== 'string' || !tabId.trim() || tabId.length > 80) throw new Error('El identificador de pestaña es inválido.');
  return tabId;
}

function readViewMode(input: unknown): { mode: 'single' | 'split' | 'overlay'; secondaryTabId?: string } {
  if (!input || typeof input !== 'object') throw new Error('El modo de vista es inválido.');
  const value = input as { mode?: unknown; secondaryTabId?: unknown };
  if (value.mode !== 'single' && value.mode !== 'split' && value.mode !== 'overlay') throw new Error('El modo de vista es inválido.');
  if (value.secondaryTabId !== undefined && (typeof value.secondaryTabId !== 'string' || !value.secondaryTabId.trim() || value.secondaryTabId.length > 80)) {
    throw new Error('La pestaña secundaria es inválida.');
  }
  return { mode: value.mode, secondaryTabId: value.secondaryTabId };
}

function readHistoryQuery(input: unknown): { query?: string; limit?: number } {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object') throw new Error('La consulta de historial es invalida.');
  const value = input as { query?: unknown; limit?: unknown };
  if (value.query !== undefined && (typeof value.query !== 'string' || value.query.length > 200)) {
    throw new Error('El texto de historial es invalido.');
  }
  if (value.limit !== undefined && (typeof value.limit !== 'number' || !Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 200)) {
    throw new Error('El limite de historial es invalido.');
  }
  return { query: value.query, limit: value.limit };
}

function readCredentialInput(input: unknown): { id?: string; username: string; password: string } {
  if (!input || typeof input !== 'object') throw new Error('La credencial es invalida.');
  const value = input as { id?: unknown; username?: unknown; password?: unknown };
  if (value.id !== undefined && typeof value.id !== 'string') throw new Error('El identificador de credencial es invalido.');
  if (typeof value.username !== 'string' || typeof value.password !== 'string') throw new Error('La credencial es invalida.');
  return { id: value.id, username: value.username, password: value.password };
}

function readId(input: unknown, label: string, key = 'id'): string {
  if (!input || typeof input !== 'object') throw new Error(`El identificador de ${label} es invalido.`);
  const id = (input as Record<string, unknown>)[key];
  if (typeof id !== 'string') throw new Error(`El identificador de ${label} es invalido.`);
  return id;
}

function safeBrowserError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 240) || 'Error del navegador integrado.';
}
