import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { IntegratedBrowserService } from './integrated-browser';
import { BROWSER_SITE_PERMISSION_KINDS } from './integrated-browser/types';
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
  handle('integrated-browser:capture-visible', async () => {
    const capture = await service.captureVisibleBackdrop();
    return {
      screenshot: capture.screenshot,
      captureBounds: capture.bounds,
      state: service.getState(),
    };
  }, (result) => result as Record<string, unknown>);
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
  handle('integrated-browser:element-click', async (_event, input) => ({
    ...(await service.clickElement(readElementRef(input))),
    state: service.getState(),
  }), (result) => result as Record<string, unknown>);
  handle('integrated-browser:element-type', async (_event, input) => {
    const value = readElementTypeInput(input);
    return {
      ...(await service.typeInElement(value.ref, value.text, value.submit)),
      state: service.getState(),
    };
  }, (result) => result as Record<string, unknown>);
  handle('integrated-browser:scroll', (_event, input) => {
    const value = readScrollInput(input);
    service.scrollView(value.direction, value.amount);
    return service.getState();
  });
  handle('integrated-browser:tab-create', (_event, input) => service.createTab(readOptionalUrl(input)));
  handle('integrated-browser:tab-close', (_event, input) => service.closeTab(readTabId(input)));
  handle('integrated-browser:tab-activate', (_event, input) => service.activateTab(readTabId(input)));
  handle('integrated-browser:tab-detach', (_event, input) => service.detachTab(readTabId(input)));
  handle('integrated-browser:tab-reattach', (_event, input) => service.reattachTab(readTabId(input)));
  handle('integrated-browser:tab-reorder', (_event, input) => {
    const { sourceId, targetId } = (input as { sourceId?: unknown; targetId?: unknown }) ?? {};
    return service.reorderTabs(sourceId, targetId);
  });
  handle('integrated-browser:view-mode', (_event, input) => {
    const value = readViewMode(input);
    return service.setViewMode(value.mode, value.secondaryTabId);
  });
  handle('integrated-browser:go-back', () => service.goBack());
  handle('integrated-browser:go-forward', () => service.goForward());
  handle('integrated-browser:reload', () => service.reload());
  handle('integrated-browser:stop', () => service.stop());
  handle('integrated-browser:focus', () => service.focus());
  handle('integrated-browser:toggle-devtools', () => service.toggleDevTools());
  handle('integrated-browser:set-viewport', (_event, viewport) => service.setViewport(viewport));
  handle('integrated-browser:set-overlay-bounds', (_event, input) => service.setOverlayBounds(readOverlayBoundsInput(input)));
  handle('integrated-browser:set-overlay-position', (_event, input) => service.setOverlayPosition(readOverlayPositionInput(input)));
  handle('integrated-browser:hide', () => service.hide());
  handle('integrated-browser:document-read', () => service.readActiveDocument(), (document) => ({ document }));
  handle('integrated-browser:reading-prepare', (_event, input) => service.prepareReadingMode(readReadingPrepareInput(input)), (reading) => ({ reading }));
  handle('integrated-browser:reading-synthesize', (_event, input) => service.synthesizeReadingSegment(readReadingSynthesisInput(input)), (speech) => ({ speech }));
  handle('integrated-browser:reading-highlight', (_event, input) => service.highlightReadingRange(readReadingHighlightInput(input)), (result) => result as Record<string, unknown>);
  handle('integrated-browser:reading-toolbar-wait', (_event, input) => service.waitForReadingToolbarAction(readReadingIdInput(input)), (toolbarAction) => ({ toolbarAction }));
  handle('integrated-browser:reading-toolbar-sync', (_event, input) => service.syncReadingToolbar(readReadingToolbarState(input)), (result) => result as Record<string, unknown>);
  handle('integrated-browser:reading-cancel', (_event, input) => service.cancelReadingSpeech(readReadingCancelInput(input)), (result) => result as Record<string, unknown>);
  handle('integrated-browser:reading-close', (_event, input) => service.closeReadingMode(readReadingIdInput(input)), (result) => result as Record<string, unknown>);
  handle('integrated-browser:history-list', (_event, input) => service.listHistory(readHistoryQuery(input)), (history) => ({ history }));
  handle('integrated-browser:history-clear', () => service.clearHistory(), (cleared) => ({ cleared }));
  // Borrado de datos de navegacion. La confirmacion la da el usuario en el
  // dialogo del renderer; main valida el payload y actua solo sobre el perfil
  // activo.
  handle('integrated-browser:clear-browsing-data', (_event, input) => service.clearBrowsingData(input), (summary) => ({ summary }));
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
  handle('integrated-browser:site-permissions-get', () => service.getSitePermissions(), (site) => ({ site }));
  handle('integrated-browser:site-permissions-set', (_event, input) => (
    service.setSitePermission(readSitePermissionInput(input))
  ), (site) => ({ site }));
  handle('integrated-browser:site-permissions-reset', (_event, input) => (
    service.resetSitePermissions(readSiteOriginInput(input))
  ), (site) => ({ site }));
  handle('integrated-browser:permission-decide', (_event, input) => {
    const { id, granted } = readPermissionDecision(input);
    return service.resolvePermissionPrompt(id, granted);
  }, (resolved) => ({ resolved }));
  handle('integrated-browser:tab-summaries', () => {
    const summaries = service.getTabSummaries();
    return { summaries, state: service.getState() };
  }, (result) => result as Record<string, unknown>);
  handle('integrated-browser:get-tab-content', async (_event, input) => {
    const tabId = readTabId(input);
    const content = await service.getTabContent(tabId);
    return { content, state: service.getState() };
  }, (result) => result as Record<string, unknown>);
  // El renderer devuelve aqui lo que respondio el modelo para el panel de
  // redaccion de la pagina. Main no lo interpreta: solo lo acota y lo entrega.
  handle('integrated-browser:writing-resolve', (_event, input) => (
    service.resolveWritingRequest(readWritingResult(input))
  ), (result) => result as Record<string, unknown>);
}

const MAX_WRITING_RESULT_CHARS = 12_000;

function readWritingResult(input: unknown): { requestId: string; text?: string; error?: string } {
  if (!input || typeof input !== 'object') throw new Error('La respuesta de redaccion es invalida.');
  const value = input as { requestId?: unknown; text?: unknown; error?: unknown };
  if (typeof value.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(value.requestId)) {
    throw new Error('La respuesta de redaccion no identifica su peticion.');
  }
  const text = typeof value.text === 'string' ? value.text.slice(0, MAX_WRITING_RESULT_CHARS) : undefined;
  const error = typeof value.error === 'string' ? value.error.slice(0, 300) : undefined;
  if (!text && !error) throw new Error('La respuesta de redaccion viene vacia.');
  return { requestId: value.requestId, text, error };
}

function readPermissionDecision(input: unknown): { id: string; granted: boolean } {
  if (!input || typeof input !== 'object') throw new Error('Payload de decision invalido.');
  const value = input as { id?: unknown; granted?: unknown };
  if (typeof value.id !== 'string' || !value.id.trim()) throw new Error('El aviso de permiso no es valido.');
  if (typeof value.granted !== 'boolean') throw new Error('La decision del permiso no es valida.');
  return { id: value.id, granted: value.granted };
}

function readSitePermissionInput(input: unknown): { origin?: string; kind: string; state: string } {
  if (!input || typeof input !== 'object') throw new Error('Payload de permiso invalido.');
  const value = input as { origin?: unknown; kind?: unknown; state?: unknown };
  if (typeof value.kind !== 'string' || !BROWSER_SITE_PERMISSION_KINDS.includes(value.kind as never)) {
    throw new Error('El permiso indicado no existe.');
  }
  if (value.state !== 'ask' && value.state !== 'granted' && value.state !== 'denied') {
    throw new Error('El estado del permiso no es valido.');
  }
  return {
    ...readSiteOriginInput(value),
    kind: value.kind,
    state: value.state,
  };
}

function readSiteOriginInput(input: unknown): { origin?: string } {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object') throw new Error('Payload de permiso invalido.');
  const origin = (input as { origin?: unknown }).origin;
  if (origin === undefined) return {};
  if (typeof origin !== 'string' || origin.length > 2_048) throw new Error('El origen del permiso es invalido.');
  return { origin };
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

function readElementRef(input: unknown): string {
  if (!input || typeof input !== 'object') throw new Error('La referencia del elemento es invalida.');
  const ref = (input as { ref?: unknown }).ref;
  if (typeof ref !== 'string' || !ref.trim() || ref.length > 60) throw new Error('La referencia del elemento es invalida.');
  return ref;
}

function readElementTypeInput(input: unknown): { ref: string; text: string; submit: boolean } {
  const ref = readElementRef(input);
  const value = input as { text?: unknown; submit?: unknown };
  if (typeof value.text !== 'string') throw new Error('El texto a escribir debe ser una cadena.');
  if (value.submit !== undefined && typeof value.submit !== 'boolean') throw new Error('El indicador de envio es invalido.');
  return { ref, text: value.text, submit: value.submit === true };
}

function readScrollInput(input: unknown): { direction: string; amount: number | undefined } {
  if (!input || typeof input !== 'object') throw new Error('El desplazamiento es invalido.');
  const value = input as { direction?: unknown; amount?: unknown };
  if (value.direction !== 'up' && value.direction !== 'down' && value.direction !== 'left' && value.direction !== 'right') {
    throw new Error('La direccion de desplazamiento debe ser up, down, left o right.');
  }
  if (value.amount !== undefined && (typeof value.amount !== 'number' || !Number.isFinite(value.amount))) {
    throw new Error('La magnitud de desplazamiento es invalida.');
  }
  return { direction: value.direction, amount: value.amount as number | undefined };
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

function readReadingPrepareInput(input: unknown): { sourceUrl?: string; selection?: string } {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object') throw new Error('La solicitud de modo lectura es inválida.');
  const value = input as { sourceUrl?: unknown; selection?: unknown };
  if (value.sourceUrl !== undefined && (typeof value.sourceUrl !== 'string' || value.sourceUrl.length > 2_048)) {
    throw new Error('La URL de origen del modo lectura es inválida.');
  }
  if (value.selection !== undefined && (typeof value.selection !== 'string' || value.selection.length > 50_000)) {
    throw new Error('La selección del modo lectura excede el límite permitido.');
  }
  return { sourceUrl: value.sourceUrl, selection: value.selection };
}

function readReadingSynthesisInput(input: unknown): { readingId: string; requestId: string; start: number; end: number } {
  if (!input || typeof input !== 'object') throw new Error('La solicitud de narración es inválida.');
  const value = input as { readingId?: unknown; requestId?: unknown; start?: unknown; end?: unknown };
  if (typeof value.readingId !== 'string' || typeof value.requestId !== 'string'
    || typeof value.start !== 'number' || typeof value.end !== 'number'
    || !Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end)
    || value.start < 0 || value.end <= value.start || value.end - value.start > 3_500) {
    throw new Error('La solicitud de narración es inválida.');
  }
  return { readingId: value.readingId, requestId: value.requestId, start: value.start, end: value.end };
}

function readReadingCancelInput(input: unknown): { readingId: string; requestId?: string } {
  if (!input || typeof input !== 'object') throw new Error('La cancelación de narración es inválida.');
  const value = input as { readingId?: unknown; requestId?: unknown };
  if (typeof value.readingId !== 'string' || (value.requestId !== undefined && typeof value.requestId !== 'string')) {
    throw new Error('La cancelación de narración es inválida.');
  }
  return { readingId: value.readingId, requestId: value.requestId };
}

function readReadingHighlightInput(input: unknown): { readingId: string; start?: number; end?: number } {
  if (!input || typeof input !== 'object') throw new Error('La solicitud de resaltado es inválida.');
  const value = input as { readingId?: unknown; start?: unknown; end?: unknown };
  const hasStart = value.start !== undefined;
  const hasEnd = value.end !== undefined;
  if (typeof value.readingId !== 'string' || hasStart !== hasEnd
    || (hasStart && (typeof value.start !== 'number' || typeof value.end !== 'number'
      || !Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end)
      || value.start < 0 || value.end <= value.start || value.end > 60_000))) {
    throw new Error('La solicitud de resaltado es inválida.');
  }
  return { readingId: value.readingId, start: value.start as number | undefined, end: value.end as number | undefined };
}

function readReadingIdInput(input: unknown): { readingId: string } {
  if (!input || typeof input !== 'object' || typeof (input as { readingId?: unknown }).readingId !== 'string') {
    throw new Error('La sesión de lectura es inválida.');
  }
  return { readingId: (input as { readingId: string }).readingId };
}

function readReadingToolbarState(input: unknown): {
  readingId: string;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'completed' | 'error';
  speed: number;
  message?: string;
} {
  if (!input || typeof input !== 'object') throw new Error('El estado del reproductor es inválido.');
  const value = input as { readingId?: unknown; status?: unknown; speed?: unknown; message?: unknown };
  const statuses = new Set(['idle', 'loading', 'playing', 'paused', 'completed', 'error']);
  if (typeof value.readingId !== 'string' || typeof value.status !== 'string' || !statuses.has(value.status)
    || typeof value.speed !== 'number' || !Number.isFinite(value.speed) || value.speed < 0.5 || value.speed > 3
    || (value.message !== undefined && (typeof value.message !== 'string' || value.message.length > 240))) {
    throw new Error('El estado del reproductor es inválido.');
  }
  return {
    readingId: value.readingId,
    status: value.status as 'idle' | 'loading' | 'playing' | 'paused' | 'completed' | 'error',
    speed: value.speed,
    message: value.message as string | undefined,
  };
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

function readOverlayBoundsInput(input: unknown): { x: number; y: number; width: number; height: number } {
  if (!input || typeof input !== 'object') throw new Error('Los límites del panel superpuesto son inválidos.');
  const value = input as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  if (typeof value.x !== 'number' || typeof value.y !== 'number' || typeof value.width !== 'number' || typeof value.height !== 'number'
    || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.width) || !Number.isFinite(value.height)) {
    throw new Error('Los límites del panel superpuesto son inválidos.');
  }
  return {
    x: Math.round(value.x),
    y: Math.round(value.y),
    width: Math.max(160, Math.round(value.width)),
    height: Math.max(120, Math.round(value.height)),
  };
}

function readOverlayPositionInput(input: unknown): 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center' {
  if (!input || typeof input !== 'object') throw new Error('La posición del panel superpuesto es inválida.');
  const pos = (input as { pos?: unknown }).pos;
  const allowed = new Set(['top-right', 'top-left', 'bottom-right', 'bottom-left', 'center']);
  if (typeof pos !== 'string' || !allowed.has(pos)) throw new Error('La posición del panel superpuesto es inválida.');
  return pos as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
}

function safeBrowserError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 240) || 'Error del navegador integrado.';
}
