import { expect, it, vi } from 'vitest';
import { exposeIntegratedBrowserApi } from '../../preload/integrated-browser-api';
import { exposeUtilityApis } from '../../preload/utility-apis';
import type { SafeIpc } from '../../preload/types';
import { CSP_CONTENT, preloadSource } from './helpers';

export function registerPreloadSourceTests() {
  it('recuperación de políticas sólo transporta categoría y recibo', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { recoverPolicyStore: (input: unknown) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    const input = { store: 'privacy', profileRevision: 3 }; await api.recoverPolicyStore(input);
    expect(safeInvoke).toHaveBeenCalledWith('integrated-browser:policy-recover', input);
    expect(api).not.toHaveProperty('commitPolicyRecovery');
  });
  it('catálogo usa únicamente el canal allowlisted de revisión', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { extensionCatalog: (request: unknown) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    const request = { action: 'prepare', catalogId: 'chrome-reading-time' };
    await api.extensionCatalog(request);
    expect(safeInvoke).toHaveBeenCalledWith('integrated-browser:extensions-catalog', request);
    expect(api).not.toHaveProperty('downloadExtension'); expect(api).not.toHaveProperty('trustPublisher');
  });
  it('transporta voz y memoria sólo por sus operaciones cerradas', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    const exposed: Record<string, Record<string, (...args: unknown[]) => unknown>> = {};
    const bridge = { exposeInMainWorld: (name: string, value: unknown) => { exposed[name] = value as typeof exposed[string]; } };
    const ipc = { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc;
    exposeUtilityApis(bridge, ipc); exposeIntegratedBrowserApi(bridge, ipc);
    await exposed.orb.browserCommand('pause');
    expect(safeInvoke).toHaveBeenLastCalledWith('orb:browser-command', 'pause');
    const browser = Object.values(exposed).find(api => api.semanticMemoryCommand)!;
    await browser.semanticMemoryCommand({ action: 'status', profileRevision: 2 });
    expect(safeInvoke).toHaveBeenLastCalledWith('integrated-browser:semantic-memory', { action: 'status', profileRevision: 2 });
    await browser.credentialSessionCommand({ action: 'unlock', profileRevision: 2 });
    expect(safeInvoke).toHaveBeenLastCalledWith('integrated-browser:credential-session', { action: 'unlock', profileRevision: 2 });
    expect(browser).not.toHaveProperty('configureSemanticMemoryKey'); expect(exposed.orb).not.toHaveProperty('execute');
  });
  it('restricción de extensiones usa sólo id y sitios en el canal autorizado', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { restrictExtensionSites: (id: string, sites: string[]) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    await api.restrictExtensionSites('extension-id', ['https://example.com']);
    expect(safeInvoke).toHaveBeenCalledWith('integrated-browser:extensions-restrict-sites', { installId: 'extension-id', sites: ['https://example.com'] });
  });
  it('transporta supervisión por el canal autorizado', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { controlAgentTask: (input: unknown) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    const request = { action: 'stop', taskId: 'browser-cu-id', taskRevision: 1, profileRevision: 2 };
    await api.controlAgentTask(request);
    expect(safeInvoke).toHaveBeenCalledWith('integrated-browser:agent-control', request);
  });
  it('atajos expone una operación cerrada, sin ejecución automática', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { agentShortcuts: (input: unknown) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    await api.agentShortcuts({ action: 'list', profileRevision: 2 });
    expect(safeInvoke).toHaveBeenCalledWith('integrated-browser:agent-shortcuts', { action: 'list', profileRevision: 2 });
    expect(api).not.toHaveProperty('executeShortcut');
  });
  it('transporta el recibo del documento por la lectura allowlisted y conserva llamadas legacy', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { getTabContent: (tabId: string, expected?: { profileRevision: number; documentToken: string }) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    const expected = { profileRevision: 2, documentToken: 'a'.repeat(36) };
    await api.getTabContent('tab', expected); await api.getTabContent('tab');
    expect(safeInvoke.mock.calls).toEqual([['integrated-browser:get-tab-content', { tabId: 'tab', expected }], ['integrated-browser:get-tab-content', { tabId: 'tab' }]]);
  });
  it('sync expone dispositivos y control cerrado, no tokens, claves, SQL ni escritura de envelopes', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { getSyncDevices: () => Promise<unknown>; registerSyncDevice: () => Promise<unknown>; revokeSyncDevice: (id: string) => Promise<unknown>; cancelSyncOperation: () => Promise<unknown>; controlSync: (input: { action: 'export-key' }) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    await api.getSyncDevices(); await api.registerSyncDevice(); await api.revokeSyncDevice('id-opaco'); await api.cancelSyncOperation();
    expect(safeInvoke.mock.calls).toEqual([['integrated-browser:sync-devices-get'], ['integrated-browser:sync-devices-register'], ['integrated-browser:sync-devices-revoke', { id: 'id-opaco' }], ['integrated-browser:sync-devices-cancel']]);
    await api.controlSync({ action: 'export-key' });
    expect(safeInvoke).toHaveBeenLastCalledWith('integrated-browser:sync-control', { action: 'export-key' });
    for (const key of ['getAccessToken', 'getSyncKey', 'putEnvelope', 'executeSql', 'approveSyncDevice']) expect(api).not.toHaveProperty(key);
  });
  it('sólo expone la preferencia de sugerencias, no el puente privado ni la aprobación', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { setCredentialAutosave: (enabled: boolean) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    await api.setCredentialAutosave(true);
    expect(safeInvoke.mock.calls).toEqual([['integrated-browser:credentials-autosave-set', { enabled: true }]]);
    expect(api).not.toHaveProperty('offerCredential');
    expect(api).not.toHaveProperty('approveCredential');
  });
  it('transporta el origen revisado al guardar sin exponer el commit ni el secreto anterior', async () => {
    const response = { success: true, canceled: true };
    const safeInvoke = vi.fn(async () => response);
    let api!: { saveCredential: (input: { username: string; password: string; expectedOrigin: string }) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    const input = { username: 'cuenta', password: 'ficticia', expectedOrigin: 'https://example.com' };
    expect(await api.saveCredential(input)).toEqual(response);
    expect(safeInvoke.mock.calls).toEqual([['integrated-browser:credentials-save', input]]);
    expect(api).not.toHaveProperty('resolveSecret');
    expect(api).not.toHaveProperty('prepareSave');
  });
  it('exporta diagnóstico por el único canal cerrado sin exponer datos ni aprobación', async () => {
    const response = { success: true, diagnosticExport: { cancelled: false, exported: true } };
    const safeInvoke = vi.fn(async () => response);
    let api!: { exportRuntimeDiagnostic: () => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    expect(await api.exportRuntimeDiagnostic()).toEqual(response);
    expect(safeInvoke.mock.calls).toEqual([['integrated-browser:runtime-diagnostic-export']]);
    expect(api).not.toHaveProperty('buildBrowserDiagnosticReport');
    expect(api).not.toHaveProperty('approveDiagnosticExport');
  });
  it('importar marcadores usa un único canal sin exponer confirmación ni rutas', async () => {
    const response = { success: true, bookmarkTransfer: { cancelled: false, imported: 1, updated: 2, skipped: 1 } };
    const safeInvoke = vi.fn(async () => response);
    let api!: { importBookmarksHtml: () => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    expect(await api.importBookmarksHtml()).toEqual(response);
    expect(safeInvoke.mock.calls).toEqual([['integrated-browser:bookmarks-import-html']]);
    expect(api).not.toHaveProperty('commitBookmarkImport');
    expect(api).not.toHaveProperty('readBookmarkImportFile');
  });
  it('la bitácora expone sólo la petición cerrada, nunca el registro runtime', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { agentAudit: (input: unknown) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    await api.agentAudit({ action: 'list', offset: 0 });
    expect(safeInvoke).toHaveBeenCalledWith('integrated-browser:agent-audit', { action: 'list', offset: 0 });
    expect(api).not.toHaveProperty('auditAgentOperation'); expect(api).not.toHaveProperty('record');
  });

  it('recuperar marcadores no expone archivos ni confirmación al renderer', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { recoverBookmarks: () => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    await api.recoverBookmarks(); expect(safeInvoke.mock.calls).toEqual([['integrated-browser:bookmarks-recover']]);
    expect(api).not.toHaveProperty('prepareRecovery'); expect(api).not.toHaveProperty('commitRecovery');
  });
  it('recuperar contraseñas no expone secretos, archivos ni confirmación al renderer', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { recoverCredentials: () => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    await api.recoverCredentials(); expect(safeInvoke.mock.calls).toEqual([['integrated-browser:credentials-recover']]);
    expect(api).not.toHaveProperty('prepareRecovery'); expect(api).not.toHaveProperty('commitRecovery');
    expect(api).not.toHaveProperty('getSecret'); expect(api).not.toHaveProperty('readFile');
  });
  it('importar historial usa un único canal sin exponer rutas ni datos', async () => {
    const response = { success: true, historyTransfer: { cancelled: false, imported: 1, skipped: 0, duplicates: 0, invalid: 0 } };
    const safeInvoke = vi.fn(async () => response);
    let api!: { importHistory: () => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    expect(await api.importHistory()).toEqual(response);
    expect(safeInvoke.mock.calls).toEqual([['integrated-browser:history-import']]);
    expect(api).not.toHaveProperty('readHistoryImportFile');
    expect(api).not.toHaveProperty('commitHistoryImport');
  });
  it('cambiar perfil transporta sólo el tipo cerrado', async () => {
    const response = { success: true, profile: { id: 'privado-activo', kind: 'private', label: 'Ventana privada', persistent: false, managed: false } };
    const safeInvoke = vi.fn(async () => response);
    let api!: { getProfile: () => Promise<unknown>; setProfile: (kind: 'authenticated' | 'guest' | 'private') => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    expect(await api.getProfile()).toEqual(response);
    expect(await api.setProfile('private')).toEqual(response);
    expect(safeInvoke.mock.calls).toEqual([['integrated-browser:profile-get'], ['integrated-browser:profile-set', { kind: 'private' }]]);
  });
  it('la instalación espera el resultado del único canal allowlisted, sin exponer control de cierre', async () => {
    const response = { success: false, error: 'Salida cancelada' };
    const safeInvoke = vi.fn(async () => response);
    let updater!: { installUpdate: () => Promise<unknown> };
    exposeUtilityApis({ exposeInMainWorld: (name, value) => { if (name === 'updater') updater = value as typeof updater; } }, { safeInvoke } as unknown as SafeIpc);
    expect(await updater.installUpdate()).toEqual(response);
    expect(safeInvoke.mock.calls).toEqual([['updater:install-update']]);
    expect(updater).not.toHaveProperty('commitShutdown');
  });
  it('expone retención y reapertura mediante canales acotados, conservando la llamada sin argumento', async () => {
    const safeInvoke = vi.fn(async () => ({ success: true }));
    let api!: { getHistoryRetention: () => Promise<unknown>; setHistoryRetention: (days: number | null) => Promise<unknown>; listRecentlyClosedTabs: () => Promise<unknown>; reopenClosedTab: (tabId?: string) => Promise<unknown> };
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as typeof api; } }, { safeInvoke, safeOn: vi.fn() } as unknown as SafeIpc);
    await api.getHistoryRetention(); await api.setHistoryRetention(30); await api.listRecentlyClosedTabs();
    await api.reopenClosedTab('cerrada'); await api.reopenClosedTab();
    expect(safeInvoke.mock.calls).toEqual([
      ['integrated-browser:history-retention-get'], ['integrated-browser:history-retention-set', { days: 30 }],
      ['integrated-browser:tabs-recently-closed'], ['integrated-browser:tab-reopen-closed', { tabId: 'cerrada' }],
      ['integrated-browser:tab-reopen-closed'],
    ]);
  });

  it('SEC-026: CSP policy in source blocks unsafe-eval', () => {
    expect(CSP_CONTENT).toContain("script-src 'self'");
    expect(CSP_CONTENT).not.toContain('unsafe-eval');
  });

  it('SEC-027: CSP allows WebSocket connections', () => {
    expect(preloadSource).toContain('ws:');
    expect(preloadSource).toContain('wss:');
  });

  it('SEC-028: contextIsolation check present in source', () => {
    expect(preloadSource).toContain('process.contextIsolated');
    expect(preloadSource).toContain('contextIsolation no esta habilitado');
  });

  it('SEC-029: contextBridge.exposeInMainWorld called in source', () => {
    const exposeCount = (preloadSource.match(/(?:contextBridge|bridge)\.exposeInMainWorld/g) || []).length;
    expect(exposeCount).toBeGreaterThanOrEqual(3);
  });
}
