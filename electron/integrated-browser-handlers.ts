import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { IntegratedBrowserService } from './integrated-browser';
import { validatePolicyRecoveryRequest } from '../src/shared/browser-policy-recovery';
import { BrowserCredentialError, BrowserSyncError, BrowserAuditError, assertSyncUuid, validateSyncControlRequest, validateBrowserShortcutRequest, validateBrowserAgentControlRequest } from './integrated-browser';
import { BROWSER_SITE_PERMISSION_KINDS } from './integrated-browser/types';
import { BROWSER_TAB_GROUP_COLORS, type BrowserTabGroupColor } from './integrated-browser/platform-types';
import { denyIfUnauthenticated } from './main/require-auth';
import { validateBrowserSemanticRequest } from '../src/shared/browser-semantic-memory';
import { getAuthState, onAuthStateChange } from './main/auth-state';
import { validateCredentialSessionRequest } from '../src/shared/browser-credential-session';
import { validateExtensionCatalogRequest } from '../src/shared/browser-extension-catalog';

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
  handle('integrated-browser:credential-session', async (event, ...args) => {
    const parent = getMainWindow(); let changed = false;
    const unsubscribe = onAuthStateChange(() => { changed = true; service.lockCredentials(); });
    const assertCaller = () => {
      if (changed || !getAuthState().authenticated || !parent || parent.isDestroyed() || getMainWindow() !== parent
        || event.sender.id !== parent.webContents.id || !event.senderFrame || event.senderFrame !== parent.webContents.mainFrame) throw new Error('Emisor inválido.');
    };
    try {
      assertCaller(); if (args.length !== 1) throw new Error();
      return await service.credentialSessionCommand(validateCredentialSessionRequest(args[0]), assertCaller);
    } catch { service.lockCredentials(); return { success: false, unlocked: false, error: 'No se pudo verificar la bóveda. Revisa Windows, el perfil y la ventana.' }; }
    finally { unsubscribe(); }
  }, value => value as Record<string, unknown>);
  handle('integrated-browser:policy-recover', async (event, ...args) => {
    const parent = getMainWindow();
    const guard = () => {
      if (!parent || parent.isDestroyed() || parent !== getMainWindow() || event.sender.id !== parent.webContents.id
        || !event.senderFrame || event.senderFrame !== parent.webContents.mainFrame) throw new Error('Emisor inválido.');
    };
    try { guard(); if (args.length !== 1) throw new Error(); return await service.recoverPolicyStore(validatePolicyRecoveryRequest(args[0]), guard); }
    catch { throw new Error('No se pudo recuperar el almacén. Comprueba respaldo compatible, principal ausente o dañado, sesión y control humano.'); }
  }, result => result as Record<string, unknown>);
  handle('integrated-browser:semantic-memory', async (event, ...args) => {
    const parent = getMainWindow(); let sessionChanged = false;
    const unsubscribe = onAuthStateChange(() => { sessionChanged = true; });
    const assertCaller = () => {
      if (sessionChanged || !getAuthState().authenticated || !parent || parent.isDestroyed() || getMainWindow() !== parent
        || event.sender.id !== parent.webContents.id || !event.senderFrame || event.senderFrame !== parent.webContents.mainFrame) throw new Error('El emisor cambió.');
    };
    try {
      assertCaller(); if (args.length !== 1) throw new Error();
      return await service.semanticMemoryCommand(validateBrowserSemanticRequest(args[0]), assertCaller);
    } catch { return { success: false, error: 'No se pudo completar la memoria. Revisa consentimiento, clave de Gemini, perfil y límites; también puede haberse cancelado.' }; }
    finally { unsubscribe(); }
  }, value => value as Record<string, unknown>);
  handle('integrated-browser:agent-control', (event, ...args) => {
    try {
      if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame || args.length !== 1) throw new Error('Emisor inválido.');
      return service.controlAgentTask(validateBrowserAgentControlRequest(args[0]));
    } catch { return { success: false, error: 'No se pudo cambiar la ejecución. Revisa la tarea y el perfil actuales.' }; }
  }, value => value as Record<string, unknown>);
  handle('integrated-browser:agent-shortcuts', async (event, ...args) => {
    try {
      if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame || args.length !== 1) throw new Error('Solicitud de atajos no permitida.');
      return await service.agentShortcuts(validateBrowserShortcutRequest(args[0]));
    } catch { return { success: false, error: 'No se pudo completar la operación de atajos. Revisa los límites, el perfil y actualiza la lista.' }; }
  }, value => value as Record<string, unknown>);
  handle('integrated-browser:agent-audit', async (event, ...args) => {
    try {
      if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame) throw new BrowserAuditError('La bitácora sólo se gestiona desde la ventana principal.');
      const input = args[0];
      if (args.length !== 1 || !input || typeof input !== 'object' || Array.isArray(input) || !('action' in input)) throw new BrowserAuditError('Solicitud de bitácora inválida.');
      const keys = Object.keys(input).sort().join(',');
      if (input.action === 'list' && keys === 'action,offset' && 'offset' in input && typeof input.offset === 'number' && Number.isSafeInteger(input.offset) && input.offset >= 0 && input.offset <= 5000) return { audit: service.listAgentAudit(input.offset) };
      if (input.action === 'clear' && keys === 'action') return { auditChange: await service.changeAgentAudit('clear') };
      if (input.action === 'retention' && keys === 'action,days' && 'days' in input && typeof input.days === 'number' && [7, 30, 90].includes(input.days)) return { auditChange: await service.changeAgentAudit('retention', input.days) };
      throw new BrowserAuditError('Solicitud de bitácora inválida.');
    } catch (error) { throw error instanceof BrowserAuditError ? error : new BrowserAuditError('No se pudo completar la operación de bitácora.'); }
  }, (value) => value as Record<string, unknown>);
  handle('integrated-browser:sync-control', async (event, ...args) => {
    if (event.senderFrame !== getMainWindow()?.webContents.mainFrame || !event.senderFrame) throw new BrowserSyncError('La sincronización sólo se controla desde la ventana principal.');
    try {
      if (args.length !== 1) throw new BrowserSyncError('La solicitud de sincronización es inválida.');
      return { sync: await service.controlSync(validateSyncControlRequest(args[0])) };
    } catch (error) {
      if (error instanceof BrowserSyncError) throw error;
      throw new BrowserSyncError('No se pudo completar la sincronización.');
    }
  }, (value) => value as Record<string, unknown>);
  for (const action of ['get', 'register', 'revoke', 'cancel'] as const) {
    handle(`integrated-browser:sync-devices-${action}`, async (event, ...args) => {
      if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame) throw new BrowserSyncError('Los dispositivos sólo se gestionan desde la ventana principal.');
      try {
        if (action === 'revoke') {
          const input = args[0];
          if (args.length !== 1 || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !('id' in input)) throw new BrowserSyncError('La solicitud de revocación es inválida.');
          assertSyncUuid(input.id);
          return { syncDevices: await service.revokeSyncDevice(input.id) };
        }
        if (args.length) throw new BrowserSyncError('Esta operación de sincronización no acepta argumentos.');
        if (action === 'cancel') { service.cancelSyncOperation(); return { canceled: true }; }
        return { syncDevices: await (action === 'get' ? service.getSyncDevices() : service.registerSyncDevice()) };
      } catch (error) {
        if (error instanceof BrowserSyncError) throw error;
        // Nunca incluir secretos o causas nativas en respuestas de sync.
        throw new BrowserSyncError('No se pudo completar la operación de sincronización.');
      }
    }, (value) => value as Record<string, unknown>);
  }
  handle('integrated-browser:runtime-diagnostic', () => service.getRuntimeDiagnostic(), (diagnostic) => ({ diagnostic }));
  handle('integrated-browser:runtime-diagnostic-export', (event, ...args) => {
    if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame) throw new Error('La exportación sólo se permite desde la ventana principal.');
    if (args.length) throw new Error('La exportación no acepta rutas ni datos del renderer.');
    return service.exportRuntimeDiagnostic();
  }, (diagnosticExport) => ({ diagnosticExport }));
  handle('integrated-browser:session-restore', () => service.restorePreviousSession());
  handle('integrated-browser:session-discard', () => service.discardPreviousSession());
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
  handle('integrated-browser:page-find', (_event, input) => {
    const value = readPageFindInput(input);
    return service.findInPage(value.query, value.forward);
  });
  handle('integrated-browser:page-find-stop', () => service.stopFindInPage());
  handle('integrated-browser:page-zoom', (_event, input) => service.setZoom(readZoomAction(input)));
  handle('integrated-browser:page-mute', (_event, input) => service.setMuted(readMuted(input)));
  handle('integrated-browser:page-fullscreen', () => service.toggleFullscreen());
  handle('integrated-browser:page-print', () => service.printPage());
  handle('integrated-browser:page-save-pdf', () => service.savePageAsPdf(), (result) => result as Record<string, unknown>);
  handle('integrated-browser:downloads-list', () => service.listDownloads(), (downloads) => ({ downloads }));
  handle('integrated-browser:downloads-cancel', (_event, input) => service.cancelDownload(readDownloadId(input)), (download) => ({ download }));
  handle('integrated-browser:downloads-resume', (_event, input) => service.resumeDownload(readDownloadId(input)), (download) => ({ download }));
  handle('integrated-browser:downloads-retry', (_event, input) => service.retryDownload(readDownloadId(input)), (download) => ({ download }));
  handle('integrated-browser:downloads-open', (_event, input) => service.openDownload(readDownloadId(input)), (opened) => ({ opened }));
  handle('integrated-browser:downloads-reveal', (_event, input) => service.revealDownload(readDownloadId(input)), (revealed) => ({ revealed }));
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
  handle('integrated-browser:scroll', async (_event, input) => {
    const value = readScrollInput(input);
    await service.scrollView(value.direction, value.amount);
    return service.getState();
  });
  handle('integrated-browser:tab-create', (_event, input) => service.createTab(readOptionalUrl(input)));
  handle('integrated-browser:tab-close', (_event, input) => service.closeTab(readTabId(input)));
  handle('integrated-browser:tab-duplicate', (_event, input) => service.duplicateTab(readTabId(input)));
  handle('integrated-browser:tab-reopen-closed', (_event, input) => service.reopenClosedTab(input === undefined ? undefined : readTabId(input)));
  handle('integrated-browser:tabs-recently-closed', () => service.listRecentlyClosedTabs(), (recentlyClosedTabs) => ({ recentlyClosedTabs }));
  handle('integrated-browser:tab-close-others', (_event, input) => service.closeOtherTabs(readTabId(input)));
  handle('integrated-browser:tab-close-right', (_event, input) => service.closeTabsToRight(readTabId(input)));
  handle('integrated-browser:tab-pin', (_event, input) => {
    if (!input || typeof input !== 'object' || typeof (input as { pinned?: unknown }).pinned !== 'boolean') throw new Error('El estado fijado es inválido.');
    return service.setTabPinned(readTabId(input), (input as { pinned: boolean }).pinned);
  });
  handle('integrated-browser:tab-layout', (_event, input) => service.setTabLayout(readTabLayout(input)));
  handle('integrated-browser:tab-group-create', (_event, input) => {
    const value = readTabGroup(input);
    return service.createTabGroup(value.name, value.color);
  }, (group) => ({ group }));
  handle('integrated-browser:tab-group-assign', (_event, input) => {
    if (!input || typeof input !== 'object') throw new Error('La asignación de grupo es inválida.');
    const groupId = (input as { groupId?: unknown }).groupId;
    if (groupId !== null && (typeof groupId !== 'string' || groupId.length > 80)) throw new Error('El grupo indicado es inválido.');
    return service.assignTabGroup(readTabId(input), groupId);
  });
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
  handle('integrated-browser:history-import', (event, ...args) => {
    if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame) throw new Error('La importación sólo se permite desde la ventana principal.');
    if (args.length) throw new Error('La importación no acepta rutas ni opciones desde el renderer.');
    return service.importHistory();
  }, (historyTransfer) => ({ historyTransfer }));
  handle('integrated-browser:profile-get', (event, ...args) => {
    if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame) throw new Error('El perfil sólo se gestiona desde la ventana principal.');
    if (args.length) throw new Error('La consulta de perfil no acepta argumentos.');
    return service.getProfile();
  }, (profile) => ({ profile }));
  handle('integrated-browser:profile-set', (event, input) => {
    if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame) throw new Error('El perfil sólo se gestiona desde la ventana principal.');
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'kind')) throw new Error('El perfil indicado es inválido.');
    const kind = (input as { kind?: unknown }).kind;
    if (kind !== 'authenticated' && kind !== 'guest' && kind !== 'private') throw new Error('El perfil indicado es inválido.');
    return service.setProfileKind(kind);
  }, (profile) => ({ profile }));
  handle('integrated-browser:history-retention-get', () => service.getHistoryRetention(), (historyRetention) => ({ historyRetention }));
  handle('integrated-browser:history-retention-set', (_event, input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('La retención del historial es inválida.');
    const days = (input as { days?: unknown }).days;
    if (days !== null && (typeof days !== 'number' || ![30, 90, 180, 365].includes(days))) throw new Error('La retención del historial es inválida.');
    return service.setHistoryRetention(days);
  }, (historyRetention) => ({ historyRetention }));
  handle('integrated-browser:bookmarks-list', (_event, input) => service.listBookmarks(readBookmarkQuery(input)), (bookmarks) => ({ bookmarks }));
  handle('integrated-browser:bookmarks-save', (_event, input) => service.saveBookmark(readBookmarkInput(input)), (bookmark) => ({ bookmark }));
  handle('integrated-browser:bookmarks-remove', (_event, input) => service.removeBookmark(readId(input, 'marcador')), (removed) => ({ removed }));
  handle('integrated-browser:bookmarks-migrate', (_event, input) => {
    if (!input || typeof input !== 'object') throw new Error('La migración de marcadores es inválida.');
    return service.migrateLegacyBookmarks((input as { entries?: unknown }).entries);
  }, (migration) => ({ migration }));
  handle('integrated-browser:bookmarks-import-html', (event, ...args) => {
    if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame) throw new Error('La importación sólo se permite desde la ventana principal.');
    if (args.length) throw new Error('La importación no acepta rutas ni opciones desde el renderer.');
    return service.importBookmarksHtml();
  }, (bookmarkTransfer) => ({ bookmarkTransfer }));
  handle('integrated-browser:bookmarks-export-html', () => service.exportBookmarksHtml(), (bookmarkTransfer) => ({ bookmarkTransfer }));
  handle('integrated-browser:bookmarks-recover', (event, ...args) => {
    if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame) throw new Error('La recuperación sólo se permite desde la ventana principal.');
    if (args.length) throw new Error('La recuperación no acepta rutas ni opciones desde el renderer.');
    return service.recoverBookmarks();
  }, (bookmarkRecovery) => ({ bookmarkRecovery }));
  handle('integrated-browser:agent-policy-get', (_event, input) => service.getAgentPolicy(readOptionalOrigin(input)), (agentPolicy) => ({ agentPolicy }));
  handle('integrated-browser:agent-policy-set', (_event, input) => service.setAgentPolicy(readAgentPolicyInput(input)), (agentPolicy) => ({ agentPolicy }));
  handle('integrated-browser:agent-policy-decide', (_event, input) => {
    const value = readAgentPolicyDecision(input);
    return service.resolveAgentPolicyPrompt(value.id, value.decision);
  }, (resolved) => ({ resolved }));
  handle('integrated-browser:privacy-site-get', (_event, input) => service.getPrivacySite(readOptionalOrigin(input)), (privacySite) => ({ privacySite }));
  handle('integrated-browser:privacy-site-set', (_event, input) => service.setPrivacySite(readPrivacySiteInput(input)), (privacySite) => ({ privacySite }));
  handle('integrated-browser:history-clear', () => service.clearHistory(), (cleared) => ({ cleared }));
  // Borrado de datos de navegacion. La confirmacion la da el usuario en el
  // dialogo del renderer; main valida el payload y actua solo sobre el perfil
  // activo.
  handle('integrated-browser:clear-browsing-data', (_event, input) => service.clearBrowsingData(input), (summary) => ({ summary }));
  const credentialHandler = (
    channel: string, operation: (...args: unknown[]) => unknown | Promise<unknown>,
    serialize: (value: unknown) => Record<string, unknown>,
  ) => handle(channel, async (event, ...args) => {
    if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame) throw new Error('Las contraseñas sólo se gestionan desde la ventana principal.');
    const parent = getMainWindow(); let changed = false;
    const unsubscribe = onAuthStateChange(() => { changed = true; service.lockCredentials(); });
    try {
      const result = await operation(...args);
      if (changed || parent !== getMainWindow() || !parent || parent.isDestroyed() || event.senderFrame !== parent.webContents.mainFrame) {
        service.lockCredentials(); throw new BrowserCredentialError('La sesión cambió durante la operación.');
      }
      return result;
    }
    catch (error) {
      if (error instanceof BrowserCredentialError) throw error;
      // eslint-disable-next-line preserve-caught-error -- La causa puede contener secretos o rutas; no debe cruzar IPC ni llegar al log exterior.
      throw new Error('No se pudo completar la operación de contraseñas. Revisa el sitio y vuelve a intentarlo.');
    }
    finally { unsubscribe(); }
  }, serialize);
  credentialHandler('integrated-browser:credentials-list', (...args) => {
    if (args.length) throw new Error('El listado de contraseñas no acepta argumentos.');
    return service.listCredentials();
  }, (library) => library as Record<string, unknown>);
  credentialHandler('integrated-browser:credentials-health', (...args) => {
    if (args.length) throw new Error('El análisis de contraseñas no acepta argumentos.');
    return service.analyzeCredentialHealth();
  }, (credentialHealth) => ({ credentialHealth }));
  credentialHandler('integrated-browser:credentials-autosave-set', (...args) => {
    const input = args[0];
    if (args.length !== 1 || !input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).length !== 1 || !('enabled' in input) || typeof input.enabled !== 'boolean') {
      throw new BrowserCredentialError('La preferencia de guardado no es válida.');
    }
    return service.setCredentialAutosave(input.enabled);
  }, (result) => result as Record<string, unknown>);
  credentialHandler('integrated-browser:credentials-import', (...args) => {
    if (args.length) throw new Error('La importación no acepta argumentos.');
    return service.importCredentials();
  }, (transfer) => transfer as Record<string, unknown>);
  credentialHandler('integrated-browser:credentials-export', (...args) => {
    if (args.length) throw new Error('La exportación no acepta argumentos.');
    return service.exportCredentials();
  }, (transfer) => transfer as Record<string, unknown>);
  credentialHandler('integrated-browser:credentials-recover', (...args) => {
    if (args.length) throw new BrowserCredentialError('La recuperación no acepta rutas ni opciones.');
    return service.recoverCredentials();
  }, (credentialRecovery) => ({ credentialRecovery }));
  credentialHandler('integrated-browser:credentials-save', (...args) => {
    if (args.length !== 1) throw new Error('El guardado requiere una credencial.');
    return service.saveCredential(readCredentialInput(args[0]));
  }, (result) => result as Record<string, unknown>);
  credentialHandler('integrated-browser:credentials-fill', (...args) => {
    if (args.length !== 1) throw new Error('Selecciona una credencial.');
    return service.fillCredential(readCredentialId(args[0]));
  }, (credential) => ({ credential }));
  credentialHandler('integrated-browser:credentials-remove', (...args) => {
    if (args.length !== 1) throw new Error('Selecciona una credencial.');
    return service.removeCredential(readCredentialId(args[0]));
  }, (removed) => ({ removed }));
  handle('integrated-browser:extensions-list', () => service.listExtensions(), (extensions) => ({ extensions }));
  handle('integrated-browser:extensions-catalog', async (event, ...args) => {
    const parent = getMainWindow(); let changed = false;
    const off = onAuthStateChange(() => { changed = true; });
    const guard = () => {
      if (changed || !getAuthState().authenticated || !parent || parent.isDestroyed() || getMainWindow() !== parent
        || !event.senderFrame || event.senderFrame !== parent.webContents.mainFrame) throw new Error('Emisor inválido.');
    };
    try {
      guard(); if (args.length !== 1) throw new Error();
      const result = await service.extensionCatalog(validateExtensionCatalogRequest(args[0]), guard);
      guard(); return result;
    } catch { throw new Error('No se pudo revisar el catálogo. Comprueba sesión, carpeta y revisión oficial; para actualizar, deshabilita la extensión y deja sólo una pestaña en about:blank.'); }
    finally { off(); }
  }, result => result as Record<string, unknown>);
  handle('integrated-browser:extensions-restrict-sites', async (event, ...args) => {
    const parent = getMainWindow(); let changed = false;
    const off = onAuthStateChange(() => { changed = true; });
    const guard = () => {
      if (changed || !getAuthState().authenticated || !parent || parent.isDestroyed() || getMainWindow() !== parent
        || !event.senderFrame || event.senderFrame !== parent.webContents.mainFrame) throw new Error('Emisor inválido.');
    };
    try {
      guard(); const input = args[0];
      if (args.length !== 1 || !input || typeof input !== 'object' || Array.isArray(input)
          || Object.keys(input).sort().join(',') !== 'installId,sites' || !Array.isArray((input as { sites: unknown }).sites)) throw new Error('Solicitud inválida.');
      const sites = (input as { sites: unknown[] }).sites;
      if (sites.length > 50 || sites.some(site => typeof site !== 'string' || site.length > 300)) throw new Error('Sitios inválidos.');
      const result = await service.restrictExtensionSites(readId(input, 'extension', 'installId'), (input as { sites: string[] }).sites, guard);
      guard(); return result;
    } catch {
      throw new Error('No se pudieron restringir los sitios. Deshabilita la extensión y deja sólo una pestaña en about:blank. Revisa perfil y sitios, compatibilidad storage/scripting e integridad de la carpeta; puede requerir reinstalación revisada.');
    } finally { off(); }
  }, extension => ({ extension }));
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
  handle('integrated-browser:tab-summaries', (event, ...args) => {
    if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame || args.length) throw new Error('La selección sólo se permite desde la ventana principal, sin argumentos.');
    const summaries = service.getTabSummaries();
    return { summaries, state: service.getState() };
  }, (result) => result as Record<string, unknown>);
  handle('integrated-browser:get-tab-content', async (event, ...args) => {
    if (!event.senderFrame || event.senderFrame !== getMainWindow()?.webContents.mainFrame || args.length !== 1) throw new Error('La lectura sólo se permite desde la ventana principal.');
    const input = args[0];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !['tabId', 'expected'].includes(key))) throw new Error('La selección de pestaña es inválida.');
    const tabId = readTabId(input);
    const expected = readTabExpectation(input);
    const content = await service.getTabContent(tabId, expected);
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

function readPageFindInput(input: unknown): { query: string; forward: boolean } {
  if (!input || typeof input !== 'object') throw new Error('La búsqueda en página es inválida.');
  const value = input as { query?: unknown; forward?: unknown };
  if (typeof value.query !== 'string' || value.query.length > 500) throw new Error('El texto de búsqueda es inválido.');
  if (value.forward !== undefined && typeof value.forward !== 'boolean') throw new Error('La dirección de búsqueda es inválida.');
  return { query: value.query, forward: value.forward !== false };
}

function readZoomAction(input: unknown): 'in' | 'out' | 'reset' {
  if (!input || typeof input !== 'object') throw new Error('La acción de zoom es inválida.');
  const action = (input as { action?: unknown }).action;
  if (action !== 'in' && action !== 'out' && action !== 'reset') throw new Error('La acción de zoom es inválida.');
  return action;
}

function readMuted(input: unknown): boolean {
  if (!input || typeof input !== 'object' || typeof (input as { muted?: unknown }).muted !== 'boolean') {
    throw new Error('El estado de audio es inválido.');
  }
  return (input as { muted: boolean }).muted;
}

function readDownloadId(input: unknown): string {
  if (!input || typeof input !== 'object') throw new Error('El identificador de descarga es inválido.');
  const id = (input as { id?: unknown }).id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('El identificador de descarga es inválido.');
  return id;
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

function readTabExpectation(input: unknown): import('../src/shared/browser-tab-context').BrowserTabExpectation | undefined {
  const expected = (input as { expected?: unknown }).expected;
  if (expected === undefined) return undefined;
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) throw new Error('La selección de pestaña es inválida.');
  const value = expected as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['profileRevision', 'documentToken'].includes(key))
    || !Number.isSafeInteger(value.profileRevision) || (value.profileRevision as number) < 0
    || typeof value.documentToken !== 'string' || !/^[0-9a-f-]{36}$/.test(value.documentToken)) {
    throw new Error('La selección de pestaña es inválida.');
  }
  return { profileRevision: value.profileRevision as number, documentToken: value.documentToken };
}

function readTabId(input: unknown): string {
  if (!input || typeof input !== 'object') throw new Error('El identificador de pestaña es inválido.');
  const tabId = (input as { tabId?: unknown }).tabId;
  if (typeof tabId !== 'string' || !tabId.trim() || tabId.length > 80) throw new Error('El identificador de pestaña es inválido.');
  return tabId;
}

function readTabLayout(input: unknown): 'horizontal' | 'vertical' {
  if (!input || typeof input !== 'object') throw new Error('La disposición de pestañas es inválida.');
  const layout = (input as { layout?: unknown }).layout;
  if (layout !== 'horizontal' && layout !== 'vertical') throw new Error('La disposición de pestañas es inválida.');
  return layout;
}

function readTabGroup(input: unknown): { name: string; color: BrowserTabGroupColor } {
  if (!input || typeof input !== 'object') throw new Error('El grupo de pestañas es inválido.');
  const value = input as { name?: unknown; color?: unknown };
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80
    || !BROWSER_TAB_GROUP_COLORS.includes(value.color as BrowserTabGroupColor)) throw new Error('El grupo de pestañas es inválido.');
  return { name: value.name, color: value.color as BrowserTabGroupColor };
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

function readHistoryQuery(input: unknown): { query?: string; limit?: number; offset?: number; from?: string; to?: string; domain?: string } {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object') throw new Error('La consulta de historial es invalida.');
  const value = input as { query?: unknown; limit?: unknown; offset?: unknown; from?: unknown; to?: unknown; domain?: unknown };
  if (value.query !== undefined && (typeof value.query !== 'string' || value.query.length > 200)) {
    throw new Error('El texto de historial es invalido.');
  }
  if (value.limit !== undefined && (typeof value.limit !== 'number' || !Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 200)) {
    throw new Error('El limite de historial es invalido.');
  }
  if (value.offset !== undefined && (typeof value.offset !== 'number' || !Number.isSafeInteger(value.offset) || value.offset < 0 || value.offset > 50_000)) throw new Error('La página del historial es inválida.');
  for (const [label, date] of [['inicio', value.from], ['fin', value.to]] as const) {
    if (date !== undefined && (typeof date !== 'string' || Number.isNaN(Date.parse(date)))) throw new Error(`La fecha de ${label} es inválida.`);
  }
  if (value.domain !== undefined && (typeof value.domain !== 'string' || value.domain.length > 253)) throw new Error('El dominio del historial es inválido.');
  return { query: value.query, limit: value.limit, offset: value.offset, from: value.from as string | undefined, to: value.to as string | undefined, domain: value.domain };
}

function readBookmarkQuery(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'object') throw new Error('La búsqueda de marcadores es inválida.');
  const query = (input as { query?: unknown }).query;
  if (query === undefined) return undefined;
  if (typeof query !== 'string' || query.length > 200) throw new Error('La búsqueda de marcadores es inválida.');
  return query;
}

function readBookmarkInput(input: unknown): { id?: string; url: string; title: string; folderId?: string | null; tags?: string[]; position?: number } {
  if (!input || typeof input !== 'object') throw new Error('El marcador es inválido.');
  const value = input as { id?: unknown; url?: unknown; title?: unknown; folderId?: unknown; tags?: unknown; position?: unknown };
  if ((value.id !== undefined && typeof value.id !== 'string') || typeof value.url !== 'string' || value.url.length > 2_048
    || typeof value.title !== 'string' || value.title.length > 200
    || (value.folderId !== undefined && value.folderId !== null && typeof value.folderId !== 'string')
    || (value.tags !== undefined && (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === 'string')))) throw new Error('El marcador es inválido.');
  if (value.position !== undefined && (typeof value.position !== 'number' || !Number.isSafeInteger(value.position) || value.position < 0 || value.position >= 5_000)) throw new Error('El orden del marcador es inválido.');
  return { id: value.id as string | undefined, url: value.url, title: value.title, folderId: value.folderId as string | null | undefined, tags: value.tags as string[] | undefined, ...(value.position === undefined ? {} : { position: value.position as number }) };
}

function readOptionalOrigin(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'object') throw new Error('El origen es inválido.');
  const origin = (input as { origin?: unknown }).origin;
  if (origin === undefined) return undefined;
  if (typeof origin !== 'string' || origin.length > 2_048) throw new Error('El origen es inválido.');
  return origin;
}

function readAgentPolicyInput(input: unknown): { origin?: string; mode: 'strict' | 'balanced'; decision: 'ask' | 'allow-always' | 'block' } {
  if (!input || typeof input !== 'object') throw new Error('La política del agente es inválida.');
  const value = input as { origin?: unknown; mode?: unknown; decision?: unknown };
  if (value.origin !== undefined && (typeof value.origin !== 'string' || value.origin.length > 2_048)) throw new Error('El origen del agente es inválido.');
  if (value.mode !== 'strict' && value.mode !== 'balanced') throw new Error('El modo del agente es inválido.');
  if (value.decision !== 'ask' && value.decision !== 'allow-always' && value.decision !== 'block') throw new Error('La decisión del agente es inválida.');
  return { origin: value.origin, mode: value.mode, decision: value.decision };
}

function readAgentPolicyDecision(input: unknown): { id: string; decision: 'allow-once' | 'allow-always' | 'block' } {
  if (!input || typeof input !== 'object') throw new Error('La decisión del agente es inválida.');
  const value = input as { id?: unknown; decision?: unknown };
  if (typeof value.id !== 'string' || !value.id || value.id.length > 100) throw new Error('La solicitud del agente es inválida.');
  if (value.decision !== 'allow-once' && value.decision !== 'allow-always' && value.decision !== 'block') throw new Error('La decisión del agente es inválida.');
  return { id: value.id, decision: value.decision };
}

function readPrivacySiteInput(input: unknown): { origin?: string; level: 'off' | 'balanced' | 'strict'; exceptionCategories: Array<'tracker' | 'advertising' | 'third-party-cookie' | 'tracking-parameter' | 'fingerprinting'> } {
  if (!input || typeof input !== 'object') throw new Error('La configuración de privacidad es inválida.');
  const value = input as { origin?: unknown; level?: unknown; exceptionCategories?: unknown };
  const categories = ['tracker', 'advertising', 'third-party-cookie', 'tracking-parameter', 'fingerprinting'] as const;
  if (value.origin !== undefined && (typeof value.origin !== 'string' || value.origin.length > 2_048)) throw new Error('El origen de privacidad es inválido.');
  if (value.level !== 'off' && value.level !== 'balanced' && value.level !== 'strict') throw new Error('El nivel de privacidad es inválido.');
  if (!Array.isArray(value.exceptionCategories) || value.exceptionCategories.some((category) => !categories.includes(category as typeof categories[number]))) throw new Error('Las excepciones de privacidad son inválidas.');
  return { origin: value.origin, level: value.level, exceptionCategories: value.exceptionCategories as Array<typeof categories[number]> };
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

function readCredentialInput(input: unknown): { id?: string; username: string; password: string; expectedOrigin: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('La credencial es inválida.');
  if (Object.keys(input).some((key) => !['id', 'username', 'password', 'expectedOrigin'].includes(key))) throw new Error('La credencial contiene campos no permitidos.');
  const value = input as { id?: unknown; username?: unknown; password?: unknown; expectedOrigin?: unknown };
  const id = value.id === undefined ? undefined : readCredentialId({ id: value.id });
  if (typeof value.username !== 'string' || !value.username.trim() || value.username.length > 320
    || typeof value.password !== 'string' || !value.password || value.password.length > 4096
    || typeof value.expectedOrigin !== 'string' || !value.expectedOrigin || value.expectedOrigin.length > 2048) throw new Error('La credencial es inválida.');
  return { id, username: value.username, password: value.password, expectedOrigin: value.expectedOrigin };
}

function readCredentialId(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'id')) throw new Error('La credencial es inválida.');
  const id = (input as { id?: unknown }).id;
  if (typeof id !== 'string' || !/^[a-f\d-]{16,64}$/i.test(id)) throw new Error('El identificador de credencial es inválido.');
  return id;
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
