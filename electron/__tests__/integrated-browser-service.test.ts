import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BrowserCuSupervisor } from '../desktop-agent/browser-cu-supervisor';
import { setAuthState } from '../main/auth-state';
import { BrowserCredentialUnlock } from '../integrated-browser/credential-unlock';
import { app, BaseWindow, BrowserWindow, WebContentsView, dialog, session, systemPreferences } from 'electron';
import { IntegratedBrowserService, type BrowserCredentialVault } from '../integrated-browser';
import { BrowserSitePermissionStore } from '../integrated-browser/site-permissions';
import { BrowserAgentPolicyStore } from '../integrated-browser/agent-policy-store';
import { BrowserPrivacyStore } from '../integrated-browser/privacy-store';
import { BrowserSemanticMemory } from '../integrated-browser/semantic-memory';
import { BrowserEnterprisePolicyStore } from '../integrated-browser/enterprise-policy-store';
import { BrowserSessionStore } from '../integrated-browser/session-store';
import { BrowserBookmarkStore } from '../integrated-browser/bookmark-store';
import { BrowserSyncDevices, type BrowserSyncDeviceContext } from '../integrated-browser/sync-devices';
import { BrowserSyncDeviceIdentity } from '../integrated-browser/sync-device-identity';
import type { BrowserSyncControlContext } from '../integrated-browser/sync-controller';
import type { BrowserSyncRemote } from '../integrated-browser/sync-remote';
import * as navigationSafety from '../integrated-browser/safe-navigation';
import * as pageObservation from '../integrated-browser/page-observation';
import { inspectBrowserSensitivePage } from '../integrated-browser/sensitive-page';
vi.mock('../integrated-browser/sensitive-page', () => ({ inspectBrowserSensitivePage: vi.fn(async () => null) }));
import type { BrowserEnterprisePolicy, BrowserSessionSnapshot } from '../integrated-browser/platform-types';
import {
  configureChromiumUserAgentFallback,
  toStandardChromiumUserAgent,
} from '../integrated-browser/user-agent';
import {
  browserPartitionFor,
  browserProfileRoot,
  browserPrivateScopeId,
  browserScopeIdFor,
  setBrowserScopeId,
  resetBrowserScopeForTests,
} from '../integrated-browser/profile-scope';

// El servicio materializa su primera vista con el gestor de extensiones real,
// que lee su registro en disco de forma asincrona. Esta suite no ejercita
// extensiones y esa lectura emitia avisos despues del teardown del worker.
// El historial escribe y lee en disco de forma asincrona al terminar cada
// carga. Esta suite no lo ejercita y esas lecturas emitian avisos despues del
// teardown del worker.
vi.mock('../integrated-browser/browser-history-store', () => ({
  BrowserHistoryStore: class {
    record = vi.fn(async () => null);
    list = vi.fn(async () => []);
    clear = vi.fn(async () => {});
    flushAndClose = vi.fn(async () => {});
    pruneOlderThan = vi.fn(async () => 0);
    setManagedRetention = vi.fn(async () => {});
    getRetention = vi.fn(async () => null);
    setRetention = vi.fn(async (days: number | null) => ({ days, removed: 0 }));
    clearSince = vi.fn(async () => 0);
    prepareRecovery = vi.fn(async (guard: () => void) => ({ count: 1, commit: async () => { guard(); } }));
    flush = vi.fn(async () => {});
  },
}));

vi.mock('../integrated-browser/extension-manager', () => ({
  BrowserExtensionManager: class {
    resetForProfileChange = vi.fn();
    restore = vi.fn(async () => []);
    list = vi.fn(async () => []);
    prepareFromDialog = vi.fn(async () => ({ canceled: true }));
    confirmInstall = vi.fn(async () => { throw new Error('Extensiones no disponibles en pruebas.'); });
    setEnabled = vi.fn(async () => { throw new Error('Extensiones no disponibles en pruebas.'); });
    remove = vi.fn(async () => false);
    restrictSites = vi.fn(async (id: string, sites: string[], guard: () => void) => { guard(); return { installId: id, siteAccess: sites }; });
    flush = vi.fn(async () => {});
  },
}));

type MockIntegratedBrowserView = {
  options?: { webPreferences?: Record<string, unknown> };
  setBounds: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
    webContents: {
      focus: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      emit: (event: string, ...args: unknown[]) => boolean;
      capturePage: ReturnType<typeof vi.fn>;
      executeJavaScript: ReturnType<typeof vi.fn>;
      sendInputEvent: ReturnType<typeof vi.fn>;
      insertText: ReturnType<typeof vi.fn>;
      getURL: ReturnType<typeof vi.fn<() => string>>;
      getZoomFactor: ReturnType<typeof vi.fn<() => number>>;
      setZoomMode: ReturnType<typeof vi.fn>;
      setZoomFactor: ReturnType<typeof vi.fn<(factor: number) => void>>;
      getUserAgent: ReturnType<typeof vi.fn>;
      setUserAgent: ReturnType<typeof vi.fn>;
      loadURL: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
      session: {
        getUserAgent: ReturnType<typeof vi.fn>;
      setUserAgent: ReturnType<typeof vi.fn>;
      setPermissionCheckHandler: ReturnType<typeof vi.fn>;
      setPermissionRequestHandler: ReturnType<typeof vi.fn>;
      setCertificateVerifyProc: ReturnType<typeof vi.fn>;
      };
  };
};

const browserViewHarness = WebContentsView as unknown as {
  instances: MockIntegratedBrowserView[];
};

const browserWindowHarness = BrowserWindow as unknown as {
  instances: BrowserWindow[];
};

const detachedWindowHarness = BaseWindow as unknown as {
  instances: Array<BrowserWindow & { emit: (event: string, ...args: unknown[]) => boolean }>;
};

// La concesion de `media` encadena el almacen en disco, el dialogo HITL y la
// consulta al sistema operativo: la respuesta al renderer llega varios ciclos
// despues, incluidos los de entrada/salida.
const flushPermissionQueue = async () => {
  for (let index = 0; index < 6; index += 1) await new Promise((resolve) => setImmediate(resolve));
};

/**
 * Cada prueba usa su propio archivo de permisos: el almacen es persistente y
 * una decision guardada en una prueba cambiaria el resultado de la siguiente.
 */
const permissionStorePaths: string[] = [];
const sessionFixtures: Array<{ root: string; store: BrowserSessionStore; service: IntegratedBrowserService }> = [];

function savedSession(count = 12): BrowserSessionSnapshot {
  return {
    version: 2, savedAt: '2026-09-04T12:00:00.000Z', cleanExit: false,
    activeTabId: 'saved-1', primaryTabId: 'saved-0', secondaryTabId: 'saved-1', detachedTabIds: ['saved-2'],
    viewMode: 'split', tabLayout: 'vertical',
    groups: [{ id: 'grupo', name: 'Trabajo', color: 'blue', collapsed: false }],
    tabs: Array.from({ length: count }, (_, index) => ({
      id: `saved-${index}`, url: `https://restaurada.example/${index}`, title: `Página ${index}`,
      pinned: index === 0, muted: index === 1, groupId: 'grupo', position: index,
    })),
  };
}

async function sessionFixture(saved: BrowserSessionSnapshot | null = savedSession()) {
  vi.stubEnv('BROWSER_SESSION_RESTORE_ENABLED', 'true');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-session-lifecycle-'));
  const store = new BrowserSessionStore(path.join(root, 'session.json'));
  if (saved) await store.save(saved);
  // La restauración persistente se prueba en una cuenta, no en el invitado.
  setBrowserScopeId(browserScopeIdFor(root));
  const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, store);
  const fixture = { root, store, service };
  sessionFixtures.push(fixture);
  return fixture;
}

function newStore(): BrowserSitePermissionStore {
  const filePath = path.join(os.tmpdir(), `soflia-site-permissions-${randomUUID()}.json`);
  permissionStorePaths.push(filePath);
  return new BrowserSitePermissionStore(filePath);
}

function newService(store: BrowserSitePermissionStore = newStore()): IntegratedBrowserService {
  return new IntegratedBrowserService(undefined, undefined, undefined, undefined, store);
}

async function enterpriseFixture(overrides: Partial<BrowserEnterprisePolicy> = {}) {
  vi.stubEnv('BROWSER_ENTERPRISE_CONTROLS_ENABLED', 'true');
  vi.stubEnv('BROWSER_PRIVACY_PROTECTION_ENABLED', 'false');
  vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'false');
  const fixture = await sessionFixture(null);
  // Esta fixture verifica precedencia, no restauración de sesión. Desactivar
  // el store antes de construir el servicio evita una lectura de fondo que
  // dejaría una promesa pendiente al terminar la prueba.
  vi.stubEnv('BROWSER_SESSION_RESTORE_ENABLED', 'false');
  const policies = new BrowserEnterprisePolicyStore(path.join(fixture.root, 'empresa.json'));
  const privacy = new BrowserPrivacyStore(path.join(fixture.root, 'privacidad.json'));
  const agents = new BrowserAgentPolicyStore(path.join(fixture.root, 'agente.json'));
  await policies.apply({ version: 1, blockedOrigins: ['https://blocked.example'], forcedPrivacyLevel: 'strict', extensionsAllowed: false, agentAllowed: false, historyRetentionDays: 30, ...overrides }, 'revision-1');
  fixture.service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, fixture.store, undefined, agents, privacy, policies);
  return { ...fixture, policies, privacy, agents };
}

function networkHooks(contents: MockIntegratedBrowserView['webContents']) {
  type Listener = (details: Record<string, unknown>, callback: (response: Record<string, unknown>) => void) => void;
  const requests = (contents.session as unknown as { webRequest: Record<string, ReturnType<typeof vi.fn>> }).webRequest;
  const hook = (name: string) => {
    const calls = requests[name].mock.calls;
    return calls[calls.length - 1][1] as Listener;
  };
  return { before: hook('onBeforeRequest'), send: hook('onBeforeSendHeaders'), received: hook('onHeadersReceived'), requests };
}

/**
 * Cuenta solo las lecturas del DOM. El servicio tambien inyecta piezas propias
 * —vigia de seleccion, menu flotante, panel de redaccion— y contar guiones a
 * secas confundia instalar la interfaz con leer la pagina del usuario.
 */
function domExtractions(contents: { executeJavaScript: { mock: { calls: unknown[][] } } }): number {
  return contents.executeJavaScript.mock.calls
    .filter((call) => String(call[0]).includes('const LIMITS = { text:'))
    .length;
}

type PermissionPromptPayload = { id: string; origin: string; kinds: string[]; labels: string[] };

/**
 * El aviso de permiso lo pinta el renderer, asi que en pruebas se responde
 * interceptando el envio a la ventana anfitriona. `onPrompt` permite observar
 * cuantos avisos coexisten.
 */
function answerPermissionPrompts(
  window: BrowserWindow,
  service: IntegratedBrowserService,
  granted: boolean,
  onPrompt?: (request: PermissionPromptPayload) => Promise<void> | void,
): PermissionPromptPayload[] {
  const seen: PermissionPromptPayload[] = [];
  const send = window.webContents.send as unknown as ReturnType<typeof vi.fn>;
  send.mockImplementation((channel: string, payload: unknown) => {
    if (channel !== 'integrated-browser:permission-prompt') return;
    const request = payload as PermissionPromptPayload;
    seen.push(request);
    void (async () => {
      await onPrompt?.(request);
      service.resolvePermissionPrompt(request.id, granted);
    })();
  });
  return seen;
}

// `process.platform` decide si se consulta el permiso nativo. Fijarlo mantiene
// la prueba estable en cualquier runner.
const withPlatform = (platform: NodeJS.Platform, run: () => Promise<void>) => {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { ...original, value: platform });
  return run().finally(() => Object.defineProperty(process, 'platform', original));
};

describe('IntegratedBrowserService', () => {
  it.each(['selección', 'sesión', 'agente', 'marco', 'pestaña'] as const)('passkeys vincula proveedor con perfil, documento y control humano: %s', async scenario => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'false');
    setAuthState({ authenticated: true, userId: 'passkey-fixture' });
    setBrowserScopeId(browserScopeIdFor('passkey-fixture'));
    const service = newService(); const parent = new BrowserWindow();
    vi.mocked(parent.isVisible).mockReturnValue(true);
    service.attachWindow(parent);
    try {
      await service.open('https://example.com/login');
      service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
      const contents = browserViewHarness.instances[0].webContents as unknown as Electron.WebContents;
      Object.defineProperty(contents, 'mainFrame', { value: { detached: false, executeJavaScript: vi.fn(async () => true) }, configurable: true });
      const calls = vi.mocked(contents.session.on).mock.calls as unknown as Array<[string, unknown]>;
      const select = calls.find(call => call[0] === 'select-webauthn-account')?.[1] as
        (event: unknown, details: unknown, callback: (id?: string) => void) => void;
      expect(select).toBeTypeOf('function');
      let resolve!: (response: Electron.MessageBoxReturnValue) => void;
      if (scenario !== 'marco') vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
      const callback = vi.fn();
      select({}, { frame: scenario === 'marco' ? {} : contents.mainFrame, relyingPartyId: 'example.com', accounts: [{ credentialId: 'fixture_id', name: 'Prueba' }] }, callback);
      if (scenario === 'marco') {
        await flushPermissionQueue();
        expect(callback).toHaveBeenCalledWith(undefined);
        expect(resolve).toBeUndefined(); return;
      }
      await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
      await expect(service.captureVisiblePage()).rejects.toThrow(/manualmente/);
      await expect(service.readActiveDocument()).rejects.toThrow(/manualmente/);
      if (scenario === 'sesión') {
        setAuthState({ authenticated: false, userId: null });
        setAuthState({ authenticated: true, userId: 'passkey-fixture' });
      }
      if (scenario === 'agente') {
        const control = service as unknown as { setAgentControlling: (value: boolean) => void };
        control.setAgentControlling(true); control.setAgentControlling(false);
      }
      if (scenario === 'pestaña') {
        const original = service.getState().activeTabId;
        await service.createTab('https://otra.example');
        await service.activateTab(original);
      }
      resolve({ response: 1, checkboxChecked: false });
      await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
      expect(callback).toHaveBeenCalledWith(scenario === 'selección' ? 'fixture_id' : undefined);
      expect(contents.capturePage).not.toHaveBeenCalled();
    } finally { service.detachWindow(); setAuthState({ authenticated: true, userId: 'prueba' }); }
  });

  it('sólo permite restringir extensiones autenticadas sin páginas o control agente', async () => {
    setBrowserScopeId(browserScopeIdFor('extension-fixture'));
    const service = newService(); service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://example.com');
      await expect(service.restrictExtensionSites('fixture', [], () => {})).rejects.toThrow(/Cierra/);
      // Navegar a blanco destruye el documento con scripts de la página anterior.
      await service.navigate('about:blank');
      await expect(service.restrictExtensionSites('fixture', [], () => {})).resolves.toMatchObject({ siteAccess: [] });
      (service as unknown as { setAgentControlling: (value: boolean) => void }).setAgentControlling(true);
      await expect(service.restrictExtensionSites('fixture', [], () => {})).rejects.toThrow(/Cierra/);
    } finally { service.detachWindow(); }
  });
  it.each(['sesión', 'control', 'página'] as const)('catálogo invalida la confirmación pendiente tras cambio de %s', async scenario => {
    setAuthState({ authenticated: true, userId: 'prueba' });
    setBrowserScopeId(browserScopeIdFor('prueba'));
    const service = newService(); service.attachWindow(new BrowserWindow());
    const internal = service as unknown as { extensionManager: { prepareFromDialog: ReturnType<typeof vi.fn> }; setAgentControlling: (active: boolean) => void };
    try {
      await service.open('about:blank');
      expect((await service.extensionCatalog({ action: 'list' }, () => {})).catalog).toHaveLength(1);
      await service.extensionCatalog({ action: 'prepare', catalogId: 'chrome-reading-time', updateInstallId: 'a'.repeat(32) }, () => {});
      const calls = internal.extensionManager.prepareFromDialog.mock.calls;
      const guard = calls[calls.length - 1][1] as () => void;
      expect(guard).not.toThrow();
      if (scenario === 'sesión') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'prueba' }); }
      if (scenario === 'control') { internal.setAgentControlling(true); internal.setAgentControlling(false); }
      if (scenario === 'página') await service.navigate('https://example.com');
      expect(guard).toThrow();
    } finally { service.detachWindow(); }
  });
  it('catálogo respeta el bloqueo empresarial antes de abrir la carpeta', async () => {
    setAuthState({ authenticated: true, userId: 'prueba' });
    const { service, root } = await enterpriseFixture();
    setAuthState({ authenticated: true, userId: root }); service.attachWindow(new BrowserWindow());
    try { await expect(service.extensionCatalog({ action: 'list' }, () => {})).rejects.toThrow('organización'); }
    finally { service.detachWindow(); }
  });
  it.each(['confirmar', 'cancelar', 'sesión', 'control', 'perfil'] as const)('recuperación de ajustes con HITL: %s', async mode => {
    setAuthState({ authenticated: true, userId: 'prueba' }); setBrowserScopeId(browserScopeIdFor('prueba'));
    const store = newStore(); const commit = vi.fn(async () => {});
    vi.spyOn(store, 'prepareRecovery').mockResolvedValue({ count: 1, commit });
    const service = newService(store); service.attachWindow(new BrowserWindow());
    let release!: (value: Electron.MessageBoxReturnValue) => void;
    vi.mocked(dialog.showMessageBox).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
    const input = { store: 'permissions', profileRevision: service.getState().profileRevision };
    const pending = service.recoverPolicyStore(input, () => {}).catch((error: Error) => error);
    try {
      await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled());
      await expect(service.recoverPolicyStore(input, () => {})).rejects.toThrow('revisión');
      if (mode === 'sesión') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'prueba' }); }
      if (mode === 'control') { const internal = service as unknown as { setAgentControlling: (value: boolean) => void }; internal.setAgentControlling(true); internal.setAgentControlling(false); }
      if (mode === 'perfil') await service.applyUserScope('otra');
      release({ response: mode === 'cancelar' ? 0 : 1, checkboxChecked: false });
      const result = await pending;
      if (mode === 'confirmar') { expect(result).toEqual({ cancelled: false, restored: 1 }); expect(commit).toHaveBeenCalledOnce(); }
      else { expect(commit).not.toHaveBeenCalled(); if (mode === 'cancelar') expect(result).toEqual({ cancelled: true, restored: 0 }); else expect(result).toBeInstanceOf(Error); }
      expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ defaultId: 0, cancelId: 0, detail: expect.stringContaining('Se retiran permisos concedidos') }));
    } finally { service.detachWindow(); }
  });
  it.each(['confirmar', 'cancelar', 'sesión', 'control', 'flag'] as const)('recuperación de memoria con HITL y gate: %s', async mode => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', mode === 'flag' ? 'false' : 'true');
    setAuthState({ authenticated: true, userId: 'prueba' }); setBrowserScopeId(browserScopeIdFor('prueba'));
    const commit = vi.fn(async () => {});
    const prepare = vi.spyOn(BrowserSemanticMemory.prototype, 'prepareRecovery').mockReturnValue({ count: 0, commit });
    const service = newService(); service.attachWindow(new BrowserWindow());
    try {
      const input = { store: 'semantic', profileRevision: service.getState().profileRevision };
      if (mode === 'flag') { await expect(service.recoverPolicyStore(input, () => {})).rejects.toThrow(); expect(prepare).not.toHaveBeenCalled(); return; }
      vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
        if (mode === 'sesión') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'prueba' }); }
        if (mode === 'control') { const internal = service as unknown as { setAgentControlling: (value: boolean) => void }; internal.setAgentControlling(true); internal.setAgentControlling(false); }
        return { response: mode === 'cancelar' ? 0 : 1, checkboxChecked: false };
      });
      const result = await service.recoverPolicyStore(input, () => {}).catch((error: Error) => error);
      if (mode === 'confirmar') { expect(result).toEqual({ cancelled: false, restored: 0 }); expect(commit).toHaveBeenCalledOnce(); }
      else { expect(commit).not.toHaveBeenCalled(); if (mode === 'cancelar') expect(result).toEqual({ cancelled: true, restored: 0 }); else expect(result).toBeInstanceOf(Error); }
      expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ defaultId: 0, cancelId: 0, detail: expect.stringContaining('No se recuperan fuentes ni vectores') }));
    } finally { service.detachWindow(); }
  });
  it.each(['history', 'audit'] as const)('recuperación %s exige gate y confirmación nativa', async kind => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true'); vi.stubEnv('BROWSER_ADVANCED_HISTORY_ENABLED', 'true');
    setAuthState({ authenticated: true, userId: 'prueba' }); setBrowserScopeId(browserScopeIdFor('prueba'));
    const service = newService(); service.attachWindow(new BrowserWindow());
    type Recovery = { prepareRecovery: (guard: () => void) => Promise<{ count: number; commit: () => Promise<void> }> };
    const internal = service as unknown as { historyStore: Recovery; auditStore: Recovery };
    const commit = vi.fn(async () => {}); const prepare = vi.spyOn(kind === 'history' ? internal.historyStore : internal.auditStore, 'prepareRecovery').mockResolvedValue({ count: 2, commit });
    try {
      const input = { store: kind, profileRevision: service.getState().profileRevision };
      vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
      expect(await service.recoverPolicyStore(input, () => {})).toEqual({ cancelled: true, restored: 0 }); expect(commit).not.toHaveBeenCalled();
      vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
      expect(await service.recoverPolicyStore(input, () => {})).toEqual({ cancelled: false, restored: 2 }); expect(commit).toHaveBeenCalledOnce();
      expect(prepare).toHaveBeenCalledTimes(2);
      expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ defaultId: 0, detail: expect.stringContaining('retención vigente') }));
    } finally { service.detachWindow(); }
    vi.stubEnv(kind === 'history' ? 'BROWSER_ADVANCED_HISTORY_ENABLED' : 'BROWSER_AGENT_GOVERNANCE_ENABLED', 'false');
    const disabled = newService(); disabled.attachWindow(new BrowserWindow());
    try { await expect(disabled.recoverPolicyStore({ store: kind, profileRevision: disabled.getState().profileRevision }, () => {})).rejects.toThrow(); }
    finally { disabled.detachWindow(); }
  });
  it('catálogo no opera en el perfil anterior mientras se propaga una nueva sesión', async () => {
    setBrowserScopeId(browserScopeIdFor('anterior'));
    const service = newService(); service.attachWindow(new BrowserWindow());
    setAuthState({ authenticated: true, userId: 'nueva' });
    try { await expect(service.extensionCatalog({ action: 'list' }, () => {})).rejects.toThrow('contexto'); }
    finally { service.detachWindow(); }
  });
  it('un documento sensible detiene supervisión, invalida captura y no se habilita cambiando el hash', async () => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true');
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/'); service.setViewport({ x: 0, y: 0, width: 1000, height: 700 });
    const contents = browserViewHarness.instances[0].webContents;
    const control = new BrowserCuSupervisor(`browser-cu-${randomUUID()}`, 5, new AbortController());
    const detach = service.bindAgentTask(control); await service.openForAgent(); control.beginPhase();
    const baselineCaptures = contents.capturePage.mock.calls.length;
    vi.mocked(inspectBrowserSensitivePage).mockResolvedValue('secret');
    try {
      await expect(service.getObservation(true)).rejects.toThrow('manualmente');
      expect(contents.capturePage.mock.calls.length).toBe(baselineCaptures);
      expect(service.getState().tabs[0].sensitiveHandoff).toEqual({ reason: 'secret' });
      expect(control.snapshot().status).toBe('stopping'); expect(service.getState().agentControlling).toBe(true);
      detach(); service.releaseAgentControl(); control.finish();
      contents.emit('did-navigate-in-page');
      await expect(service.authorizeAgentTarget('act')).rejects.toThrow('manualmente');
      contents.emit('did-navigate');
      expect(service.getState().tabs[0].sensitiveHandoff).toBeNull();
      expect(service.getObservationStatus().lastCapturedAt).toBeNull();
    } finally { detach(); control.finish(); service.detachWindow(); vi.mocked(inspectBrowserSensitivePage).mockResolvedValue(null); vi.unstubAllEnvs(); }
  });
  it('no publica DOM ni imagen cuando aparece riesgo durante la captura', async () => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true');
    const evaluation = vi.spyOn(BrowserAgentPolicyStore.prototype, 'evaluate').mockResolvedValue('allow');
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/'); service.setViewport({ x: 0, y: 0, width: 1000, height: 700 });
    const contents = browserViewHarness.instances[0].webContents;
    contents.capturePage.mockImplementationOnce(async () => {
      vi.mocked(inspectBrowserSensitivePage).mockResolvedValue('payment');
      return { isEmpty: () => false };
    });
    try {
      await expect(service.getObservation(true)).rejects.toThrow();
      expect(service.getState().tabs[0].sensitiveHandoff).toEqual({ reason: 'payment' });
      expect(service.getObservationStatus().lastCapturedAt).toBeNull();
      await expect(service.getTabContent(service.getState().activeTabId!)).rejects.toThrow('manualmente');
    } finally { evaluation.mockRestore(); service.detachWindow(); vi.mocked(inspectBrowserSensitivePage).mockResolvedValue(null); vi.unstubAllEnvs(); }
  });
  it('la supervisión conserva controles fuera de pantalla completa y rechaza ventanas separadas', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/'); service.setViewport({ x: 0, y: 0, width: 1000, height: 700 });
    service.toggleFullscreen(); expect(service.getState().isFullscreen).toBe(true);
    const control = new BrowserCuSupervisor(`browser-cu-${randomUUID()}`, 5, new AbortController());
    const detach = service.bindAgentTask(control); await service.openForAgent(); control.beginPhase();
    expect(service.getState().isFullscreen).toBe(false);
    service.toggleFullscreen(); expect(service.getState().isFullscreen).toBe(false);
    detach(); service.releaseAgentControl(); control.finish();
    const id = service.getState().activeTabId!; service.detachTab(id); service.activateTab(id);
    const other = new BrowserCuSupervisor(`browser-cu-${randomUUID()}`, 5, new AbortController());
    expect(() => service.bindAgentTask(other)).toThrow('Acopla'); other.finish(); service.detachWindow();
  });
  it('enlaza supervisión main al perfil, publica pausa y sólo libera al terminar', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/'); service.setViewport({ x: 0, y: 0, width: 1000, height: 700 });
    const control = new BrowserCuSupervisor(`browser-cu-${randomUUID()}`, 5, new AbortController());
    const detach = service.bindAgentTask(control);
    const input = { taskId: control.taskId, taskRevision: 1, profileRevision: service.getState().profileRevision! };
    await service.openForAgent(); control.beginPhase();
    expect(() => service.bindAgentTask(control)).toThrow();
    expect(() => service.controlAgentTask({ ...input, profileRevision: 999, action: 'pause' })).toThrow();
    expect(() => service.controlAgentTask({ ...input, taskId: `browser-cu-${randomUUID()}`, action: 'pause' })).toThrow();
    service.controlAgentTask({ ...input, action: 'pause' });
    expect(service.getState()).toMatchObject({ agentControlling: true, agentTask: { status: 'pausing' } });
    const waiting = control.waitForResume();
    expect(service.getState().agentTask?.status).toBe('paused');
    expect(() => service.controlAgentTask({ ...input, action: 'resume' })).toThrow('ejecución');
    const previousPause = control.snapshot().revision;
    service.controlAgentTask({ ...input, taskRevision: previousPause, action: 'resume' }); await waiting;
    control.beginPhase(); control.command('pause'); const secondWait = control.waitForResume();
    const canceled = expect(secondWait).rejects.toThrow();
    expect(() => service.controlAgentTask({ ...input, taskRevision: previousPause, action: 'resume' })).toThrow('ejecución');
    service.controlAgentTask({ ...input, action: 'take-control' });
    await canceled;
    expect(service.getState()).toMatchObject({ agentControlling: true, agentTask: { status: 'stopping' } });
    detach(); service.releaseAgentControl(); control.finish();
    expect(service.getState()).toMatchObject({ agentControlling: false, agentTask: null });
    expect(() => service.controlAgentTask({ ...input, action: 'resume' })).toThrow();
    service.detachWindow();
  });

  it.each(['pestaña', 'cierre', 'apagado'] as const)('cancela una tarea pausada al cambiar %s', async change => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/'); service.setViewport({ x: 0, y: 0, width: 1000, height: 700 });
    const control = new BrowserCuSupervisor(`browser-cu-${randomUUID()}`, 5, new AbortController());
    const detach = service.bindAgentTask(control); await service.openForAgent(); control.beginPhase();
    control.command('pause'); const waiting = control.waitForResume();
    const rejected = expect(waiting).rejects.toThrow();
    if (change === 'pestaña') await service.createTab('https://otro.example/');
    else if (change === 'cierre') service.detachWindow(); else service.commitShutdown();
    await rejected; expect(control.signal.aborted).toBe(true);
    detach(); service.releaseAgentControl(); control.finish(); service.detachWindow();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    // Esta suite comprueba sitio/formulario. La sesión SO real tiene su propia suite.
    vi.spyOn(BrowserCredentialUnlock.prototype, 'isUnlocked').mockReturnValue(true);
    vi.spyOn(BrowserCredentialUnlock.prototype, 'capture').mockReturnValue(() => {});
    // `clearAllMocks` borra las llamadas pero conserva las implementaciones:
    // sin reponerlas, el cuadro que una prueba deja rechazando arrastra a la
    // siguiente.
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
    vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValue('granted');
    vi.mocked(systemPreferences.askForMediaAccess).mockResolvedValue(true);
    browserViewHarness.instances.length = 0;
    browserWindowHarness.instances.length = 0;
    detachedWindowHarness.instances.length = 0;
  });

  it.each(['export', 'scope', 'window'] as const)('el diagnóstico usa el estado real del servicio y valida el contexto: %s', async (action) => {
    const f = await sessionFixture(null);
    const window = new BrowserWindow(); f.service.attachWindow(window);
    await f.service.applyUserScope('titular-ficticio');
    await f.service.open('https://privado.example/?token=ficticio');
    await f.service.createTab('https://otro.example/');
    const destination = path.join(f.root, 'diagnostico.json');
    vi.mocked(dialog.showSaveDialog).mockImplementationOnce(async () => {
      if (action === 'scope') await f.service.applyUserScope('otro-titular');
      if (action === 'window') f.service.detachWindow(window);
      return { canceled: false, filePath: destination };
    });
    const pending = f.service.exportRuntimeDiagnostic();
    if (action === 'export') {
      expect(await pending).toEqual({ cancelled: false, exported: true });
      const content = await fs.readFile(destination, 'utf8');
      const report = JSON.parse(content);
      expect(report.metrics.find((metric: { id: string }) => metric.id === 'tabs.logical').value).toBe(2);
      expect(report.metrics.find((metric: { id: string }) => metric.id === 'tabs.liveViews').value).toBe(2);
      expect(content).not.toMatch(/privado|token|ficticio|titular|otro\.example/);
    } else {
      await expect(pending).rejects.toThrow('perfil o la ventana cambió');
      await expect(fs.stat(destination)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it.each([false, true])('invalida el consentimiento sync si el agente toma control, incluso al devolverlo: %s', async (returnsControl) => {
    const f = await sessionFixture(null);
    f.service.attachWindow(new BrowserWindow());
    await f.service.applyUserScope('titular-sync-ficticio');
    const internal = f.service as unknown as { syncDeviceContext: () => BrowserSyncDeviceContext; setAgentControlling: (value: boolean) => void };
    const context = internal.syncDeviceContext();
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      internal.setAgentControlling(true);
      if (returnsControl) f.service.releaseAgentControl();
      return { response: 1, checkboxChecked: false };
    });
    await expect(context.confirm('register', 'Este dispositivo')).rejects.toThrow('El control cambió');
    expect(context.guard).toThrow('El control cambió');
    f.service.releaseAgentControl();
    expect(context.guard).toThrow('El control cambió');
  });

  it.each(['confirm', 'cancel', 'control', 'window', 'failure'] as const)('recuperación de marcadores con decisión nativa y contexto: %s', async (mode) => {
    const store = new BrowserBookmarkStore('sin-acceso-en-esta-prueba');
    const commit = vi.fn(async (guard: () => void) => { guard(); return 3; });
    vi.spyOn(store, 'prepareRecovery').mockResolvedValue({ count: 3, commit });
    const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, undefined, store);
    service.attachWindow(new BrowserWindow());
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      expect(commit).not.toHaveBeenCalled();
      if (mode === 'control') {
        (service as unknown as { setAgentControlling: (value: boolean) => void }).setAgentControlling(true);
        service.releaseAgentControl();
      }
      if (mode === 'window') service.detachWindow();
      if (mode === 'failure') throw new Error('C:/privado/archivo');
      return { response: mode === 'cancel' ? 0 : 1, checkboxChecked: false };
    });
    try {
      if (mode === 'confirm') expect(await service.recoverBookmarks()).toEqual({ cancelled: false, restored: 3 });
      else if (mode === 'cancel') expect(await service.recoverBookmarks()).toEqual({ cancelled: true, restored: 0 });
      else await expect(service.recoverBookmarks()).rejects.toThrow(mode === 'control' ? 'Toma el control' : 'No se pudo recuperar');
      expect(commit).toHaveBeenCalledTimes(mode === 'confirm' ? 1 : 0);
      expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ defaultId: 0, cancelId: 0, message: expect.stringContaining('3 marcadores') }));
    } finally { service.detachWindow(); }
  });

  it('una recuperación pendiente bloquea duplicados y nunca empieza bajo control del agente', async () => {
    const store = new BrowserBookmarkStore('sin-acceso-en-esta-prueba');
    const commit = vi.fn(async () => 1); vi.spyOn(store, 'prepareRecovery').mockResolvedValue({ count: 1, commit });
    const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, undefined, store);
    service.attachWindow(new BrowserWindow());
    let release!: (result: { response: number; checkboxChecked: boolean }) => void;
    vi.mocked(dialog.showMessageBox).mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const pending = service.recoverBookmarks(); await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled());
    await expect(service.recoverBookmarks()).rejects.toThrow('pendiente'); release({ response: 0, checkboxChecked: false }); await pending;
    (service as unknown as { setAgentControlling: (value: boolean) => void }).setAgentControlling(true);
    await expect(service.recoverBookmarks()).rejects.toThrow('Toma el control'); expect(store.prepareRecovery).toHaveBeenCalledTimes(1);
    service.releaseAgentControl(); service.detachWindow();
  });

  it.each(['confirm', 'cancel', 'control', 'window', 'failure'] as const)('recuperación de bóveda con decisión nativa y contexto: %s', async (mode) => {
    const commit = vi.fn(async (guard: () => void) => { guard(); return 3; });
    const vault = { prepareRecovery: vi.fn(async () => ({ count: 3, commit })) };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    service.attachWindow(new BrowserWindow());
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      expect(commit).not.toHaveBeenCalled();
      if (mode === 'control') {
        (service as unknown as { setAgentControlling: (value: boolean) => void }).setAgentControlling(true);
        service.releaseAgentControl();
      }
      if (mode === 'window') service.detachWindow();
      if (mode === 'failure') throw new Error('C:/privado/archivo');
      return { response: mode === 'cancel' ? 0 : 1, checkboxChecked: false };
    });
    try {
      if (mode === 'confirm') expect(await service.recoverCredentials()).toEqual({ cancelled: false, restored: 3 });
      else if (mode === 'cancel') expect(await service.recoverCredentials()).toEqual({ cancelled: true, restored: 0 });
      else await expect(service.recoverCredentials()).rejects.toThrow(mode === 'control' ? 'Toma el control' : mode === 'window' ? 'El perfil o la ventana cambió' : 'No se pudo completar');
      expect(commit).toHaveBeenCalledTimes(mode === 'confirm' ? 1 : 0);
      expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ defaultId: 0, cancelId: 0, message: expect.stringContaining('3 credenciales') }));
    } finally { service.detachWindow(); }
  });

  it('impide recuperar contraseñas bajo control del agente y duplicar el diálogo', async () => {
    const vault = { prepareRecovery: vi.fn(async () => ({ count: 1, commit: vi.fn(async () => 1) })) };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    service.attachWindow(new BrowserWindow());
    let release!: (result: { response: number; checkboxChecked: boolean }) => void;
    vi.mocked(dialog.showMessageBox).mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const pending = service.recoverCredentials(); await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled());
    await expect(service.recoverCredentials()).rejects.toThrow('en revisión');
    release({ response: 0, checkboxChecked: false }); await pending;
    (service as unknown as { setAgentControlling: (value: boolean) => void }).setAgentControlling(true);
    await expect(service.recoverCredentials()).rejects.toThrow('Toma el control');
    expect(vault.prepareRecovery).toHaveBeenCalledTimes(1);
    service.releaseAgentControl(); service.detachWindow();
  });

  it('rechaza gestionar dispositivos mientras el agente tiene el control', async () => {
    const f = await sessionFixture(null);
    f.service.attachWindow(new BrowserWindow());
    await f.service.applyUserScope('titular-sync-ficticio');
    const internal = f.service as unknown as { setAgentControlling: (value: boolean) => void };
    internal.setAgentControlling(true);
    expect(() => f.service.getSyncDevices()).toThrow('El control cambió');
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    f.service.releaseAgentControl();
  });

  it('aplica disposición sincronizada con persistencia sin desmontar pestañas ni split', async () => {
    const f = await sessionFixture(null); f.service.attachWindow(new BrowserWindow());
    await f.service.applyUserScope('titular-sync-fixture');
    await f.service.open('https://example.com/uno');
    await f.service.createTab('https://example.com/dos');
    await f.service.setViewMode('split');
    const before = f.service.getState();
    const internal = f.service as unknown as { syncControlContext: () => BrowserSyncControlContext };
    const context = internal.syncControlContext(); const expected = await context.local.read('settings');
    const views = [...browserViewHarness.instances];
    expect(await context.local.compareAndApply('settings', expected, { tabLayout: 'vertical' }, context.guard)).toBe(true);
    const after = f.service.getState();
    expect(after.viewMode).toBe('split'); expect(after.activeTabId).toBe(before.activeTabId);
    expect(after.tabs.map((tab) => tab.id)).toEqual(before.tabs.map((tab) => tab.id));
    expect(browserViewHarness.instances).toEqual(views);
    expect((await f.store.load())?.tabLayout).toBe('vertical');
  });

  it('no permite leer una sesión para sync cuando la restauración está deshabilitada', async () => {
    vi.stubEnv('BROWSER_SESSION_RESTORE_ENABLED', 'false');
    const service = newService(); service.attachWindow(new BrowserWindow());
    const internal = service as unknown as { syncControlContext: () => BrowserSyncControlContext };
    await expect(internal.syncControlContext().local.read('tabs')).rejects.toThrow('restauración');
  });

  it('no registra si el control cambia durante la E/S posterior al consentimiento nativo', async () => {
    vi.stubEnv('BROWSER_ENCRYPTED_SYNC_ENABLED', 'true');
    const f = await sessionFixture(null);
    f.service.attachWindow(new BrowserWindow());
    await f.service.applyUserScope('titular-sync-ficticio');
    const internal = f.service as unknown as { syncDeviceContext: () => BrowserSyncDeviceContext; setAgentControlling: (value: boolean) => void };
    const context = internal.syncDeviceContext();
    const register = vi.fn();
    const remote = { active: vi.fn(async () => false), register } as unknown as BrowserSyncRemote;
    const binding = { ownerId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222', origin: 'https://fixture.supabase.co' };
    const manager = new BrowserSyncDevices(async () => ({ binding, remote, dispose: vi.fn() }));
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    vi.spyOn(BrowserSyncDeviceIdentity.prototype, 'ensure').mockImplementationOnce(async () => {
      internal.setAgentControlling(true);
      f.service.releaseAgentControl();
      return '33333333-3333-4333-8333-333333333333';
    });
    await expect(manager.register(context)).rejects.toThrow('No se pudo completar');
    expect(BrowserSyncDeviceIdentity.prototype.ensure).toHaveBeenCalledTimes(1);
    expect(register).not.toHaveBeenCalled();
  });

  it('retira producto y Electron estable sin alterar Chromium', () => {
    expect(toStandardChromiumUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) soflia-hub-desktop/0.9.6 Chrome/150.0.7871.224 '
      + 'Electron/43.4.0 Safari/537.36',
    )).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Chrome/150.0.7871.224 Safari/537.36',
    );
  });

  it('consume completo el sufijo prerelease de Electron', () => {
    expect(toStandardChromiumUserAgent(
      'Mozilla/5.0 soflia-hub-desktop/0.9.6 Chrome/152.0.7977.30 '
      + 'Electron/44.0.0-beta.3 Safari/537.36',
    )).toBe('Mozilla/5.0 Chrome/152.0.7977.30 Safari/537.36');
  });

  it('configura el fallback antes de que Electron cree contenidos', () => {
    const target = {
      userAgentFallback: 'Mozilla/5.0 soflia-hub-desktop/0.9.6 '
        + 'Chrome/150.0.7871.224 Electron/43.4.0 Safari/537.36',
    };

    expect(configureChromiumUserAgentFallback(target)).toBe(
      'Mozilla/5.0 Chrome/150.0.7871.224 Safari/537.36',
    );
    expect(target.userAgentFallback).toBe(
      'Mozilla/5.0 Chrome/150.0.7871.224 Safari/537.36',
    );
  });

  it('crea una sola vista aislada, persiste la particion y reutiliza la instancia', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);

    await service.open('https://example.com');
    await service.open();

    expect(browserViewHarness.instances).toHaveLength(1);
    const view = browserViewHarness.instances[0];
    expect(view.options?.webPreferences).toMatchObject({
      partition: browserPartitionFor(browserScopeIdFor(null)),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    });
    // El User-Agent queda identico al de un Chromium de escritorio: sin el
    // nombre de la aplicacion ni la ficha `Electron/`, que lo convertian en un
    // cliente desconocido frente a lo que anuncia `Sec-CH-UA`.
    expect(view.webContents.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
    // Los workers y ciertos subframes cruzados toman el UA de Session. El HAR
    // de Meet mostro que normalizar solo WebContents dejaba 137 solicitudes
    // anunciando Electron y el flujo no alcanzaba CreateMeetingDevice.
    expect(view.webContents.session.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
    expect(window.contentView.addChildView).toHaveBeenCalledTimes(1);
  });

  it('normaliza tambien el User-Agent de las ventanas reales que abre un sitio', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://mail.google.com');

    const popup = new BrowserWindow();
    browserViewHarness.instances[0].webContents.emit('did-create-window', popup);

    // Google Meet abre su ventana de llamada desde Gmail por esta via. La
    // ventana no hereda el User-Agent de quien la abrio, asi que sin esto era
    // la unica superficie que seguia anunciando `soflia-hub-desktop/x.y.z` y
    // `Electron/x.y.z`.
    expect(popup.webContents.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
    expect(popup.webContents.session.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
  });

  it('aisla la sesion de navegacion por usuario y derriba las pestañas al cambiar de cuenta', async () => {
    const window = new BrowserWindow();
    const service = newService();
    service.attachWindow(window);

    await service.applyUserScope('usuario-a');
    await service.open('https://example.com');
    const primeraParticion = browserViewHarness.instances[0].options?.webPreferences?.partition;
    expect(primeraParticion).toBe(browserPartitionFor(browserScopeIdFor('usuario-a')));
    expect(service.getState().tabs).toHaveLength(1);

    // Cambio de cuenta: no queda ninguna pestaña del usuario anterior viva y la
    // siguiente vista nace en otra particion.
    await service.applyUserScope('usuario-b');
    expect(service.getState().tabs).toHaveLength(0);
    expect(browserViewHarness.instances[0].webContents.close).toHaveBeenCalled();

    await service.open('https://example.com');
    const nuevaVista = browserViewHarness.instances[browserViewHarness.instances.length - 1];
    const segundaParticion = nuevaVista.options?.webPreferences?.partition;
    expect(segundaParticion).toBe(browserPartitionFor(browserScopeIdFor('usuario-b')));
    expect(segundaParticion).not.toBe(primeraParticion);

    service.detachWindow();
  });

  it('vacia la sesion sin usuario al cerrar sesion', async () => {
    const window = new BrowserWindow();
    const service = newService();
    service.attachWindow(window);

    await service.applyUserScope('usuario-a');
    await service.open('https://example.com');
    await service.applyUserScope(null);

    const anonima = vi.mocked(session.fromPartition).mock.results
      .map((result) => result.value as { clearStorageData?: ReturnType<typeof vi.fn> })
      .find((value) => Boolean(value?.clearStorageData));
    expect(anonima?.clearStorageData).toHaveBeenCalled();
    expect(service.getState().tabs).toHaveLength(0);

    service.detachWindow();
  });

  afterEach(async () => {
    for (const fixture of sessionFixtures.splice(0)) {
      fixture.service.detachWindow();
      // Espera el guardado de cierre antes de retirar sólo el directorio temporal.
      await fixture.store.load().catch(() => undefined);
      await fixture.service.flushClosedProfileForShutdown().catch(() => undefined);
      await fs.rm(fixture.root, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
    vi.useRealTimers();
    resetBrowserScopeForTests();
    await Promise.all(permissionStorePaths.splice(0).flatMap(filePath => [filePath, `${filePath}.recovery.bin`]).map(filePath => fs.rm(filePath, { force: true })));
  });

  it('mantiene la percepción pasiva ligera y extrae DOM solo bajo demanda', async () => {
    vi.useFakeTimers();
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://www.youtube.com/watch?v=video');
    const contents = browserViewHarness.instances[0].webContents;
    contents.capturePage.mockClear();
    contents.executeJavaScript.mockClear();

    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });

    expect(contents.capturePage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(11_999);
    expect(contents.capturePage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    // Lo que no debe ocurrir sin peticion es leer el DOM. Instalar el vigia de
    // seleccion, el menu flotante o el panel de redaccion no lee la pagina.
    expect(domExtractions(contents)).toBe(0);
    const passiveImage = await contents.capturePage.mock.results[0].value;
    expect(passiveImage.resize).toHaveBeenCalledWith({ width: 1024, height: 576, quality: 'good' });
    await expect(service.getObservation(false)).resolves.toMatchObject({
      observation: null,
      observationStatus: { intervalMs: 30_000 },
    });

    await expect(service.getObservation(true)).resolves.toMatchObject({
      observation: expect.objectContaining({ screenshot: 'data:image/jpeg;base64,Y2FwdHVyYQ==' }),
    });
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    expect(domExtractions(contents)).toBe(1);
    service.detachWindow();
  });

  it('BR-SEL-001: adjunta la selección viva al chat sin pasar por el menú contextual', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue('  CONCEPTO 3.2  ');

    contents.emit('input-event', {}, { type: 'mouseUp', x: 400, y: 300 });
    await vi.advanceTimersByTimeAsync(500);

    const avisos = enviar.mock.calls.filter(
      (call: unknown[]) => call[0] === 'integrated-browser:selection-action',
    );
    expect(avisos).toHaveLength(1);
    // Solo adjunta contexto: el compositor queda libre para que escriba el usuario.
    expect(avisos[0][1]).toMatchObject({ action: 'ask', text: 'CONCEPTO 3.2', instruction: '' });

    // La misma seleccion no se reenvia mientras siga viva.
    contents.emit('input-event', {}, { type: 'mouseUp', x: 410, y: 300 });
    await vi.advanceTimersByTimeAsync(500);
    expect(enviar.mock.calls.filter(
      (call: unknown[]) => call[0] === 'integrated-browser:selection-action',
    )).toHaveLength(1);

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-002: al deshacer la selección deja de adjuntarla', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue('');

    contents.emit('input-event', {}, { type: 'mouseUp', x: 400, y: 300 });
    await vi.advanceTimersByTimeAsync(500);

    expect(enviar.mock.calls.filter(
      (call: unknown[]) => call[0] === 'integrated-browser:selection-action',
    )).toHaveLength(0);

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-003: encuentra la selección aunque viva dentro de un iframe', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/mail/u/0/#chat/dm/wOBiBCAAAAE');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    enviar.mockClear();
    // Gmail rinde el panel de chat en un marco anidado: el documento principal
    // no tiene seleccion, pero el hijo si.
    const marcoPrincipal = { executeJavaScript: vi.fn(async () => '') };
    const marcoHijo = { executeJavaScript: vi.fn(async () => '  CONCEPTO 3.2  ') };
    (contents as unknown as { mainFrame: unknown }).mainFrame = { framesInSubtree: [marcoPrincipal, marcoHijo] };

    contents.emit('input-event', {}, { type: 'mouseUp', x: 400, y: 300 });
    await vi.advanceTimersByTimeAsync(500);

    const avisos = enviar.mock.calls.filter(
      (call: unknown[]) => call[0] === 'integrated-browser:selection-action',
    );
    expect(avisos).toHaveLength(1);
    expect(avisos[0][1]).toMatchObject({ action: 'ask', text: 'CONCEPTO 3.2' });
    expect(marcoPrincipal.executeJavaScript).toHaveBeenCalled();

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-004: el aviso de la página dispara el sondeo y retira el adjunto al deseleccionar', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    const avisos = () => enviar.mock.calls.filter((call: unknown[]) => call[0] === 'integrated-browser:selection-action');
    enviar.mockClear();

    // La pagina avisa por consola: no hace falta ningun evento de entrada.
    contents.executeJavaScript.mockResolvedValue('CONCEPTO 3.2');
    contents.emit('console-message', { message: '__SOFLIA_SELECTION__' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(1);
    expect(avisos()[0][1]).toMatchObject({ text: 'CONCEPTO 3.2' });

    // Al deshacer la seleccion se avisa con texto vacio para retirar el chip.
    contents.executeJavaScript.mockResolvedValue('');
    contents.emit('console-message', { message: '__SOFLIA_SELECTION__' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(2);
    expect(avisos()[1][1]).toMatchObject({ text: '' });

    // Y no se repite el aviso mientras siga sin haber seleccion.
    contents.emit('console-message', { message: '__SOFLIA_SELECTION__' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(2);

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-005: el menú flotante adjunta la acción con su instrucción y abre el lector', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    const avisos = (canal: string) => enviar.mock.calls.filter((call: unknown[]) => call[0] === canal);
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue('CONCEPTO 3.2');

    contents.emit('console-message', { message: '__SOFLIA_SELECTION_MENU__:translate' });
    await vi.advanceTimersByTimeAsync(500);

    const seleccion = avisos('integrated-browser:selection-action');
    expect(seleccion).toHaveLength(1);
    expect(seleccion[0][1]).toMatchObject({ action: 'translate', text: 'CONCEPTO 3.2' });
    expect((seleccion[0][1] as { instruction: string }).instruction).toContain('Traduce');

    // La lectura no adjunta texto al chat: abre el panel del modo lectura.
    contents.emit('console-message', { message: '__SOFLIA_SELECTION_MENU__:read' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos('integrated-browser:selection-action')).toHaveLength(1);
    expect(avisos('integrated-browser:reading-mode-requested')).toHaveLength(1);
    expect(avisos('integrated-browser:reading-mode-requested')[0][1]).toMatchObject({ selection: 'CONCEPTO 3.2' });

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-006: la página no puede inventar acciones ni actuar durante el control del agente', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    const avisos = () => enviar.mock.calls.filter((call: unknown[]) => call[0] === 'integrated-browser:selection-action');
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue('CONCEPTO 3.2');

    contents.emit('console-message', { message: '__SOFLIA_SELECTION_MENU__:borrar-todo' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(0);

    await service.openForAgent();
    enviar.mockClear();
    contents.emit('console-message', { message: '__SOFLIA_SELECTION_MENU__:summarize' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(0);

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-007: la petición del panel de redacción sube al renderer y su respuesta baja a la página', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue({ requestId: 'w1a2b3c4d5', prompt: 'mas formal', text: 'hola q tal' });

    contents.emit('console-message', { message: '__SOFLIA_WRITING__' });
    await vi.advanceTimersByTimeAsync(100);

    const peticiones = enviar.mock.calls.filter((call: unknown[]) => call[0] === 'integrated-browser:writing-request');
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0][1]).toMatchObject({
      requestId: 'w1a2b3c4d5',
      prompt: 'mas formal',
      text: 'hola q tal',
      url: 'https://mail.google.com/chat',
    });
    // El texto del usuario nunca viaja por la consola: el aviso solo avisa.
    expect(enviar.mock.calls.filter((call: unknown[]) => call[0] === 'integrated-browser:selection-action')).toHaveLength(0);

    contents.executeJavaScript.mockClear();
    contents.executeJavaScript.mockResolvedValue(true);
    await expect(service.resolveWritingRequest({ requestId: 'w1a2b3c4d5', text: 'Hola, ¿qué tal?' })).resolves.toEqual({ delivered: true });
    expect(String(contents.executeJavaScript.mock.calls[0][0])).toContain('w1a2b3c4d5');

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-008: el panel de redacción no actúa mientras el agente conduce', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    await service.openForAgent();
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue({ requestId: 'w1a2b3c4d5', prompt: '', text: 'hola' });

    contents.emit('console-message', { message: '__SOFLIA_WRITING__' });
    await vi.advanceTimersByTimeAsync(100);

    expect(enviar.mock.calls.filter((call: unknown[]) => call[0] === 'integrated-browser:writing-request')).toHaveLength(0);

    service.detachWindow();
    vi.useRealTimers();
  });

  it('espera una ventana de calma y no compite con Computer Use', async () => {
    vi.useFakeTimers();
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://www.youtube.com/watch?v=video');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    contents.capturePage.mockClear();

    await service.openForAgent();
    contents.emit('input-event', {}, { type: 'mouseDown', x: 900, y: 280 });
    await vi.advanceTimersByTimeAsync(2_000);
    contents.emit('input-event', {}, { type: 'mouseWheel', x: 900, y: 280 });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(contents.capturePage).not.toHaveBeenCalled();

    service.releaseAgentControl();
    await vi.advanceTimersByTimeAsync(11_999);
    expect(contents.capturePage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    service.detachWindow();
  });

  it('omite capturas pasivas sin foco y conserva la observación forzada del agente', async () => {
    const window = new BrowserWindow();
    vi.mocked(window.isFocused).mockReturnValue(false);
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://example.com/dinamica');
    const contents = browserViewHarness.instances[0].webContents;
    contents.capturePage.mockClear();
    contents.executeJavaScript.mockClear();

    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    await Promise.resolve();
    expect(contents.capturePage).not.toHaveBeenCalled();

    await service.getObservation(true);
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    expect(domExtractions(contents)).toBe(1);
  });

  it('publica bounds visibles, estado y libera recursos al cerrar', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://example.com');
    const state = service.setViewport({ x: 200, y: 80, width: 800, height: 600 });
    const view = browserViewHarness.instances[0];

    expect(view.setBounds).toHaveBeenCalledWith({ x: 200, y: 80, width: 800, height: 600 });
    expect(state.isVisible).toBe(true);
    expect(window.webContents.send).toHaveBeenCalledWith('integrated-browser:state-changed', expect.objectContaining({ isVisible: true }));

    service.detachWindow();
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(view);
    expect(view.webContents.close).toHaveBeenCalled();
    expect(service.getState().isVisible).toBe(false);
  });

  it('no oculta ni reposiciona la vista cuando el viewport se republica igual', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://www.youtube.com/watch?v=video');
    const view = browserViewHarness.instances[0];

    service.setViewport({ x: 200, y: 80, width: 800, height: 600 });
    view.setBounds.mockClear();
    view.setVisible.mockClear();

    service.setViewport({ x: 200, y: 80, width: 800, height: 600 });
    service.setViewport({ x: 200, y: 80, width: 800, height: 600 });

    expect(view.setBounds).not.toHaveBeenCalled();
    expect(view.setVisible).not.toHaveBeenCalled();

    service.setViewport({ x: 200, y: 80, width: 640, height: 600 });
    expect(view.setBounds).toHaveBeenCalledTimes(1);
    expect(view.setVisible).not.toHaveBeenCalled();
    service.detachWindow();
  });

  it('interactua por referencia del DOM y rechaza referencias vencidas', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://mail.example/inbox');
    service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
    const contents = browserViewHarness.instances[0].webContents;

    contents.executeJavaScript.mockResolvedValueOnce({
      ok: true, tag: 'a', role: 'link', name: 'Correo de Israel', type: '',
      href: 'https://mail.example/mensaje/1', disabled: false, editable: false, x: 120, y: 240, occluded: false,
    });
    const outcome = await service.clickElement('dom-7');

    expect(outcome.target).toMatchObject({ ref: 'dom-7', name: 'Correo de Israel' });
    expect(outcome.warning).toBeNull();
    expect(contents.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'mouseDown', x: 120, y: 240 }));
    expect(contents.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'mouseUp', x: 120, y: 240 }));

    contents.executeJavaScript.mockResolvedValueOnce({ ok: false, reason: 'referencia-vencida' });
    await expect(service.clickElement('dom-7')).rejects.toThrow(/vuelve a leer el DOM/i);
    service.detachWindow();
  });

  it.each(['import', 'scope', 'window'] as const)('conecta la revisión con el lifecycle real del servicio: %s', async (scenario) => {
    const fixture = await sessionFixture(null);
    const bookmarks = new BrowserBookmarkStore(path.join(fixture.root, 'bookmarks.json'));
    const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, fixture.store, bookmarks);
    fixture.service = service;
    service.attachWindow(new BrowserWindow());
    const source = path.join(fixture.root, 'import.html');
    await fs.writeFile(source, '<a href="https://example.com">Importado</a>');
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [source] });
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      expect(await bookmarks.list()).toHaveLength(0);
      if (scenario === 'scope') await service.applyUserScope('otro-usuario');
      if (scenario === 'window') service.detachWindow();
      return { response: 0, checkboxChecked: false };
    });
    if (scenario === 'import') {
      expect(await service.importBookmarksHtml()).toEqual({ cancelled: false, imported: 1, updated: 0, skipped: 0, duplicates: 0, invalid: 0 });
      expect((await bookmarks.list())[0].title).toBe('Importado');
    } else {
      await expect(service.importBookmarksHtml()).rejects.toThrow('perfil o la ventana cambió');
      expect(await bookmarks.list()).toHaveLength(0);
    }
  });

  it('muestra y modifica el zoom real cuando Chromium lo cambia desde otra pestaña', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/primera');
    const first = browserViewHarness.instances[0].webContents;
    expect(first.setZoomMode).toHaveBeenCalledWith('isolated');
    await service.createTab('https://example.com/segunda', true);
    const second = browserViewHarness.instances[1].webContents;
    // Reproducir la propagación por origen observada en Electron 43 nativo.
    first.setZoomFactor(1.4);
    second.setZoomFactor(1.4);
    expect(service.getState().tabs.map((tab) => tab.zoomFactor)).toEqual([1.4, 1.4]);
    service.setZoom('in');
    expect(second.setZoomFactor).toHaveBeenLastCalledWith(1.5);
    service.setZoom('reset');
    expect(second.setZoomFactor).toHaveBeenLastCalledWith(1);
  });

  it('duplicar conserva el zoom observado, no la metadata anterior', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const sourceId = service.getState().activeTabId!;
    browserViewHarness.instances[0].webContents.setZoomFactor(1.6);
    await service.duplicateTab(sourceId);
    expect(browserViewHarness.instances[1].webContents.setZoomFactor).toHaveBeenLastCalledWith(1.6);
  });

  it('reabre la pestaña cerrada elegida, conserva fallos y vacía recientes al borrar historial', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://first.example');
      const first = service.getState().activeTabId!;
      await service.createTab('https://second.example');
      const second = service.getState().activeTabId!;
      service.closeTab(first); service.closeTab(second);
      expect(service.listRecentlyClosedTabs().map((tab) => tab.id)).toEqual([second, first]);
      await service.reopenClosedTab(first);
      expect(service.getState().url).toBe('https://first.example/');
      expect(service.listRecentlyClosedTabs().map((tab) => tab.id)).toEqual([second]);
      const create = vi.spyOn(service, 'createTab').mockRejectedValueOnce(new Error('Navegación bloqueada'));
      await expect(service.reopenClosedTab(second)).rejects.toThrow('bloqueada');
      expect(service.listRecentlyClosedTabs()).toHaveLength(1);
      create.mockRestore();
      await service.clearHistory();
      expect(service.listRecentlyClosedTabs()).toEqual([]);
      expect(service.getState().canReopenClosedTab).toBe(false);
    } finally { service.detachWindow(); }
  });

  it('no rellena una contraseña si la página cambia mientras espera a la bóveda', async () => {
    let resolveSecret!: (value: { metadata: { id: string; origin: string; username: string; createdAt: string; updatedAt: string }; password: string }) => void;
    const vault = { resolveSecret: vi.fn(() => new Promise((resolve) => { resolveSecret = resolve; })) };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://login.example');
      service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
      const filling = service.fillCredential('credencial').then(() => null, (error: Error) => error);
      await service.navigate('https://other.example');
      resolveSecret({ metadata: { id: 'credencial', origin: 'https://login.example', username: 'ejemplo', createdAt: '', updatedAt: '' }, password: 'Secreto-ficticio' });
      expect(await filling).toMatchObject({ message: expect.stringContaining('cambió') });
      expect(browserViewHarness.instances[0].webContents.insertText).not.toHaveBeenCalled();
    } finally { service.detachWindow(); }
  });

  it('devuelve el origen normalizado y no prepara un guardado para otro sitio', async () => {
    const vault = { list: vi.fn(async () => []), prepareSave: vi.fn() };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://login.example/ruta');
      expect(await service.listCredentials()).toEqual({ credentials: [], credentialOrigin: 'https://login.example', credentialAutosaveEnabled: false });
      expect(() => service.saveCredential({ username: 'cuenta', password: 'ficticia', expectedOrigin: 'https://anterior.example' })).toThrow('sitio cambió');
      expect(vault.prepareSave).not.toHaveBeenCalled();
    } finally { service.detachWindow(); }
  });

  it('no accede a la bóveda mientras el agente controla la página', async () => {
    const vault = { list: vi.fn(), prepareSave: vi.fn(), resolveSecret: vi.fn(), analyzeHealth: vi.fn(), remove: vi.fn() };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://login.example');
      service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
      await service.openForAgent();
      await expect(service.listCredentials()).rejects.toThrow('Toma el control');
      await expect(service.analyzeCredentialHealth()).rejects.toThrow('Toma el control');
      await expect(service.fillCredential('credencial')).rejects.toThrow('Toma el control');
      await expect(service.removeCredential('credencial')).rejects.toThrow('Toma el control');
      expect(() => service.saveCredential({ username: 'cuenta', password: 'ficticia', expectedOrigin: 'https://login.example' })).toThrow('Toma el control');
      for (const method of Object.values(vault)) expect(method).not.toHaveBeenCalled();
    } finally { service.releaseAgentControl(); service.detachWindow(); }
  });

  it('habilitar sugerencias requiere confirmación nativa y un contexto vigente', async () => {
    const vault = { getAutosaveEnabled: vi.fn(async () => false), setAutosaveEnabled: vi.fn(async () => {}) };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://login.example');
      await flushPermissionQueue();
      expect(await service.setCredentialAutosave(true)).toMatchObject({ canceled: true, credentialAutosaveEnabled: false });
      expect(vault.setAutosaveEnabled).not.toHaveBeenCalled();
      vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
        await service.createTab('https://otro.example');
        return { response: 1, checkboxChecked: false };
      });
      await expect(service.setCredentialAutosave(true)).rejects.toThrow('cambió');
      expect(vault.setAutosaveEnabled).not.toHaveBeenCalled();
      vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
      expect(await service.setCredentialAutosave(true)).toMatchObject({ canceled: false, credentialAutosaveEnabled: true });
      expect(vault.setAutosaveEnabled).toHaveBeenCalledWith(true, expect.any(Function));
      expect(await service.setCredentialAutosave(false)).toMatchObject({ credentialAutosaveEnabled: false });
    } finally { service.detachWindow(); }
  });

  it('cancelar una preferencia durante el arranque conserva el opt-in persistido', async () => {
    let finishLoad!: (enabled: boolean) => void;
    const vault = { getAutosaveEnabled: vi.fn().mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishLoad = resolve; }))
      .mockResolvedValue(true), setAutosaveEnabled: vi.fn() };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://login.example');
      await flushPermissionQueue();
      expect(await service.setCredentialAutosave(true)).toEqual({ canceled: true, credentialAutosaveEnabled: true });
      finishLoad(false);
      await flushPermissionQueue();
      expect((service as unknown as { credentialAutosaveEnabled: boolean }).credentialAutosaveEnabled).toBe(true);
      expect(vault.setAutosaveEnabled).not.toHaveBeenCalled();
    } finally { service.detachWindow(); }
  });

  it.each(['agent', 'tab', 'origin-return', 'consent'] as const)('descarta una sugerencia si cambia %s durante el diálogo', async (change) => {
    const commit = vi.fn(async () => ({ id: 'credencial' }));
    const vault = { getAutosaveEnabled: vi.fn(async () => false), prepareSave: vi.fn(async () => ({
      origin: 'https://login.example', username: 'cuenta', updating: false, unchanged: false, commit,
    })) };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    const internals = service as unknown as {
      credentialAutosaveEnabled: boolean; credentialAutosaveRevision: number;
      getActiveTab: () => unknown; offerCredential: (tab: unknown, candidate: { origin: string; username: string; password: string }) => Promise<void>;
    };
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://login.example');
      service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
      await flushPermissionQueue();
      internals.credentialAutosaveEnabled = true;
      vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
        if (change === 'agent') await service.openForAgent();
        if (change === 'tab') await service.createTab('https://login.example');
        if (change === 'origin-return') {
          const contents = browserViewHarness.instances[0].webContents;
          contents.emit('did-start-navigation', {}, 'https://otro.example', false, true);
          contents.emit('did-start-navigation', {}, 'https://login.example', false, true);
        }
        if (change === 'consent') internals.credentialAutosaveRevision++;
        return { response: 1, checkboxChecked: false };
      });
      await internals.offerCredential(internals.getActiveTab(), { origin: 'https://login.example', username: 'cuenta', password: 'ficticia' });
      expect(dialog.showMessageBox).toHaveBeenCalled();
      expect(commit).not.toHaveBeenCalled();
    } finally { service.releaseAgentControl(); service.detachWindow(); }
  });

  it('descarta una lista de credenciales si cambia la pestaña mientras lee', async () => {
    let finish!: (value: never[]) => void;
    const vault = { list: vi.fn(() => new Promise<never[]>((resolve) => { finish = resolve; })) };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://login.example');
      const reading = service.listCredentials().then(() => null, (error: Error) => error);
      await service.createTab('https://other.example');
      finish([]);
      expect(await reading).toMatchObject({ message: expect.stringContaining('cambió') });
    } finally { service.detachWindow(); }
  });

  it('una redirección previa a revisar conserva el origen del candidato SSO', async () => {
    const commit = vi.fn(async () => ({ id: 'credencial' }));
    const vault = { getAutosaveEnabled: vi.fn(async () => false), prepareSave: vi.fn(async () => {
      await service.navigate('https://destino.example/');
      return { origin: 'https://login.example', username: 'cuenta', updating: false, unchanged: false, commit };
    }) };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    const internals = service as unknown as {
      credentialAutosaveEnabled: boolean; getActiveTab: () => unknown;
      offerCredential: (tab: unknown, candidate: { origin: string; username: string; password: string }) => Promise<void>;
    };
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://login.example'); service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
      await flushPermissionQueue(); internals.credentialAutosaveEnabled = true;
      vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
      await internals.offerCredential(internals.getActiveTab(), { origin: 'https://login.example', username: 'cuenta', password: 'ficticia' });
      expect(vault.prepareSave).toHaveBeenCalledWith('https://login.example', expect.any(Object));
      expect(commit).toHaveBeenCalledOnce();
      const calls = vi.mocked(dialog.showMessageBox).mock.calls as unknown as Array<[BrowserWindow, { detail?: string }]>;
      const options = calls[calls.length - 1][1];
      expect(options.detail).toContain('https://login.example');
      expect(options.detail).toContain('aunque hayas sido redirigido');
      expect(options.detail).not.toContain('ficticia');
    } finally { service.detachWindow(); }
  });

  it.each(['navigation', 'tab', 'window'] as const)('no confirma una actualización después de cambiar el contexto: %s', async (change) => {
    const commit = vi.fn(async () => ({ id: 'credencial' }));
    const vault = { prepareSave: vi.fn(async () => ({ origin: 'https://login.example', username: 'cuenta', updating: true, commit })) };
    const service = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
    service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://login.example');
      vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
        if (change === 'navigation') await service.navigate('https://login.example/otra');
        if (change === 'tab') await service.createTab('https://login.example');
        if (change === 'window') service.detachWindow();
        return { response: 1, checkboxChecked: false };
      });
      await expect(service.saveCredential({ username: 'cuenta', password: 'ficticia', expectedOrigin: 'https://login.example' })).rejects.toThrow('cambió');
      expect(commit).not.toHaveBeenCalled();
    } finally { service.detachWindow(); }
  });

  it('aplica el bloqueo del agente antes de DOM, captura, documento y acción', async () => {
    const previous = process.env.BROWSER_AGENT_GOVERNANCE_ENABLED;
    process.env.BROWSER_AGENT_GOVERNANCE_ENABLED = 'true';
    const policyPath = path.join(os.tmpdir(), `soflia-agent-policy-${randomUUID()}.json`);
    const policies = new BrowserAgentPolicyStore(policyPath);
    await policies.set({ origin: 'https://mail.example', mode: 'strict', decision: 'block' });
    const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, undefined, undefined, policies);
    try {
      service.attachWindow(new BrowserWindow());
      await service.open('https://mail.example/inbox');
      service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
      await expect(service.getObservation(true)).rejects.toThrow(/no tiene permiso/i);
      await expect(service.captureVisiblePage()).rejects.toThrow(/no tiene permiso/i);
      await expect(service.readActiveDocument()).rejects.toThrow(/no tiene permiso/i);
      await expect(service.clickElement('dom-1')).rejects.toThrow(/no tiene permiso/i);
      expect(browserViewHarness.instances[0].webContents.capturePage).not.toHaveBeenCalled();
      // La captura local del menú no debe crear otro permiso ni bloquear la UI.
      await expect(service.captureVisibleBackdrop()).resolves.toHaveProperty('screenshot');
    } finally {
      service.detachWindow();
      await fs.rm(policyPath, { force: true });
      if (previous === undefined) delete process.env.BROWSER_AGENT_GOVERNANCE_ENABLED;
      else process.env.BROWSER_AGENT_GOVERNANCE_ENABLED = previous;
    }
  });

  it('invalida autorizaciones si la página cambia y nunca persiste permitir una vez', async () => {
    const previous = process.env.BROWSER_AGENT_GOVERNANCE_ENABLED;
    process.env.BROWSER_AGENT_GOVERNANCE_ENABLED = 'true';
    const policyPath = path.join(os.tmpdir(), `soflia-agent-once-${randomUUID()}.json`);
    const policies = new BrowserAgentPolicyStore(policyPath);
    await policies.set({ origin: 'https://example.com', mode: 'strict', decision: 'ask' });
    const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, undefined, undefined, policies);
    const window = new BrowserWindow();
    const prompts: Array<{ id: string }> = [];
    vi.mocked(window.webContents.send).mockImplementation((channel, value) => { if (channel === 'integrated-browser:agent-policy-prompt') prompts.push(value); });
    try {
      service.attachWindow(window);
      await service.open('https://example.com');
      service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
      const once = service.authorizeAgentTarget('capture');
      await vi.waitFor(() => expect(prompts).toHaveLength(1));
      service.resolveAgentPolicyPrompt(prompts[0].id, 'allow-once');
      await expect(once).resolves.toMatchObject({ contents: browserViewHarness.instances[0].webContents, assertCurrent: expect.any(Function) });
      expect((await policies.get('https://example.com')).decision).toBe('ask');
      const pending = service.authorizeAgentTarget('act').then(() => null, (error: Error) => error);
      await vi.waitFor(() => expect(prompts).toHaveLength(2));
      await service.navigate('https://other.example');
      service.resolveAgentPolicyPrompt(prompts[1].id, 'allow-always');
      expect(await pending).toMatchObject({ message: expect.stringContaining('cambió') });
      expect((await policies.get('https://example.com')).decision).toBe('ask');
    } finally {
      service.detachWindow();
      await fs.rm(policyPath, { force: true });
      if (previous === undefined) delete process.env.BROWSER_AGENT_GOVERNANCE_ENABLED;
      else process.env.BROWSER_AGENT_GOVERNANCE_ENABLED = previous;
    }
  });

  it('carga la política empresarial antes de navegar y bloquea crear pestañas restringidas', async () => {
    const previous = process.env.BROWSER_ENTERPRISE_CONTROLS_ENABLED;
    process.env.BROWSER_ENTERPRISE_CONTROLS_ENABLED = 'true';
    const policyPath = path.join(os.tmpdir(), `soflia-enterprise-${randomUUID()}.json`);
    const policies = new BrowserEnterprisePolicyStore(policyPath);
    await policies.apply({ version: 1, blockedOrigins: ['https://blocked.example'], forcedPrivacyLevel: null, extensionsAllowed: false, agentAllowed: false, historyRetentionDays: null }, 'revision-1');
    const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, undefined, undefined, undefined, undefined, policies);
    try {
      service.attachWindow(new BrowserWindow());
      await expect(service.open('https://blocked.example')).rejects.toThrow('organización');
      await expect(service.createTab('https://blocked.example')).rejects.toThrow('organización');
      await service.open('https://example.com');
      await expect(service.authorizeAgentTarget('capture')).rejects.toThrow('organización');
      await expect(service.prepareExtensionInstall()).rejects.toThrow('organización');
      expect(service.getRuntimeDiagnostic().managed).toBe(true);
    } finally {
      service.detachWindow();
      await fs.rm(policyPath, { force: true });
      if (previous === undefined) delete process.env.BROWSER_ENTERPRISE_CONTROLS_ENABLED;
      else process.env.BROWSER_ENTERPRISE_CONTROLS_ENABLED = previous;
    }
  });

  it('la protección empresarial funciona con flags locales apagados y no permite excepciones', async () => {
    const f = await enterpriseFixture();
    await f.privacy.set({ origin: 'https://app.example', level: 'off', exceptionCategories: ['tracker', 'third-party-cookie'] });
    f.service.attachWindow(new BrowserWindow());
    await f.service.open('https://app.example');
    const contents = browserViewHarness.instances[0].webContents;
    const hooks = networkHooks(contents);
    expect(hooks.requests.onBeforeRequest).toHaveBeenCalledTimes(1);
    const site = await f.service.getPrivacySite();
    expect(site).toMatchObject({ level: 'strict', enabled: true, managed: true, exceptionCategories: [] });
    await expect(f.service.setPrivacySite({ level: 'off', exceptionCategories: [] })).rejects.toThrow('organización');
    const result = vi.fn();
    hooks.before({ url: 'https://www.google-analytics.com/collect', webContents: contents, resourceType: 'xhr', method: 'GET' }, result);
    expect(result).toHaveBeenLastCalledWith({ cancel: true });
    hooks.send({ url: 'https://cdn.other.example/pixel', webContents: contents, resourceType: 'image', requestHeaders: { Cookie: 'ficticia', Referer: 'https://app.example' } }, result);
    expect(result).toHaveBeenLastCalledWith({ requestHeaders: { DNT: '1', 'Sec-GPC': '1' } });
    hooks.received({ url: 'https://cdn.other.example/pixel', webContents: contents, resourceType: 'image', responseHeaders: { 'Set-Cookie': ['ficticia'], 'Content-Type': ['image/png'] } }, result);
    expect(result).toHaveBeenLastCalledWith({ responseHeaders: { 'Content-Type': ['image/png'] } });
    expect(f.service.getRuntimeDiagnostic()).toMatchObject({ protectionLevel: 'strict', enterprisePolicyStatus: 'ready' });
    expect(await f.service.getAgentPolicy()).toMatchObject({ managed: true, decision: 'block' });
    await expect(f.service.openForAgent()).rejects.toThrow('organización');
    expect(f.service.getState().agentControlling).toBe(false);
  });

  it('bloquea HTTP(S) administrado en cada fase y conserva cabeceras sin privacidad activa', async () => {
    const f = await enterpriseFixture({ forcedPrivacyLevel: null });
    f.service.attachWindow(new BrowserWindow()); await f.service.open('https://app.example');
    const contents = browserViewHarness.instances[0].webContents;
    const hooks = networkHooks(contents);
    for (const hook of [hooks.before, hooks.send, hooks.received]) {
      for (const resourceType of ['mainFrame', 'subFrame', 'xhr', 'script', 'other']) {
        const result = vi.fn();
        hook({ url: 'https://blocked.example/ruta', resourceType, requestHeaders: {}, responseHeaders: {} }, result);
        expect(result).toHaveBeenCalledExactlyOnceWith({ cancel: true });
      }
    }
    const result = vi.fn();
    hooks.before({ url: 'https://app.example/?utm_source=conservar', resourceType: 'mainFrame', method: 'GET' }, result);
    expect(result).toHaveBeenLastCalledWith({});
    hooks.send({ url: 'https://cdn.other.example/pixel', requestHeaders: { Cookie: 'ficticia' } }, result);
    expect(result).toHaveBeenLastCalledWith({ requestHeaders: { Cookie: 'ficticia' } });
    hooks.received({ url: 'https://cdn.other.example/pixel', responseHeaders: { 'Set-Cookie': ['ficticia'] } }, result);
    expect(result).toHaveBeenLastCalledWith({ responseHeaders: { 'Set-Cookie': ['ficticia'] } });
    f.service.detachWindow();
    hooks.before({ url: 'https://app.example', resourceType: 'mainFrame' }, result);
    expect(result).toHaveBeenLastCalledWith({ cancel: true });
  });

  it('espera la política antes de mutar privacidad, agente, retención o instalar extensiones', async () => {
    const f = await enterpriseFixture();
    const status = await f.policies.getStatus();
    let release!: (value: typeof status) => void;
    vi.spyOn(f.policies, 'getStatus').mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const privacySet = vi.spyOn(f.privacy, 'set'); const agentSet = vi.spyOn(f.agents, 'set');
    f.service.attachWindow(new BrowserWindow());
    const operations = [
      f.service.setPrivacySite({ origin: 'https://app.example', level: 'off', exceptionCategories: [] }),
      f.service.setAgentPolicy({ origin: 'https://app.example', mode: 'balanced', decision: 'allow-always' }),
      f.service.setHistoryRetention(null), f.service.prepareExtensionInstall(),
    ].map((operation) => operation.then(() => null, (error: Error) => error));
    await flushPermissionQueue();
    expect(privacySet).not.toHaveBeenCalled(); expect(agentSet).not.toHaveBeenCalled();
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    expect(f.service.getRuntimeDiagnostic().enterprisePolicyStatus).toBe('loading');
    release(status);
    for (const operation of operations) expect(await operation).toMatchObject({ message: expect.stringContaining('organización') });
    expect(privacySet).not.toHaveBeenCalled(); expect(agentSet).not.toHaveBeenCalled();
  });

  it('conserva el nivel local más estricto y no publica una política vieja tras cambiar de ventana', async () => {
    const f = await enterpriseFixture({ forcedPrivacyLevel: 'balanced' });
    await f.privacy.set({ origin: 'https://app.example', level: 'strict', exceptionCategories: [] });
    const status = await f.policies.getStatus();
    let release!: (value: typeof status) => void;
    vi.spyOn(f.policies, 'getStatus').mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    f.service.attachWindow(new BrowserWindow());
    const stale = f.service.getPrivacySite('https://app.example').then(() => null, (error: Error) => error);
    f.service.attachWindow(new BrowserWindow());
    await f.service.open('https://app.example');
    release({ ...status, policy: null });
    expect(await stale).toMatchObject({ message: expect.stringContaining('cambió') });
    expect(await f.service.getPrivacySite()).toMatchObject({ level: 'strict', managed: true, enabled: true });
    await expect(f.service.createTab('https://blocked.example')).rejects.toThrow('organización');
  });

  it('falla cerrado ante error empresarial y reintenta sin publicar éxito falso', async () => {
    const f = await enterpriseFixture();
    vi.spyOn(f.policies, 'getStatus').mockRejectedValueOnce(new Error('No se puede verificar la política empresarial.'));
    f.service.attachWindow(new BrowserWindow());
    await expect(f.service.getPrivacySite('https://app.example')).rejects.toThrow('verificar');
    expect(f.service.getRuntimeDiagnostic()).toMatchObject({ enterprisePolicyStatus: 'error', managed: false });
    expect(await f.service.getPrivacySite('https://app.example')).toMatchObject({ managed: true });
    expect(f.service.getRuntimeDiagnostic().enterprisePolicyStatus).toBe('ready');
  });

  it('invalida la tarea al salir y volver a la misma pestaña, incluso con la misma URL', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://example.com');
      const first = service.getState().activeTabId!;
      const guard = service.createAgentTargetGuard();
      await service.createTab('https://example.com');
      service.activateTab(first);
      expect(guard).toThrow('cambió');
    } finally { service.detachWindow(); }
  });

  it('la navegación propia conserva la tarea pero invalida su captura incluso si vuelve a la URL inicial', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://example.com');
      const task = service.createAgentTargetGuard(); const page = service.createAgentTargetGuard(undefined, true);
      const contents = browserViewHarness.instances[0].webContents;
      contents.emit('did-navigate-in-page'); contents.emit('did-navigate-in-page');
      expect(task).not.toThrow(); expect(page).toThrow('cambió');
    } finally { service.detachWindow(); }
  });

  it('la autorización pendiente cancelada no persiste un permiso ni acepta respuestas tardías', async () => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true');
    const policyPath = path.join(os.tmpdir(), `soflia-agent-cancel-${randomUUID()}.json`);
    const policies = new BrowserAgentPolicyStore(policyPath);
    await policies.set({ origin: 'https://example.com', mode: 'strict', decision: 'ask' });
    const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, undefined, undefined, policies);
    const window = new BrowserWindow(); const prompts: Array<{ id: string }> = [];
    vi.mocked(window.webContents.send).mockImplementation((channel, value) => { if (channel === 'integrated-browser:agent-policy-prompt') prompts.push(value); });
    try {
      service.attachWindow(window); await service.open('https://example.com');
      const abort = new AbortController();
      const pending = service.authorizeAgentTarget('act', abort.signal).then(() => null, (error: Error) => error);
      await vi.waitFor(() => expect(prompts).toHaveLength(1));
      abort.abort();
      expect(await pending).toMatchObject({ message: 'Tarea cancelada.' });
      expect(service.getState().agentPolicyPromptIds).toEqual([]);
      expect(window.webContents.send).toHaveBeenCalledWith('integrated-browser:state-changed', expect.objectContaining({ agentPolicyPromptIds: [] }));
      expect(service.resolveAgentPolicyPrompt(prompts[0].id, 'allow-always')).toBe(false);
      expect((await policies.get('https://example.com')).decision).toBe('ask');
      expect(browserViewHarness.instances[0].webContents.sendInputEvent).not.toHaveBeenCalled();
    } finally { service.detachWindow(); await fs.rm(policyPath, { force: true }); vi.unstubAllEnvs(); }
  });

  it('cambiar la política invalida una autorización anterior sin esperar otra acción', async () => {
    const policyPath = path.join(os.tmpdir(), `soflia-agent-revoke-${randomUUID()}.json`);
    const policies = new BrowserAgentPolicyStore(policyPath);
    const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, undefined, undefined, policies);
    try {
      service.attachWindow(new BrowserWindow()); await service.open('https://example.com');
      const authorized = await service.authorizeAgentTarget('act');
      await service.setAgentPolicy({ mode: 'strict', decision: 'block' });
      expect(authorized.assertCurrent).toThrow('cambió');
    } finally { service.detachWindow(); await fs.rm(policyPath, { force: true }); }
  });

  it('no carga otra pestaña si cambia el destino al esperar la política de navegación', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://example.com');
      await service.createTab('https://other.example');
      const tabs = service.getState().tabs;
      service.activateTab(tabs[0].id);
      const guard = service.createAgentTargetGuard();
      const pending = service.navigate('https://unrequested.example', guard).then(() => null, (error: Error) => error);
      service.activateTab(tabs[1].id);
      expect(await pending).toMatchObject({ message: expect.stringContaining('cambió') });
      for (const view of browserViewHarness.instances) expect(view.webContents.loadURL).not.toHaveBeenCalledWith('https://unrequested.example/');
    } finally { service.detachWindow(); }
  });

  it('bloquea rastreadores, limpia parámetros y cookies de terceros antes de enviarlos', async () => {
    const previous = process.env.BROWSER_PRIVACY_PROTECTION_ENABLED;
    process.env.BROWSER_PRIVACY_PROTECTION_ENABLED = 'true';
    const privacyPath = path.join(os.tmpdir(), `soflia-privacy-${randomUUID()}.json`);
    const privacy = new BrowserPrivacyStore(privacyPath);
    await privacy.get('https://app.example');
    const service = new IntegratedBrowserService(undefined, undefined, undefined, undefined, newStore(), undefined, undefined, undefined, undefined, privacy);
    try {
      service.attachWindow(new BrowserWindow());
      await service.open('https://app.example/');
      const webRequest = (browserViewHarness.instances[0].webContents.session as unknown as { webRequest: {
        onBeforeRequest: ReturnType<typeof vi.fn>;
        onBeforeSendHeaders: ReturnType<typeof vi.fn>;
      } }).webRequest;
      const beforeRequest = webRequest.onBeforeRequest.mock.calls[0][1] as (details: Record<string, unknown>, callback: (result: Record<string, unknown>) => void) => void;
      const trackerResult = vi.fn();
      const contents = browserViewHarness.instances[0].webContents;
      beforeRequest({ url: 'https://www.google-analytics.com/collect', webContents: contents, resourceType: 'xhr', method: 'GET' }, trackerResult);
      expect(trackerResult).toHaveBeenCalledWith({ cancel: true });

      const parameterResult = vi.fn();
      beforeRequest({ url: 'https://app.example/page?id=7&utm_source=mail', webContents: contents, resourceType: 'mainFrame', method: 'GET' }, parameterResult);
      expect(parameterResult).toHaveBeenCalledWith({ redirectURL: 'https://app.example/page?id=7' });

      const beforeHeaders = webRequest.onBeforeSendHeaders.mock.calls[0][1] as (details: Record<string, unknown>, callback: (result: { requestHeaders: Record<string, string> }) => void) => void;
      const headerResult = vi.fn();
      beforeHeaders({ url: 'https://cdn.other.example/pixel', webContents: contents, resourceType: 'image', requestHeaders: { Cookie: 'id=secret' } }, headerResult);
      expect(headerResult.mock.calls[0][0].requestHeaders).toMatchObject({ DNT: '1', 'Sec-GPC': '1' });
      expect(headerResult.mock.calls[0][0].requestHeaders).not.toHaveProperty('Cookie');
      const navigationHeaders = vi.fn();
      beforeHeaders({ url: 'https://login.other.example/auth', webContents: contents, resourceType: 'mainFrame', requestHeaders: { Cookie: 'login=session' } }, navigationHeaders);
      expect(navigationHeaders.mock.calls[0][0].requestHeaders.Cookie).toBe('login=session');
      const signedResource = vi.fn();
      beforeRequest({ url: 'https://cdn.other.example/asset?utm_source=signed&signature=123', webContents: contents, resourceType: 'script', method: 'GET' }, signedResource);
      expect(signedResource).toHaveBeenCalledWith({});
      await privacy.set({ origin: 'https://app.example', level: 'off', exceptionCategories: [] });
      const offHeaders = vi.fn();
      beforeHeaders({ url: 'https://cdn.other.example/pixel', webContents: contents, resourceType: 'image', requestHeaders: { Cookie: 'id=secret' } }, offHeaders);
      expect(offHeaders).toHaveBeenCalledWith({ requestHeaders: { Cookie: 'id=secret' } });
    } finally {
      service.detachWindow();
      await fs.rm(privacyPath, { force: true });
      if (previous === undefined) delete process.env.BROWSER_PRIVACY_PROTECTION_ENABLED;
      else process.env.BROWSER_PRIVACY_PROTECTION_ENABLED = previous;
    }
  });

  it('no interactua sin pestaña visible ni mientras el actuador visual controla', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://mail.example/inbox');

    await expect(service.clickElement('dom-1')).rejects.toThrow(/pestaña visible/i);

    // Instalar el vigia de seleccion al cargar, o apagar el menu flotante al
    // tomar el control, no es interactuar con la pagina: son piezas propias.
    browserViewHarness.instances[0].webContents.executeJavaScript.mockClear();
    service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
    await service.openForAgent();
    await expect(service.clickElement('dom-1')).rejects.toThrow(/controlado por otra tarea/i);
    const guiones = browserViewHarness.instances[0].webContents.executeJavaScript.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(guiones.every((guion: string) => /SelectionMenu|WritingPanel|sofliaSelWatch/.test(guion))).toBe(true);
    service.detachWindow();
  });

  it('no reporta como error la navegacion que el propio sitio reemplaza', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://www.youtube.com/watch?v=video');
    const contents = browserViewHarness.instances[0].webContents;

    // YouTube reescribe su URL al arrancar y aborta la carga en curso.
    contents.loadURL.mockRejectedValueOnce(new Error("ERR_ABORTED (-3) loading 'https://www.youtube.com/watch?v=video&sttick=0'"));
    await expect(service.navigate('https://www.youtube.com/watch?v=video')).resolves.toBeTruthy();
    expect(service.getState().error).toBeNull();

    contents.loadURL.mockRejectedValueOnce(new Error('ERR_NAME_NOT_RESOLVED (-105) loading https://inexistente.example'));
    await expect(service.navigate('https://inexistente.example')).rejects.toThrow();
    expect(service.getState().error).toMatch(/ERR_NAME_NOT_RESOLVED/);
    service.detachWindow();
  });

  it('captura exclusivamente la pagina visible para el turno multimodal', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    await expect(service.captureVisiblePage()).rejects.toThrow(/no esta visible/i);

    service.setViewport({ x: 200, y: 80, width: 800, height: 600 });

    await expect(service.captureVisiblePage()).resolves.toBe('data:image/jpeg;base64,Y2FwdHVyYQ==');
    expect(browserViewHarness.instances[0].webContents.capturePage).toHaveBeenCalled();
  });

  it('descarta la observacion al ocultar y nunca reutiliza la de otra pestaña', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://primaria.example');
    const first = browserViewHarness.instances[0].webContents;
    first.executeJavaScript.mockResolvedValue({
      title: 'Primaria', url: 'https://primaria.example/', language: 'es', text: 'Primaria',
      headings: [], landmarks: [], controls: [], frames: [],
      viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 600 }, truncated: false,
    });
    service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
    expect((await service.getObservation(true)).observation?.dom.title).toBe('Primaria');

    await service.createTab('https://secundaria.example', false);
    const second = browserViewHarness.instances[1].webContents;
    second.executeJavaScript.mockRejectedValue(new Error('DOM no disponible'));
    service.activateTab(service.getState().tabs[1].id);
    expect((await service.getObservation(true)).observation).toBeNull();

    service.activateTab(service.getState().tabs[0].id);
    expect((await service.getObservation(false)).observation?.dom.title).toBe('Primaria');
    service.hide();
    expect((await service.getObservation(false)).observation).toBeNull();
    service.detachWindow();
  });

  it('bloquea popups peligrosos y convierte HTTP(S) en una pestaña interna', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const handler = contents.setWindowOpenHandler.mock.calls[0][0];

    expect(handler({ url: 'https://safe.example/path' })).toEqual({ action: 'deny' });
    await vi.waitFor(() => expect(browserViewHarness.instances).toHaveLength(2));
    expect(browserViewHarness.instances[1].webContents.loadURL).toHaveBeenCalledWith('https://safe.example/path');
    expect(handler({ url: 'javascript:alert(1)' })).toEqual({ action: 'deny' });
    expect(service.getState().error).toMatch(/protocolo no permitido/i);
  });

  it('la barrera de cierre espera la escritura y no vuelve a guardar al desmontar', async () => {
    const { service, store } = await sessionFixture(null);
    service.attachWindow(new BrowserWindow());
    await store.load();
    await service.open('https://guardar.example/');
    let finish!: () => void;
    const save = vi.spyOn(store, 'save').mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    let completed = false;
    const pending = service.flushSessionForShutdown().then(() => { completed = true; });
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(completed).toBe(false);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ cleanExit: true }));
    finish();
    await pending;
    service.commitShutdown();
    service.detachWindow();
    expect(save).toHaveBeenCalledOnce();
  });

  it('purga el perfil efímero y espera sus colas al cerrar la ventana', async () => {
    vi.stubEnv('BROWSER_SESSION_RESTORE_ENABLED', 'true');
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://temporal.example/');
    const root = browserProfileRoot();
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, 'marcador-temporal.txt'), 'no debe sobrevivir', 'utf8');

    service.detachWindow();
    await service.flushSessionForShutdown();

    await expect(fs.stat(root)).rejects.toMatchObject({ code: 'ENOENT' });
    const partition = vi.mocked(session.fromPartition).mock.results
      .map((result) => result.value as { clearStorageData?: ReturnType<typeof vi.fn> })
      .find((value) => Boolean(value?.clearStorageData));
    expect(partition?.clearStorageData).toHaveBeenCalled();
  });

  it('conserva el perfil si se cancela beforeunload y lo purga tras cerrar de verdad', async () => {
    vi.stubEnv('BROWSER_SESSION_RESTORE_ENABLED', 'true');
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://apagado.example/');
    const root = browserProfileRoot();
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, 'credencial-temporal.txt'), 'no debe sobrevivir', 'utf8');

    await service.flushSessionForShutdown();
    service.commitShutdown();
    await service.flushClosedProfileForShutdown();
    expect((await fs.stat(root)).isDirectory()).toBe(true);
    service.resumeAfterShutdown();
    await service.open('https://continuar.example/');
    expect((await fs.stat(root)).isDirectory()).toBe(true);
    service.commitShutdown();
    service.detachWindow();
    await service.flushClosedProfileForShutdown();
    await expect(fs.stat(root)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['guest', 'private'] as const)('una escritura tardía no sobrevive al cierre ni se cruza con la reapertura: %s', async (kind) => {
    vi.stubEnv('BROWSER_MAIN_BOOKMARKS_ENABLED', 'true');
    vi.stubEnv('BROWSER_SESSION_RESTORE_ENABLED', 'false');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-ephemeral-io-'));
    const originalGetPath = vi.mocked(app.getPath).getMockImplementation()!;
    const paths = vi.spyOn(app, 'getPath').mockImplementation((name) => name === 'temp' || name === 'userData' ? root : originalGetPath(name));
    if (kind === 'private') setBrowserScopeId(browserPrivateScopeId());
    const service = newService();
    const profileRoot = browserProfileRoot();
    const authFile = path.join(browserProfileRoot(browserScopeIdFor('cuenta-conservada')), 'test.txt');
    const originalRename = fs.rename;
    let release!: () => void;
    let entered = false;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const rename = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (String(to) === path.join(profileRoot, 'bookmarks.json') && !entered) { entered = true; await held; }
      return originalRename(from, to);
    });
    let writing: Promise<unknown> | undefined;
    let opening: Promise<unknown> | undefined;
    try {
      await fs.mkdir(path.dirname(authFile), { recursive: true });
      await fs.writeFile(authFile, 'persistente', 'utf8');
      service.attachWindow(new BrowserWindow());
      await service.open('https://anterior.example/');
      writing = service.saveBookmark({ url: 'https://temporal.example/', title: 'Temporal' });
      await vi.waitFor(() => expect(entered).toBe(true));
      service.detachWindow();
      const viewCount = browserViewHarness.instances.length;
      service.attachWindow(new BrowserWindow());
      opening = service.open('https://nueva.example/');
      expect(() => service.saveBookmark({ url: 'https://no-debe.example/', title: 'Bloqueado' })).toThrow(/limpiándose/);
      await new Promise((resolve) => setImmediate(resolve));
      expect(browserViewHarness.instances).toHaveLength(viewCount);
      release();
      await Promise.all([writing, opening]);
      expect(await service.listBookmarks()).toEqual([]);
      await expect(fs.stat(profileRoot)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await fs.readFile(authFile, 'utf8')).toBe('persistente');
      await service.saveBookmark({ url: 'https://nuevo.example/', title: 'Nuevo' });
      expect((await service.listBookmarks()).map((bookmark) => bookmark.title)).toEqual(['Nuevo']);
    } finally {
      release();
      await Promise.allSettled([writing, opening]);
      rename.mockRestore();
      service.detachWindow();
      await service.flushClosedProfileForShutdown();
      paths.mockRestore();
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('un fallo de limpieza no se anuncia como éxito y se puede reintentar sin restauración habilitada', async () => {
    vi.stubEnv('BROWSER_SESSION_RESTORE_ENABLED', 'false');
    setBrowserScopeId(browserPrivateScopeId());
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://temporal.example/');
    const ephemeral = session.fromPartition(browserPartitionFor());
    const clear = vi.spyOn(ephemeral, 'clearCache').mockRejectedValueOnce(new Error('fallo privado'));
    service.detachWindow();
    await expect(service.flushClosedProfileForShutdown()).rejects.toThrow('No se pudo completar');
    await service.flushSessionForShutdown();
    expect(clear).toHaveBeenCalledTimes(2);
    clear.mockRestore();
    service.attachWindow(new BrowserWindow());
    await service.open('https://recuperado.example/');
    service.detachWindow();
    await service.flushClosedProfileForShutdown();
  });

  it('un permiso del SO tardío no escribe en la cuenta que acaba de entrar', async () => {
    await withPlatform('darwin', async () => {
      const store = newStore();
      const service = newService(store);
      service.attachWindow(new BrowserWindow());
      await service.open('https://llamada.example/');
      const set = vi.spyOn(store, 'set');
      vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValue('not-determined');
      let finish!: (granted: boolean) => void;
      vi.mocked(systemPreferences.askForMediaAccess).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
      const pending = service.setSitePermission({ kind: 'camera', state: 'granted' }).catch((error: Error) => error);
      await vi.waitFor(() => expect(systemPreferences.askForMediaAccess).toHaveBeenCalledOnce());
      await service.applyUserScope('cuenta-entrante');
      finish(true);
      expect(await pending).toBeInstanceOf(Error);
      expect(set).not.toHaveBeenCalled();
      service.detachWindow();
    });
  });

  it('incluye cambios de pestañas durante la escritura antes de confirmar el cierre', async () => {
    const { service, store } = await sessionFixture(null);
    service.attachWindow(new BrowserWindow());
    await store.load();
    await service.open('https://primera.example/');
    let finish!: () => void;
    const saving = vi.spyOn(store, 'save').mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const pending = service.flushSessionForShutdown();
    await vi.waitFor(() => expect(saving).toHaveBeenCalledOnce());
    await service.createTab('https://ultima.example/');
    finish();
    await pending;
    expect(saving).toHaveBeenCalledTimes(2);
    expect((await store.load())?.tabs.map((tab) => tab.url)).toEqual(['https://primera.example/', 'https://ultima.example/']);
    service.resumeAfterShutdown();
  });

  it('la barrera espera un guardado de una ventana que ya se cerró', async () => {
    const { service, store } = await sessionFixture(null);
    service.attachWindow(new BrowserWindow());
    await store.load();
    await service.open('https://guardar.example/');
    let finish!: () => void;
    vi.spyOn(store, 'save').mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    service.detachWindow();
    let completed = false;
    const pending = service.flushSessionForShutdown().then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish();
    await pending;
  });

  it('un guardado fallido de una ventana cerrada impide confirmar el cierre', async () => {
    const { service, store } = await sessionFixture(null);
    service.attachWindow(new BrowserWindow());
    await store.load();
    await service.open('https://guardar.example/');
    const saving = vi.spyOn(store, 'save').mockRejectedValueOnce(new Error('disco ocupado'));
    service.detachWindow();
    await expect(service.flushSessionForShutdown()).rejects.toThrow('disco ocupado');
    await service.flushSessionForShutdown();
    expect(saving).toHaveBeenCalledTimes(2);
    expect((await store.load())?.tabs[0].url).toBe('https://guardar.example/');
    service.resumeAfterShutdown();
  });

  it('cancelar mientras carga la sesión no inicia un guardado tardío', async () => {
    const { service, store } = await sessionFixture(null);
    let finish!: (value: BrowserSessionSnapshot | null) => void;
    vi.spyOn(store, 'load').mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const saving = vi.spyOn(store, 'save');
    service.attachWindow(new BrowserWindow());
    await service.open('https://guardar.example/');
    const pending = service.flushSessionForShutdown();
    const rejected = expect(pending).rejects.toThrow(/sesión cambió/i);
    service.resumeAfterShutdown();
    finish(null);
    await rejected;
    expect(saving).not.toHaveBeenCalled();
  });

  it('una ventana separada no cancela la salida aprobada, pero vuelve a integrarse tras cancelarla', async () => {
    const { service } = await sessionFixture();
    service.attachWindow(new BrowserWindow());
    await service.restorePreviousSession();
    service.commitShutdown();
    const close = vi.fn();
    detachedWindowHarness.instances[0].emit('close', { preventDefault: close });
    expect(close).not.toHaveBeenCalled();
    service.resumeAfterShutdown();
    detachedWindowHarness.instances[0].emit('close', { preventDefault: close });
    expect(close).toHaveBeenCalledOnce();
    expect(service.getState().tabs.every((tab) => !tab.isDetached)).toBe(true);
  });

  it('la barrera mantiene sin consumir la recuperación todavía no elegida', async () => {
    const { service, store } = await sessionFixture();
    service.attachWindow(new BrowserWindow());
    await service.open('https://actual.example/');
    const save = vi.spyOn(store, 'save');
    await service.flushSessionForShutdown();
    service.commitShutdown();
    service.detachWindow();
    expect(save).not.toHaveBeenCalled();
    expect((await store.load())?.tabs).toHaveLength(12);
  });

  it('restaura división, ventana separada, grupos y silencio sin cargar las pestañas de fondo', async () => {
    const { service, store } = await sessionFixture();
    service.attachWindow(new BrowserWindow());
    await vi.waitFor(() => expect(service.getState().restoreAvailable?.tabCount).toBe(12));
    expect(browserViewHarness.instances).toHaveLength(0);
    await service.restorePreviousSession();
    service.setViewport({ x: 10, y: 20, width: 1000, height: 700 });
    const state = service.getState();
    expect(state).toMatchObject({ viewMode: 'split', tabLayout: 'vertical', restoreAvailable: null });
    expect(state.primaryTabId).toBe(state.tabs[0].id);
    expect(state.secondaryTabId).toBe(state.tabs[1].id);
    expect(state.activeTabId).toBe(state.tabs[1].id);
    expect(state.tabs[0].pinned).toBe(true);
    expect(state.tabs[1].muted).toBe(true);
    expect(state.tabs[2].isDetached).toBe(true);
    expect(state.tabs.slice(3).every((tab) => tab.isSuspended)).toBe(true);
    expect(state.groups[0].name).toBe('Trabajo');
    expect(state.tabs.every((tab) => tab.groupId === 'grupo')).toBe(true);
    expect(browserViewHarness.instances).toHaveLength(3);
    expect(detachedWindowHarness.instances).toHaveLength(1);
    const muted = browserViewHarness.instances.find((view) => view.webContents.getURL() === state.tabs[1].url)!;
    expect((muted.webContents as unknown as { setAudioMuted: ReturnType<typeof vi.fn> }).setAudioMuted).toHaveBeenCalledWith(true);
    service.detachWindow();
    const persisted = await store.load();
    expect(persisted).toMatchObject({ version: 2, cleanExit: true, viewMode: 'split', tabLayout: 'vertical' });
    expect(persisted?.detachedTabIds).toEqual([state.tabs[2].id]);
    expect(persisted?.activeTabId).toBe(state.tabs[1].id);
    expect(detachedWindowHarness.instances[0].destroy).toHaveBeenCalled();
  });

  it('retira pantalla completa y ventanas antiguas al restaurar otra sesión', async () => {
    const { service } = await sessionFixture();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://actual.example/');
    service.setViewport({ x: 10, y: 20, width: 1000, height: 700 });
    service.toggleFullscreen();
    expect(window.isFullScreen()).toBe(true);
    await service.restorePreviousSession();
    expect(service.getState().isFullscreen).toBe(false);
    expect(window.isFullScreen()).toBe(false);
    expect(browserViewHarness.instances[0].webContents.close).toHaveBeenCalled();
    expect(service.getState().tabs.every((tab) => tab.url.startsWith('https://restaurada.example/'))).toBe(true);
  });

  it('restaura 500 pestañas de forma perezosa y protege división y ventanas al suspender', async () => {
    const { service } = await sessionFixture(savedSession(500));
    service.attachWindow(new BrowserWindow());
    await service.restorePreviousSession();
    service.setViewport({ x: 0, y: 0, width: 1000, height: 700 });
    const initial = service.getState();
    expect(initial.tabs).toHaveLength(500);
    expect(browserViewHarness.instances).toHaveLength(3);
    for (const tab of initial.tabs.slice(3, 14)) service.activateTab(tab.id);
    const state = service.getState();
    expect(state.tabs.filter((tab) => !tab.isSuspended)).toHaveLength(8);
    expect(state.tabs[1].isSuspended).toBe(false);
    expect(state.tabs[2]).toMatchObject({ isDetached: true, isSuspended: false });
    const suspended = state.tabs.find((tab) => tab.isSuspended)!;
    service.activateTab(suspended.id);
    expect(service.getState().tabs.find((tab) => tab.id === suspended.id)?.isSuspended).toBe(false);
    expect(browserViewHarness.instances[browserViewHarness.instances.length - 1]?.webContents.loadURL).toHaveBeenCalledWith(suspended.url);
  });

  it('no sobrescribe la sesión pendiente al navegar o cerrar sin elegir restaurar', async () => {
    const { service, store } = await sessionFixture();
    const save = vi.spyOn(store, 'save');
    service.attachWindow(new BrowserWindow());
    await vi.waitFor(() => expect(service.getState().restoreAvailable).not.toBeNull());
    await service.open('https://nueva.example/');
    service.detachWindow();
    expect(save).not.toHaveBeenCalled();
    expect((await store.load())?.tabs).toHaveLength(12);
  });

  it('no guarda sobre una lectura inicial pendiente ni publica una carga de otro perfil', async () => {
    const { service, store } = await sessionFixture(null);
    let finish!: (snapshot: BrowserSessionSnapshot | null) => void;
    const pending = new Promise<BrowserSessionSnapshot | null>((resolve) => { finish = resolve; });
    vi.spyOn(store, 'load').mockReturnValueOnce(pending).mockResolvedValueOnce(null);
    const save = vi.spyOn(store, 'save');
    service.attachWindow(new BrowserWindow());
    await service.open('https://anterior.example/');
    await service.applyUserScope('cuenta-b');
    expect(save).not.toHaveBeenCalled();
    finish(savedSession());
    await pending;
    await Promise.resolve();
    expect(service.getState().restoreAvailable).toBeNull();
    expect(service.getState().tabs).toEqual([]);
  });

  it('no restaura una lectura tardía después de cerrar y adjuntar otra ventana', async () => {
    const { service, store } = await sessionFixture(null);
    let finish!: (snapshot: BrowserSessionSnapshot | null) => void;
    vi.spyOn(store, 'load').mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(null);
    service.attachWindow(new BrowserWindow());
    const restoring = service.restorePreviousSession();
    const rejected = expect(restoring).rejects.toThrow(/sesión cambió/i);
    service.detachWindow();
    service.attachWindow(new BrowserWindow());
    finish(savedSession());
    await rejected;
    expect(service.getState().restoreAvailable).toBeNull();
    expect(service.getState().tabs).toEqual([]);
  });

  it('conserva el aviso de restauración cuando falla descartar y permite reintentar', async () => {
    const { service, store } = await sessionFixture();
    service.attachWindow(new BrowserWindow());
    await vi.waitFor(() => expect(service.getState().restoreAvailable).not.toBeNull());
    vi.spyOn(store, 'clear').mockRejectedValueOnce(new Error('disco ocupado'));
    await expect(service.discardPreviousSession()).rejects.toThrow('disco ocupado');
    expect(service.getState().restoreAvailable?.tabCount).toBe(12);
    await service.discardPreviousSession();
    expect(service.getState().restoreAvailable).toBeNull();
    expect((await store.load())?.tabs).toEqual([]);
  });

  it('guarda la sesión saliente antes de desmontar sus pestañas por cambio de cuenta', async () => {
    const { service, store } = await sessionFixture(null);
    service.attachWindow(new BrowserWindow());
    await store.load();
    await service.open('https://saliente.example/');
    const save = vi.spyOn(store, 'save');
    await service.applyUserScope('cuenta-destino');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      cleanExit: true, tabs: [expect.objectContaining({ url: 'https://saliente.example/' })],
    }));
    expect(service.getState().tabs).toEqual([]);
  });

  it('bloquea nuevas vistas durante el guardado de cambio de cuenta y gana la última transición', async () => {
    const { service, store } = await sessionFixture(null);
    service.attachWindow(new BrowserWindow());
    await store.load();
    await service.open('https://origen.example/');
    let finish!: () => void;
    vi.spyOn(store, 'save').mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const firstTransition = service.applyUserScope('cuenta-b');
    await expect(service.open('https://no-abrir.example/')).rejects.toThrow(/perfil está cambiando/i);
    await expect(service.createTab('https://no-abrir.example/')).rejects.toThrow(/perfil está cambiando/i);
    expect(service.getState().tabs).toEqual([]);
    await service.applyUserScope('cuenta-c');
    finish();
    await firstTransition;
    await service.open('https://destino.example/');
    expect(browserViewHarness.instances[browserViewHarness.instances.length - 1].options?.webPreferences?.partition)
      .toBe(browserPartitionFor(browserScopeIdFor('cuenta-c')));
  });

  it('mantiene el bloqueo si falla cerrar el historial del perfil anterior y admite reintento', async () => {
    const { service } = await sessionFixture(null);
    service.attachWindow(new BrowserWindow());
    const history = (service as unknown as { historyStore: { flushAndClose: ReturnType<typeof vi.fn> } }).historyStore;
    history.flushAndClose.mockRejectedValueOnce(new Error('historial ocupado'));
    await expect(service.applyUserScope('cuenta-b')).rejects.toThrow('historial ocupado');
    await expect(service.open('https://no-abrir.example/')).rejects.toThrow(/perfil está cambiando/i);
    await service.applyUserScope('cuenta-b');
    await service.open('https://destino.example/');
    expect(service.getState().url).toBe('https://destino.example/');
  });

  it('selecciona para división una pestaña integrada y nunca una ventana separada', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://separada.example/');
    const detached = service.getState().activeTabId!;
    service.detachTab(detached);
    const workspace = service.getState().tabs.find((tab) => !tab.isDetached)!.id;
    service.activateTab(workspace);
    await service.setViewMode('split');
    const state = service.getState();
    expect(state.viewMode).toBe('split');
    expect(state.secondaryTabId).not.toBe(detached);
    expect(state.tabs.find((tab) => tab.id === state.secondaryTabId)?.isDetached).toBe(false);
    service.detachWindow();
  });

  it('aísla perfiles invitado y privado y conserva el destino autenticado', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    vi.stubEnv('BROWSER_PROFILES_ENABLED', 'true');
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    expect(service.getProfile()).toMatchObject({ kind: 'guest', persistent: false });
    await service.applyUserScope('usuario-perfil');
    expect(service.getProfile()).toMatchObject({ kind: 'authenticated', persistent: true });
    const authenticatedScope = browserScopeIdFor('usuario-perfil');
    const privateProfile = await service.setProfileKind('private');
    expect(privateProfile).toMatchObject({ kind: 'private', persistent: false });
    await service.open('https://privado.example');
    const privateView = browserViewHarness.instances[browserViewHarness.instances.length - 1];
    const privatePartition = privateView?.options?.webPreferences?.partition;
    expect(privatePartition).toBe(browserPartitionFor(privateProfile.id));
    expect(String(privatePartition)).not.toMatch(/^persist:/);
    expect(service.getState().tabs).toHaveLength(1);
    await service.setProfileKind('authenticated');
    expect(service.getProfile()).toMatchObject({ kind: 'authenticated', id: authenticatedScope });
    expect(service.getState().tabs).toHaveLength(0);
    service.detachWindow();
  });

  it('mantiene dos pestañas vivas en división, enfoca el objetivo y libera solo la cerrada', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://primaria.example');
    const firstId = service.getState().activeTabId!;
    await service.createTab('https://secundaria.example');
    const secondId = service.getState().activeTabId!;
    service.activateTab(firstId);
    await service.setViewMode('split', secondId);
    service.setViewport({ x: 100, y: 80, width: 900, height: 600 });

    expect(service.getState()).toMatchObject({ viewMode: 'split', activeTabId: firstId, secondaryTabId: secondId });
    expect(browserViewHarness.instances[0].setBounds).toHaveBeenLastCalledWith({ x: 100, y: 80, width: 447, height: 600 });
    expect(browserViewHarness.instances[1].setBounds).toHaveBeenLastCalledWith({ x: 553, y: 80, width: 447, height: 600 });
    browserViewHarness.instances[1].webContents.emit('focus');
    expect(service.getState().activeTabId).toBe(secondId);
    expect(service.getViewportSize()).toEqual({ width: 447, height: 600 });

    service.closeTab(secondId);
    expect(browserViewHarness.instances[1].webContents.close).toHaveBeenCalled();
    expect(browserViewHarness.instances[0].webContents.close).not.toHaveBeenCalled();
    expect(service.getState()).toMatchObject({ viewMode: 'single', activeTabId: firstId });
  });

  it('separa y reintegra la misma vista sin recargar ni cambiar de sesión', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://example.com/transcripcion');
    service.setViewport({ x: 100, y: 80, width: 900, height: 600 });
    const tabId = service.getState().activeTabId!;
    const view = browserViewHarness.instances[0];
    view.webContents.loadURL.mockClear();

    const detachedState = service.detachTab(tabId);

    expect(detachedWindowHarness.instances).toHaveLength(1);
    const detached = detachedWindowHarness.instances[0];
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(view);
    expect(detached.contentView.addChildView).toHaveBeenCalledWith(view);
    expect(detachedState.tabs.find((tab) => tab.id === tabId)?.isDetached).toBe(true);
    expect(view.webContents.loadURL).not.toHaveBeenCalled();
    expect(service.getViewportSize()).toEqual({ width: 1024, height: 768 });
    await expect(service.captureVisiblePage()).resolves.toContain('data:image/jpeg');

    window.emit('focus');
    expect(service.getState().activeTabId).not.toBe(tabId);
    detached.emit('focus');
    expect(service.getState().activeTabId).toBe(tabId);

    const preventDefault = vi.fn();
    detached.emit('close', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(window.contentView.addChildView).toHaveBeenLastCalledWith(view);
    expect(detached.destroy).toHaveBeenCalled();
    expect(service.getState().tabs.find((tab) => tab.id === tabId)?.isDetached).toBe(false);
    expect(view.webContents.loadURL).not.toHaveBeenCalled();
  });

  it('acota ventanas separadas y conserva el límite global de ocho vistas vivas', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/0');
    service.setViewport({ x: 0, y: 0, width: 1200, height: 800 });
    const ids = [service.getState().activeTabId!];
    for (let index = 1; index < 5; index += 1) {
      await service.createTab(`https://example.com/${index}`);
      ids.push(service.getState().activeTabId!);
    }
    for (const id of ids.slice(0, 4)) service.detachTab(id);
    for (let index = 5; index < 13; index += 1) await service.createTab(`https://example.com/${index}`, false);

    expect(detachedWindowHarness.instances).toHaveLength(4);
    expect(() => service.detachTab(ids[4])).toThrow(/hasta 4 ventanas separadas/i);
    const tabs = service.getState().tabs;
    expect(tabs.filter((tab) => !tab.isSuspended)).toHaveLength(8);
    expect(ids.slice(0, 4).every((id) => tabs.find((tab) => tab.id === id)?.isDetached && !tabs.find((tab) => tab.id === id)?.isSuspended)).toBe(true);
  });

  it('virtualiza vistas inactivas, conserva 500 pestañas lógicas y aplica el límite', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    await expect(service.createTab('javascript:alert(1)')).rejects.toThrow(/protocolo/i);
    await expect(service.createTab('https://usuario:secreto@example.com')).rejects.toThrow(/credenciales incrustadas/i);
    expect(browserViewHarness.instances).toHaveLength(1);

    for (let index = 1; index < 500; index += 1) await service.createTab(`https://example.com/${index}`, false);
    const tabs = service.getState().tabs;
    expect(tabs).toHaveLength(500);
    expect(tabs.filter((tab) => !tab.isSuspended)).toHaveLength(8);
    expect(tabs.find((tab) => tab.id === service.getState().activeTabId)?.isSuspended).toBe(false);
    const suspended = tabs.find((tab) => tab.isSuspended)!;
    service.activateTab(suspended.id);
    expect(service.getState().tabs.find((tab) => tab.id === suspended.id)?.isSuspended).toBe(false);
    expect(browserViewHarness.instances[browserViewHarness.instances.length - 1]?.webContents.loadURL).toHaveBeenCalledWith(suspended.url);
    await expect(service.createTab('https://example.com/limite')).rejects.toThrow(/hasta 500 pestañas/i);
    expect(browserViewHarness.instances.filter((view) => !view.webContents.close.mock.calls.length)).toHaveLength(8);
  });

  it('rechaza certificados no verificados sin ofrecer bypass desde el renderer', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const verify = browserViewHarness.instances[0].webContents.session.setCertificateVerifyProc.mock.calls[0][0] as (request: { verificationResult?: string }, callback: (result: number) => void) => void;
    const callback = vi.fn();
    verify({ verificationResult: 'CERT_COMMON_NAME_INVALID' }, callback);
    expect(callback).toHaveBeenLastCalledWith(-2);
    verify({ verificationResult: 'OK' }, callback);
    expect(callback).toHaveBeenLastCalledWith(-3);
  });

  it('publica avisos locales por pestaña sin compartir referencias mutables', async () => {
    const service = newService();
    const parent = new BrowserWindow();
    service.attachWindow(parent);
    await service.open('http://example.com/');
    const first = service.getState().activeTabId!;
    expect(service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'warn', source: 'local', reason: 'La conexión no está cifrada.' });
    const copy = service.getState().tabs[0].navigationSafety!;
    copy.reason = 'No debe cambiar main';
    expect(service.getState().tabs[0].navigationSafety?.reason).toBe('La conexión no está cifrada.');
    await service.createTab('https://example.com/');
    expect(service.getState().tabs.find((tab) => tab.id !== first)?.navigationSafety).toMatchObject({ action: 'allow', source: 'local' });
    expect(service.getState().tabs.find((tab) => tab.id === first)?.navigationSafety?.action).toBe('warn');
    expect(vi.mocked(parent.webContents.send)).toHaveBeenCalledWith('integrated-browser:state-changed', expect.objectContaining({
      tabs: expect.arrayContaining([expect.objectContaining({ id: first, navigationSafety: expect.objectContaining({ action: 'warn' }) })]),
    }));
    service.detachWindow();
  });

  it('muestra proveedor degradado y bloqueo sin cargar el destino bloqueado', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/');
    const safety = vi.spyOn(navigationSafety, 'checkBrowserNavigation');
    safety.mockResolvedValueOnce({ action: 'allow', source: 'degraded', reason: 'Sólo revisión local.', checkedAt: new Date(0).toISOString() });
    await service.navigate('https://example.com/degradada');
    expect(service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'allow', source: 'degraded' });
    safety.mockResolvedValueOnce({ action: 'block', source: 'remote', reason: 'El proveedor bloqueó la navegación.', checkedAt: new Date(0).toISOString() });
    await expect(service.navigate('https://example.com/bloqueada')).rejects.toThrow('El proveedor bloqueó');
    expect(browserViewHarness.instances[0].webContents.loadURL).not.toHaveBeenCalledWith('https://example.com/bloqueada');
    expect(service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'block', source: 'remote' });
    safety.mockRestore();
    await service.navigate('https://example.com/nueva');
    expect(service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'allow', source: 'local', reason: null });
    service.detachWindow();
  });

  it('el bloqueo cubre la vista nativa y no permite usar la página oculta como destino interactivo', async () => {
    const service = newService(); const window = new BrowserWindow(); service.attachWindow(window);
    await service.open('https://example.com/'); service.setViewport({ x: 0, y: 80, width: 800, height: 500 });
    const content = browserViewHarness.instances[0];
    vi.spyOn(navigationSafety, 'checkBrowserNavigation').mockResolvedValueOnce({ action: 'block', source: 'remote', reason: 'Sitio bloqueado.', checkedAt: new Date(0).toISOString() });
    await expect(service.navigate('https://blocked.example.com/')).rejects.toThrow('bloque');
    const overlay = browserViewHarness.instances[browserViewHarness.instances.length - 1];
    expect(overlay).not.toBe(content); expect(content.setVisible).toHaveBeenLastCalledWith(false);
    expect(() => service.getWebContentsForAgent()).toThrow('no esta disponible');
    expect(overlay.webContents.loadURL).toHaveBeenCalledWith(expect.stringMatching(/^data:text\/html/));
    overlay.webContents.emit('will-navigate', { url: 'https://browser-safety.invalid/blank', preventDefault: vi.fn() });
    await vi.waitFor(() => expect(content.webContents.loadURL).toHaveBeenCalledWith('about:blank'));
    expect(service.getState().tabs[0].navigationSafety?.action).toBe('allow');
    expect(content.setVisible).toHaveBeenLastCalledWith(true); expect(overlay.webContents.close).toHaveBeenCalled();
    service.detachWindow();
  });

  it('no retira el intersticial por cambios de hash ni por eventos tardíos del documento rechazado', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/'); service.setViewport({ x: 0, y: 80, width: 800, height: 500 });
    const view = browserViewHarness.instances[0];
    vi.spyOn(navigationSafety, 'checkBrowserNavigation').mockResolvedValueOnce({ action: 'block', source: 'remote', reason: 'Bloqueado.', checkedAt: new Date(0).toISOString() });
    await expect(service.navigate('https://blocked.example.com/')).rejects.toThrow();
    const overlay = browserViewHarness.instances[browserViewHarness.instances.length - 1];
    view.webContents.getURL.mockReturnValue('https://example.com/#fragmento');
    for (const event of ['did-navigate-in-page', 'did-navigate', 'did-stop-loading']) view.webContents.emit(event);
    expect(service.getState().tabs[0].navigationSafety?.action).toBe('block');
    expect(overlay.webContents.close).not.toHaveBeenCalled(); expect(view.setVisible).toHaveBeenLastCalledWith(false);
    service.detachWindow();
  });

  it('rechaza certificados y presenta un aviso aislado en pestañas y ventanas adoptadas', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/'); service.setViewport({ x: 0, y: 80, width: 800, height: 500 });
    const contents = browserViewHarness.instances[0].webContents; const deny = vi.fn();
    contents.emit('certificate-error', {}, 'https://example.com/', 'ERR_CERT_AUTHORITY_INVALID', {}, deny, true);
    expect(deny).toHaveBeenCalledWith(false);
    expect(service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'block', source: 'local', reason: expect.stringContaining('certificado') });
    const popup = new BrowserWindow(); contents.emit('did-create-window', popup); deny.mockClear();
    const eventMock = popup.webContents.on as unknown as ReturnType<typeof vi.fn>;
    const certificateListener = eventMock.mock.calls.find(([event]) => event === 'certificate-error')?.[1] as (...args: unknown[]) => void;
    certificateListener({}, 'https://example.com/', 'ERR_CERT_DATE_INVALID', {}, deny, true);
    expect(deny).toHaveBeenCalledWith(false);
    expect(popup.contentView.addChildView).toHaveBeenCalledWith(browserViewHarness.instances[browserViewHarness.instances.length - 1]);
    service.detachWindow();
  });

  it('muestra bloqueos empresariales de enlaces y solicitudes locales sin consultar al proveedor', async () => {
    const f = await enterpriseFixture(); f.service.attachWindow(new BrowserWindow()); await f.service.open('https://example.com/');
    f.service.setViewport({ x: 0, y: 80, width: 800, height: 500 });
    const contents = browserViewHarness.instances[0].webContents; const preventDefault = vi.fn();
    contents.emit('will-navigate', { url: 'https://blocked.example/', preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(f.service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'block', reason: expect.stringContaining('organización') });
    await f.service.navigate('https://example.com/permitida');
    vi.stubEnv('BROWSER_SAFE_BROWSING_BLOCKED_HOSTS', 'local-block.example');
    const callback = vi.fn(); networkHooks(contents).before({ url: 'https://local-block.example/', resourceType: 'mainFrame', webContents: contents }, callback);
    expect(callback).toHaveBeenCalledWith({ cancel: true });
    expect(f.service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'block', source: 'local', reason: expect.stringContaining('lista local') });
  });

  it('una respuesta degradada de un adjunto no elimina un bloqueo vigente', async () => {
    const f = await sessionFixture(null); f.service.attachWindow(new BrowserWindow());
    await f.service.applyUserScope('titular-reputacion'); await f.service.open('https://example.com/');
    const contents = browserViewHarness.instances[0].webContents; const hooks = networkHooks(contents);
    vi.stubEnv('BROWSER_SAFE_BROWSING_ENDPOINT', 'https://safe.example/check');
    const fetcher = vi.fn(async () => new Response('{"action":"block"}')); vi.stubGlobal('fetch', fetcher);
    try {
      const blocked = vi.fn(); hooks.before({ url: 'https://blocked.example.com/', webContents: contents, resourceType: 'subFrame', method: 'GET' }, blocked);
      await vi.waitFor(() => expect(blocked).toHaveBeenCalledWith({ cancel: true }));
      fetcher.mockRejectedValueOnce(new Error('Proveedor sin conexión.'));
      const attachment = vi.fn(); hooks.received({ id: 33, url: 'https://files.example.com/', webContents: contents, resourceType: 'xhr', responseHeaders: { 'Content-Disposition': ['attachment'] } }, attachment);
      await vi.waitFor(() => expect(attachment).toHaveBeenCalled());
      expect(f.service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'block', source: 'remote' });
    } finally { vi.unstubAllGlobals(); }
  });

  it('revisa enlaces, marcos, redirecciones y adjuntos antes de autorizarlos sin enviar rutas', async () => {
    const f = await sessionFixture(null); f.service.attachWindow(new BrowserWindow());
    await f.service.applyUserScope('titular-reputacion'); await f.service.open('https://example.com/');
    const contents = browserViewHarness.instances[0].webContents; const hooks = networkHooks(contents);
    vi.stubEnv('BROWSER_SAFE_BROWSING_ENDPOINT', 'https://safe.example/check');
    const fetcher = vi.fn(async () => new Response('{"action":"block","reason":"dato arbitrario"}')); vi.stubGlobal('fetch', fetcher);
    try {
      for (const resourceType of ['mainFrame', 'subFrame', 'other']) {
        const callback = vi.fn(); hooks.before({ url: 'https://blocked.example.com/private?token=no', webContents: contents, resourceType, method: 'GET' }, callback);
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ cancel: true })); expect(callback).toHaveBeenCalledTimes(1);
      }
      const callback = vi.fn(); hooks.received({ id: 3, url: 'https://files.example.com/export?token=no', webContents: contents, resourceType: 'xhr', responseHeaders: { 'Content-Disposition': ['attachment; filename="datos.csv"'] } }, callback);
      await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ cancel: true }));
      expect(fetcher).toHaveBeenCalledTimes(4);
      expect(JSON.stringify(fetcher.mock.calls)).not.toContain('token=no');
      expect(f.service.getState().tabs[0].navigationSafety).toMatchObject({ source: 'remote', action: 'block', reason: 'El proveedor bloqueó la navegación.' });
    } finally { vi.unstubAllGlobals(); }
  });

  it('una revisión tardía no autoriza la navegación sustituida ni cambia su aviso', async () => {
    const f = await sessionFixture(null); f.service.attachWindow(new BrowserWindow());
    await f.service.applyUserScope('titular-reputacion'); await f.service.open('https://example.com/');
    const contents = browserViewHarness.instances[0].webContents; const hooks = networkHooks(contents);
    vi.stubEnv('BROWSER_SAFE_BROWSING_ENDPOINT', 'https://safe.example/check');
    const responses: Array<(value: Response) => void> = [];
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => responses.push(resolve))); vi.stubGlobal('fetch', fetcher);
    try {
      const old = vi.fn(), next = vi.fn();
      hooks.before({ url: 'https://old.example.com/', webContents: contents, resourceType: 'mainFrame', method: 'GET' }, old);
      hooks.before({ url: 'https://new.example.com/', webContents: contents, resourceType: 'mainFrame', method: 'GET' }, next);
      responses[1](new Response('{"action":"warn"}')); await vi.waitFor(() => expect(next).toHaveBeenCalledWith({ cancel: false }));
      responses[0](new Response('{"action":"block"}')); await vi.waitFor(() => expect(old).toHaveBeenCalledWith({ cancel: true }));
      expect(f.service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'warn', source: 'remote' });
      expect(old).toHaveBeenCalledTimes(1); expect(next).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it('protege popups reales adoptados y aborta consultas al cerrar la ventana anfitriona', async () => {
    const f = await sessionFixture(null); f.service.attachWindow(new BrowserWindow());
    await f.service.applyUserScope('titular-reputacion'); await f.service.open('https://example.com/');
    const contents = browserViewHarness.instances[0].webContents; const hooks = networkHooks(contents);
    const popup = new BrowserWindow(); contents.emit('did-create-window', popup);
    vi.stubEnv('BROWSER_SAFE_BROWSING_ENDPOINT', 'https://safe.example/check');
    const fetcher = vi.fn(async () => new Response('{"action":"block"}')); vi.stubGlobal('fetch', fetcher);
    try {
      const popupResult = vi.fn(); hooks.before({ url: 'https://popup.example.com/', webContents: popup.webContents, resourceType: 'mainFrame', method: 'GET' }, popupResult);
      await vi.waitFor(() => expect(popupResult).toHaveBeenCalledWith({ cancel: true }));
      fetcher.mockImplementationOnce(() => new Promise(() => undefined));
      const pending = vi.fn(); hooks.before({ url: 'https://pending.example.com/', webContents: contents, resourceType: 'mainFrame', method: 'GET' }, pending);
      f.service.detachWindow(); await vi.waitFor(() => expect(pending).toHaveBeenCalledWith({ cancel: true }));
      expect(pending).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it('no consulta documentos de invitados ni destinos locales, y conserva advertencias al degradar', async () => {
    const f = await sessionFixture(null); f.service.attachWindow(new BrowserWindow());
    await f.service.applyUserScope(null); await f.service.open('https://example.com/');
    let contents = browserViewHarness.instances[browserViewHarness.instances.length - 1].webContents; let hooks = networkHooks(contents);
    vi.stubEnv('BROWSER_SAFE_BROWSING_ENDPOINT', 'https://safe.example/check');
    const fetcher = vi.fn(async () => { throw new Error('falla simulada'); }); vi.stubGlobal('fetch', fetcher);
    try {
      const guest = vi.fn(); hooks.before({ url: 'https://private.example.com/', webContents: contents, resourceType: 'mainFrame', method: 'GET' }, guest);
      expect(guest).toHaveBeenCalledWith({}); expect(fetcher).not.toHaveBeenCalled();
      await f.service.applyUserScope('titular-reputacion'); await f.service.open('http://localhost/');
      contents = browserViewHarness.instances[browserViewHarness.instances.length - 1].webContents; hooks = networkHooks(contents);
      const local = vi.fn(); hooks.before({ url: 'http://127.0.0.1/', webContents: contents, resourceType: 'mainFrame', method: 'GET' }, local);
      expect(local).toHaveBeenCalledWith({}); expect(fetcher).not.toHaveBeenCalled();
      const degraded = vi.fn(); hooks.before({ url: 'http://public.example.com/', webContents: contents, resourceType: 'mainFrame', method: 'GET' }, degraded);
      await vi.waitFor(() => expect(degraded).toHaveBeenCalledWith({ cancel: false }));
      expect(f.service.getState().tabs[0].navigationSafety).toMatchObject({ source: 'degraded', action: 'warn', reason: 'La conexión no está cifrada.' });
    } finally { vi.unstubAllGlobals(); }
  });

  it('actualiza avisos locales en enlaces, redirecciones y cambios de documento sin heredar reputación remota', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/');
    const contents = browserViewHarness.instances[0].webContents;
    const originalGetUrl = contents.getURL.getMockImplementation()!;
    for (const event of ['will-navigate', 'will-redirect']) {
      const preventDefault = vi.fn();
      contents.emit(event, { url: 'http://example.com/', isMainFrame: false, preventDefault });
      expect(service.getState().tabs[0].navigationSafety?.action).toBe('allow');
      contents.emit(event, { url: 'http://example.com/', isMainFrame: true, preventDefault });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(service.getState().tabs[0].navigationSafety?.action).toBe('warn');
      contents.getURL.mockReturnValue('https://example.com/otra');
      contents.emit('did-navigate');
      expect(service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'allow', source: 'local' });
    }
    contents.getURL.mockImplementation(originalGetUrl);
    const safety = vi.spyOn(navigationSafety, 'checkBrowserNavigation').mockResolvedValueOnce({ action: 'warn', source: 'remote', reason: 'Verifica el sitio.', checkedAt: new Date(0).toISOString() });
    await service.navigate('https://example.com/remota');
    expect(service.getState().tabs[0].navigationSafety?.source).toBe('remote');
    contents.getURL.mockReturnValue('http://example.com/otra');
    contents.emit('did-navigate-in-page');
    expect(service.getState().tabs[0].navigationSafety).toMatchObject({ action: 'warn', source: 'local', reason: 'La conexión no está cifrada.' });
    safety.mockRestore();
    service.detachWindow();
  });

  it.each(['tab', 'roundtrip', 'profile', 'document', 'window', 'newer', 'caller'] as const)('no navega con una revisión de seguridad obsoleta: %s', async (change) => {
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://example.com/inicial');
    const first = service.getState().activeTabId!;
    await service.createTab('https://example.com/segunda');
    const second = service.getState().activeTabId!;
    service.activateTab(first);
    const original = browserViewHarness.instances[0].webContents;
    const other = browserViewHarness.instances[1].webContents;
    let release!: (value: navigationSafety.BrowserNavigationSafetyVerdict) => void;
    const safety = vi.spyOn(navigationSafety, 'checkBrowserNavigation').mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    let callerValid = true;
    const pending = service.navigate('https://example.com/pendiente', () => {
      if (!callerValid) throw new Error('La tarea del agente fue cancelada.');
    }).then(() => null, (error: Error) => error);
    try {
      await vi.waitFor(() => expect(safety).toHaveBeenCalledOnce());
      if (change === 'tab' || change === 'roundtrip') service.activateTab(second);
      if (change === 'roundtrip') service.activateTab(first);
      if (change === 'profile') { await service.applyUserScope('otra-cuenta'); await service.applyUserScope(null); }
      if (change === 'document') original.emit('did-navigate', {}, 'https://example.com/externa', 200, 'OK');
      if (change === 'window') service.attachWindow(new BrowserWindow());
      if (change === 'newer') await service.navigate('https://example.com/reciente');
      if (change === 'caller') callerValid = false;
      release({ action: 'warn', source: 'remote', reason: 'Aviso obsoleto', checkedAt: new Date().toISOString() });
      expect(await pending).toBeInstanceOf(Error);
      expect(original.loadURL).not.toHaveBeenCalledWith('https://example.com/pendiente');
      expect(other.loadURL).not.toHaveBeenCalledWith('https://example.com/pendiente');
      expect(service.getState().tabs.some((tab) => tab.navigationSafety?.reason === 'Aviso obsoleto')).toBe(false);
    } finally { safety.mockRestore(); service.detachWindow(); }
  });

  it('aplica bloqueo local en red y redirecciones con privacidad/empresa apagadas', async () => {
    vi.stubEnv('BROWSER_PRIVACY_PROTECTION_ENABLED', 'false');
    vi.stubEnv('BROWSER_ENTERPRISE_CONTROLS_ENABLED', 'false');
    vi.stubEnv('BROWSER_SAFE_BROWSING_BLOCKED_HOSTS', 'blocked.example');
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const hooks = networkHooks(contents);
    for (const resourceType of ['mainFrame', 'subFrame', 'xhr']) {
      const result = vi.fn();
      hooks.before({ url: 'https://blocked.example/file', resourceType }, result);
      expect(result).toHaveBeenCalledExactlyOnceWith({ cancel: true });
    }
    for (const event of ['will-navigate', 'will-redirect']) {
      const preventDefault = vi.fn();
      contents.emit(event, { url: 'https://blocked.example', preventDefault });
      expect(preventDefault).toHaveBeenCalledOnce();
    }
    service.detachWindow();
  });

  it('cerrar sesión revoca el perfil al que volver y no carga extensiones efímeras', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    vi.stubEnv('BROWSER_PROFILES_ENABLED', 'true');
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.applyUserScope('cuenta-privada');
    await service.setProfileKind('private');
    await service.open('https://example.com');
    await expect(service.listExtensions()).resolves.toEqual([]);
    await expect(service.prepareExtensionInstall()).rejects.toThrow(/privados o de invitado/);
    await service.applyUserScope(null);
    await expect(service.setProfileKind('authenticated')).rejects.toThrow(/No hay una sesión autenticada/);
    service.detachWindow();
  });

  it('cancelar la confirmación conserva pestañas y perfil', async () => {
    vi.stubEnv('BROWSER_PROFILES_ENABLED', 'true');
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.applyUserScope('cuenta');
    await service.open('https://example.com');
    const before = service.getState().activeTabId;
    await expect(service.setProfileKind('private')).resolves.toMatchObject({ kind: 'authenticated' });
    expect(service.getState().activeTabId).toBe(before);
    expect(dialog.showMessageBox).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ defaultId: 0, cancelId: 0 }));
    service.detachWindow();
  });

  it('una confirmación tardía no cambia de perfil después del logout', async () => {
    vi.stubEnv('BROWSER_PROFILES_ENABLED', 'true');
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.applyUserScope('cuenta');
    let finish!: (result: Electron.MessageBoxReturnValue) => void;
    vi.mocked(dialog.showMessageBox).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = service.setProfileKind('private').catch((error: Error) => error);
    await expect(service.setProfileKind('guest')).rejects.toThrow(/confirmación/);
    await service.applyUserScope(null);
    finish({ response: 1, checkboxChecked: false });
    expect(await pending).toBeInstanceOf(Error);
    expect(service.getProfile().kind).toBe('guest');
    service.detachWindow();
  });

  it('ignora redirecciones de subframes y bloquea protocolos peligrosos en el frame principal', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://accounts.google.com/');
    const contents = browserViewHarness.instances[0].webContents;
    const preventSubframe = vi.fn();
    contents.emit('will-redirect', { url: 'custom-auth://callback', isMainFrame: false, preventDefault: preventSubframe });
    expect(preventSubframe).not.toHaveBeenCalled();
    expect(service.getState().error).toBeNull();

    // La verificacion en dos pasos redirige a direcciones de varios kilobytes:
    // acotarlas como si fueran entrada del usuario dejaba el login a medias.
    const preventAutenticacion = vi.fn();
    contents.emit('will-redirect', {
      url: `https://accounts.google.com/CheckCookie?TL=${'A'.repeat(3_000)}`,
      isMainFrame: true,
      preventDefault: preventAutenticacion,
    });
    expect(preventAutenticacion).not.toHaveBeenCalled();
    expect(service.getState().error).toBeNull();

    const preventMainFrame = vi.fn();
    contents.emit('will-redirect', { url: 'javascript:alert(1)', isMainFrame: true, preventDefault: preventMainFrame });
    expect(preventMainFrame).toHaveBeenCalled();
    expect(service.getState().error).toMatch(/redireccion fue bloqueada/i);
  });

  it('ignora eventos tardíos de una vista suspendida después de restaurarla', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://activa.example/');
    for (let index = 1; index <= 8; index += 1) await service.createTab(`https://inactiva.example/${index}`, false);
    const suspended = service.getState().tabs.find((tab) => tab.isSuspended)!;
    const retiredContents = browserViewHarness.instances.find((view) => view.webContents.close.mock.calls.length)?.webContents;

    service.activateTab(suspended.id);
    retiredContents?.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', suspended.url, true);

    expect(service.getState().activeTabId).toBe(suspended.id);
    expect(service.getState().error).toBeNull();
  });

  it('deniega permisos de dispositivo y exige aprobacion para media', async () => {
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    const avisos = answerPermissionPrompts(window, service, true);
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    const usbCallback = vi.fn();
    const mediaCallback = vi.fn();

    request(contents, 'usb', usbCallback, { requestingUrl: 'https://example.com' });
    request(contents, 'media', mediaCallback, { securityOrigin: 'https://example.com', mediaTypes: ['audio'] });
    await vi.waitFor(() => expect(mediaCallback).toHaveBeenCalledWith(true));

    expect(usbCallback).toHaveBeenCalledWith(false);
    // El aviso lo pinta el renderer, no un cuadro del sistema.
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({
      origin: 'https://example.com',
      kinds: ['microphone'],
      labels: ['Micrófono'],
    });
    expect(check(contents, 'media', 'https://example.com', { isMainFrame: true, mediaType: 'audio' })).toBe(true);
    // Un permiso de dispositivo nunca es configurable ni consultable.
    expect(check(contents, 'usb', 'https://example.com', { isMainFrame: true })).toBe(false);
  });

  it('reporta camara y microfono sin decidir como disponibles para permissions.query', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://meet.example/');
    const contents = browserViewHarness.instances[0].webContents;
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];

    // Sin esto, Google Meet leia "denied", mostraba "no puede usar el
    // microfono" y jamas llamaba a getUserMedia: el permiso no se podia
    // conceder nunca porque el dialogo no llegaba a abrirse.
    expect(check(contents, 'media', 'https://meet.example', { isMainFrame: true, mediaType: 'audio' })).toBe(true);
    expect(check(contents, 'media', 'https://meet.example', { isMainFrame: true, mediaType: 'video' })).toBe(true);
    // Lo que no se consulta antes de pedirlo sigue respondiendo que no.
    expect(check(contents, 'notifications', 'https://meet.example', { isMainFrame: true })).toBe(false);
  });

  it('no bloquea la consulta de media sin dispositivo ni la que llega sin origen', async () => {
    const store = newStore();
    const service = newService(store);
    service.attachWindow(new BrowserWindow());
    await service.open('https://meet.google.com/');
    const contents = browserViewHarness.instances[0].webContents;
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    contents.getURL.mockReturnValue('https://meet.google.com/call');

    // Chromium consulta `media` sin decir que dispositivo desde los marcos
    // embebidos. Responder que no dejaba a Meet leyendo camara y microfono como
    // bloqueados y abortando el arranque con StartupCode 219 al iniciar la
    // llamada desde Gmail.
    expect(check(contents, 'media', 'https://meet.google.com', {})).toBe(true);
    // Y a veces ni siquiera manda el origen: el del webContents es el respaldo.
    expect(check(contents, 'media', '', { mediaType: 'audio' })).toBe(true);

    // Electron entrega `webContents = null` para un iframe de origen cruzado.
    // Meet vive bajo mail.google.com con este formato: la identidad se valida
    // mediante los orígenes que Electron aporta, no mediante una instancia que
    // deliberadamente no está disponible.
    expect(check(null, 'media', '', {
      embeddingOrigin: 'https://mail.google.com',
      securityOrigin: 'https://meet.google.com',
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(true);
    expect(check(null, 'background-sync', 'https://meet.google.com', {
      embeddingOrigin: 'https://mail.google.com',
      isMainFrame: false,
    })).toBe(true);
    // Electron 43 también entrega el preflight de Meet sin webContents ni
    // ninguno de los orígenes opcionales. La sesión ya está aislada y este
    // `true` solo permite llegar a la solicitud real gobernada.
    expect(check(null, 'media', '', {
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(true);
    expect(check(null, 'media', '', {})).toBe(true);
    expect(check(null, 'media', '', undefined)).toBe(true);
    // Electron 43.3 puede entregar `undefined` aunque el contrato tipado documente
    // la identidad ausente como `null`; ambos valores representan el mismo preflight.
    expect(check(undefined as never, 'media', '', {
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(true);
    // Si sí existe un origen explícito inválido, el respaldo anónimo no aplica.
    expect(check(null, 'media', 'devtools://devtools', {
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(false);
    expect(check(null, 'media', '', {
      securityOrigin: 'devtools://devtools',
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(false);
    expect(check(undefined as never, 'media', '', {
      requestingOrigin: 'devtools://devtools',
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(false);
    expect(check(null, 'background-sync', 'https://meet.google.com', {
      embeddingOrigin: 'devtools://devtools',
      isMainFrame: false,
    })).toBe(false);

    // Una ventana abierta por Gmail nace en `about:blank` y puede consultar
    // media antes de comprometer la URL de Meet. Esto solo habilita que haga la
    // solicitud real; el request handler sigue exigiendo origen y aprobacion.
    contents.getURL.mockReturnValue('about:blank');
    expect(check(contents, 'media', '', { mediaType: 'audio' })).toBe(true);

    // Lo que el usuario denego sigue denegado por ambas vias.
    await store.set('https://meet.google.com', 'microphone', 'denied');
    await store.set('https://meet.google.com', 'camera', 'denied');
    await store.warmUp();
    expect(check(contents, 'media', 'https://meet.google.com', {})).toBe(false);
    contents.getURL.mockReturnValue('https://meet.google.com/call');
    expect(check(contents, 'media', '', { mediaType: 'audio' })).toBe(false);
    expect(check(null, 'media', '', {
      embeddingOrigin: 'https://mail.google.com',
      securityOrigin: 'https://meet.google.com',
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(false);
  });

  it('respeta una decision guardada sin volver a preguntar', async () => {
    const store = newStore();
    await store.set('https://guardado.example', 'microphone', 'granted');
    await store.set('https://guardado.example', 'camera', 'denied');
    const service = newService(store);
    service.attachWindow(new BrowserWindow());
    await service.open('https://guardado.example/');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    const micCallback = vi.fn();
    const camCallback = vi.fn();

    request(contents, 'media', micCallback, { securityOrigin: 'https://guardado.example', mediaTypes: ['audio'] });
    request(contents, 'media', camCallback, { securityOrigin: 'https://guardado.example', mediaTypes: ['video'] });
    await flushPermissionQueue();

    expect(micCallback).toHaveBeenCalledWith(true);
    expect(camCallback).toHaveBeenCalledWith(false);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(check(contents, 'media', 'https://guardado.example', { mediaType: 'video' })).toBe(false);
  });

  it('concede camara y microfono a una pestaña no activa de la misma particion', async () => {
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    answerPermissionPrompts(window, service, true);
    await service.open('https://activa.example/');
    await service.createTab('https://reunion.example/', false);
    const activeContents = browserViewHarness.instances[0].webContents;
    const backgroundContents = browserViewHarness.instances[1].webContents;
    const request = activeContents.session.setPermissionRequestHandler.mock.calls[0][0];
    const check = activeContents.session.setPermissionCheckHandler.mock.calls[0][0];
    const mediaCallback = vi.fn();

    request(backgroundContents, 'media', mediaCallback, {
      securityOrigin: 'https://reunion.example',
      mediaTypes: ['audio', 'video'],
    });
    await vi.waitFor(() => expect(mediaCallback).toHaveBeenCalledWith(true));

    expect(check(backgroundContents, 'media', 'https://reunion.example', { mediaType: 'video' })).toBe(true);
    expect(check(backgroundContents, 'media', 'https://reunion.example', { mediaType: 'audio' })).toBe(true);
  });

  it('gobierna la ventana que abre otra ventana real y le hereda el origen del abridor', async () => {
    // La ventana flotante de la llamada abre a su vez sus propias ventanas.
    // Solo las pestañas tenian politica de apertura, asi que esas nietas nacian
    // fuera del navegador: la gobernanza las veia como contenido ajeno y les
    // negaba `media` sin origen con el que decidir. Es el
    // "(contenido ajeno al navegador): (sin origen) media" del registro.
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://mail.google.com/');
    const contents = browserViewHarness.instances[0].webContents;

    const abrir = (handler: (details: unknown) => { createWindow: (options: unknown) => unknown }) => (
      handler({ url: 'about:blank', disposition: 'new-window', features: '' })
    );
    const popupResponse = abrir(contents.setWindowOpenHandler.mock.calls[0][0]);
    const popupContents = popupResponse.createWindow({ webPreferences: {} }) as { setWindowOpenHandler: ReturnType<typeof vi.fn> };

    // La ventana flotante ya tiene politica propia: lo que abra queda dentro.
    expect(popupContents.setWindowOpenHandler).toHaveBeenCalled();
    expect(popupContents.setWindowOpenHandler.mock.calls[0][0]({
      url: 'https://meet.google.com/call?authuser=0',
      disposition: 'new-window',
      features: '',
    })).toEqual({ action: 'deny' });
    expect(service.getState().tabs).toHaveLength(1);
    const nietaResponse = abrir(popupContents.setWindowOpenHandler.mock.calls[0][0]);
    const nietaContents = nietaResponse.createWindow({ webPreferences: {} });

    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    // Hereda el origen del abridor original, que es contra quien un navegador
    // decide los permisos de un documento `about:blank`.
    expect(service.governedOriginFor(nietaContents as never)).toBe('https://mail.google.com');
    expect(check(nietaContents, 'media', '', { mediaType: 'audio' })).toBe(true);
  });

  it('gobierna camara y microfono antes de entregar la ventana real a Chromium', async () => {
    // Google Meet abre su ventana de llamada desde Gmail con `window.open`
    // sin destino. Esa ventana comparte la particion pero no es una pestaña,
    // asi que la gobernanza la trataba como contenido ajeno y le negaba camara
    // y microfono sin preguntar: la llamada nunca llegaba a arrancar.
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    answerPermissionPrompts(window, service, true);
    await service.open('https://mail.google.com/');
    const contents = browserViewHarness.instances[0].webContents;
    const openHandler = contents.setWindowOpenHandler.mock.calls[0][0];
    const popupResponse = openHandler({
      url: 'about:blank',
      disposition: 'new-window',
      features: 'width=900,height=700',
    });
    // `createWindow` sustituye a la creacion automatica de Electron, por lo
    // que `did-create-window` no se emite. La ventana debe quedar adoptada
    // sincronamente antes de devolver el webContents a Chromium.
    const popupContents = popupResponse.createWindow({ webPreferences: {} });

    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    const mediaCallback = vi.fn();

    // La ventana hija todavia esta en `about:blank`: esta consulta provisional
    // debe dejar que el flujo alcance la solicitud real con origen.
    expect(check(popupContents, 'media', '', { mediaType: 'audio' })).toBe(true);
    const withoutOrigin = vi.fn();
    request(popupContents, 'media', withoutOrigin, { mediaTypes: ['audio'] });
    await vi.waitFor(() => expect(withoutOrigin).toHaveBeenCalledWith(false));

    request(popupContents, 'media', mediaCallback, {
      securityOrigin: 'https://meet.google.com',
      mediaTypes: ['audio', 'video'],
    });
    await vi.waitFor(() => expect(mediaCallback).toHaveBeenCalledWith(true));

    expect(check(popupContents, 'media', 'https://meet.google.com', { mediaType: 'audio' })).toBe(true);
    expect(check(popupContents, 'media', 'https://meet.google.com', { mediaType: 'video' })).toBe(true);

    // Adoptar la ventana concreta no convierte toda la sesion en contenido de
    // confianza. Una ventana no registrada sigue fallando de forma cerrada.
    const foreignContents = new BrowserWindow().webContents;
    const foreignCallback = vi.fn();
    expect(check(foreignContents, 'media', 'https://meet.google.com', { mediaType: 'audio' })).toBe(false);
    request(foreignContents, 'media', foreignCallback, {
      securityOrigin: 'https://meet.google.com',
      mediaTypes: ['audio'],
    });
    await vi.waitFor(() => expect(foreignCallback).toHaveBeenCalledWith(false));
  });

  it('muestra un aviso a la vez y no repite lo ya concedido', async () => {
    // Una videollamada pide camara y microfono desde varios marcos a la vez.
    // Con los avisos superpuestos el usuario no podia responder y la solicitud
    // quedaba colgada, dejando la llamada sin arrancar.
    let abiertos = 0;
    let maximoSimultaneo = 0;
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    const avisos = answerPermissionPrompts(window, service, true, async () => {
      abiertos += 1;
      maximoSimultaneo = Math.max(maximoSimultaneo, abiertos);
      await new Promise((resolve) => setImmediate(resolve));
      abiertos -= 1;
    });
    await service.open('https://meet.example/');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const primero = vi.fn();
    const segundo = vi.fn();

    request(contents, 'media', primero, { securityOrigin: 'https://meet.example', mediaTypes: ['audio', 'video'] });
    request(contents, 'media', segundo, { securityOrigin: 'https://meet.example', mediaTypes: ['video'] });

    await vi.waitFor(() => expect(primero).toHaveBeenCalledWith(true));
    await vi.waitFor(() => expect(segundo).toHaveBeenCalledWith(true));
    expect(maximoSimultaneo).toBe(1);
    // Camara y microfono se preguntan juntos, y la segunda solicitud encuentra
    // la camara ya concedida: un solo aviso para todo.
    expect(avisos).toHaveLength(1);
    expect(avisos[0].kinds).toEqual(['microphone', 'camera']);
  });

  it('responde que no cuando el aviso de permiso no se puede mostrar', async () => {
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://example.com');
    // Sin ventana donde pintar el aviso no hay a quien preguntar.
    vi.mocked(window.isDestroyed).mockReturnValue(true);
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const callback = vi.fn();

    request(contents, 'media', callback, { securityOrigin: 'https://example.com', mediaTypes: ['audio'] });

    // Lo importante es que responda: dejar la promesa pendiente colgaba a la
    // pagina indefinidamente.
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(false));
  });

  it('concede sin interrumpir lo que solo cambia la presentacion y deniega lo demas', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const responses = new Map<string, ReturnType<typeof vi.fn>>();

    for (const permission of ['fullscreen', 'pointerLock', 'keyboardLock', 'mediaKeySystem', 'speaker-selection', 'background-sync', 'clipboard-sanitized-write', 'storage-access', 'midi', 'openExternal']) {
      const callback = vi.fn();
      responses.set(permission, callback);
      request(contents, permission, callback, { securityOrigin: 'https://example.com' });
    }
    await flushPermissionQueue();

    for (const permission of ['fullscreen', 'pointerLock', 'keyboardLock', 'mediaKeySystem', 'speaker-selection', 'background-sync', 'clipboard-sanitized-write', 'storage-access']) {
      await vi.waitFor(() => expect(responses.get(permission)).toHaveBeenCalledWith(true));
    }
    for (const permission of ['midi', 'openExternal']) {
      expect(responses.get(permission)).toHaveBeenCalledWith(false);
    }
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('no pregunta y explica la ruta del sistema cuando el sistema operativo bloquea la camara', async () => {
    await withPlatform('win32', async () => {
      vi.mocked(systemPreferences.getMediaAccessStatus).mockImplementation((mediaType) => (
        mediaType === 'camera' ? 'denied' : 'granted'
      ));
      const service = newService();
      service.attachWindow(new BrowserWindow());
      await service.open('https://example.com');
      const contents = browserViewHarness.instances[0].webContents;
      const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
      const mediaCallback = vi.fn();

      request(contents, 'media', mediaCallback, { securityOrigin: 'https://example.com', mediaTypes: ['video'] });
      await vi.waitFor(() => expect(mediaCallback).toHaveBeenCalledWith(false));
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'Permiso del sistema bloqueado' }),
      );
      expect(dialog.showMessageBox).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'Permiso del navegador' }),
      );
    });
  });

  it('abre una ventana real para Document Picture-in-Picture en vez de una pestaña vacia', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://meet.example/');
    const contents = browserViewHarness.instances[0].webContents;
    const openHandler = contents.setWindowOpenHandler.mock.calls[0][0];

    const pip = openHandler({ url: 'about:blank', disposition: 'new-window', features: 'width=420,height=260' });
    const popup = openHandler({ url: 'https://accounts.example/oauth', disposition: 'new-window', features: '' });
    await Promise.resolve();

    expect(pip.action).toBe('allow');
    expect(pip.createWindow).toEqual(expect.any(Function));
    const pipContents = pip.createWindow({ webPreferences: { partition: browserPartitionFor() } });
    // Las opciones que Electron entrega al creador conservan la sesion y la
    // relacion con `window.opener`; main adopta la ventana antes de retornarla.
    expect(pipContents.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
    // El popup con destino real sigue convirtiendose en pestaña interna.
    expect(popup.action).toBe('deny');
    await vi.waitFor(() => expect(service.getState().tabs.map((tab) => tab.url)).toContain('https://accounts.example/oauth'));
    // Y ya no queda ninguna pestaña vacia de las que dejaba el PiP.
    expect(service.getState().tabs.filter((tab) => tab.url === 'about:blank')).toHaveLength(0);
  });

  it('bloquea la llamada directa de Google Chat sin crear pestañas ni ventanas', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    const sourceUrl = 'https://mail.google.com/mail/u/0/#chat/dm/1dV7USAAAAE';
    await service.open(sourceUrl);
    const contents = browserViewHarness.instances[0].webContents;
    const openHandler = contents.setWindowOpenHandler.mock.calls[0][0];
    const directCallUrl = 'https://meet.google.com/call?authuser=0&hl=es-419&iilm=1786577388646';
    const response = openHandler({
      url: directCallUrl,
      disposition: 'new-window',
      features: 'width=420,height=260',
    });

    expect(response).toEqual({ action: 'deny' });
    expect(service.getState().tabs.map((tab) => tab.url)).toEqual([sourceUrl]);
    expect(service.getState().url).toBe(sourceUrl);
    expect(service.getState().tabs.some((tab) => tab.url === 'https://meet.google.com/new')).toBe(false);
    expect(detachedWindowHarness.instances).toHaveLength(0);
  });

  it('bloquea /call desde navegación y redirección de subframe sin crear una reunión', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://mail.google.com/mail/u/0/#chat/dm/1dV7USAAAAE');
    const contents = browserViewHarness.instances[0].webContents;
    const frameNavigation = {
      url: 'https://meet.google.com/call?authuser=0',
      isMainFrame: false,
      preventDefault: vi.fn(),
    };
    const redirect = {
      url: 'https://meet.google.com/call?authuser=0',
      isMainFrame: false,
      preventDefault: vi.fn(),
    };

    contents.emit('will-frame-navigate', frameNavigation);
    contents.emit('will-redirect', redirect);

    expect(frameNavigation.preventDefault).toHaveBeenCalledOnce();
    expect(redirect.preventDefault).toHaveBeenCalledOnce();
    expect(service.getState().tabs).toHaveLength(1);
    expect(service.getState().url).toContain('mail.google.com');
    expect(service.getState().tabs.some((tab) => tab.url === 'https://meet.google.com/new')).toBe(false);
  });

  it('cancela about:blank -> /call sin crear pestaña y mantiene bloqueados protocolos externos', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://mail.google.com/mail/u/0/#chat/dm/1dV7USAAAAE');
    const source = browserViewHarness.instances[0].webContents;
    const openHandler = source.setWindowOpenHandler.mock.calls[0][0];
    const response = openHandler({ url: 'about:blank', disposition: 'new-window', features: '' });
    const popupContents = response.createWindow({ webPreferences: {} });
    const popupWindow = browserWindowHarness.instances[browserWindowHarness.instances.length - 1];
    const popupOn = popupContents.on as ReturnType<typeof vi.fn>;
    const navigate = popupOn.mock.calls.find(([eventName]) => eventName === 'will-navigate')?.[1] as
      ((event: { url: string; preventDefault: ReturnType<typeof vi.fn> }) => void);
    const directCall = { url: 'https://meet.google.com/call?authuser=0', preventDefault: vi.fn() };
    const externalProtocol = { url: 'file:///C:/Windows/System32', preventDefault: vi.fn() };

    navigate(directCall);
    navigate(externalProtocol);

    expect(directCall.preventDefault).toHaveBeenCalledOnce();
    expect(popupWindow.close).toHaveBeenCalledOnce();
    expect(externalProtocol.preventDefault).toHaveBeenCalledOnce();
    expect(service.getState().tabs).toHaveLength(1);
    expect(service.getState().url).toContain('mail.google.com');
    expect((popupContents.on as ReturnType<typeof vi.fn>).mock.calls.some(([name]) => name === 'will-frame-navigate')).toBe(true);
  });

  it('lleva la vista a pantalla completa y restaura el layout al salir', async () => {
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://video.example/');
    service.setViewport({ x: 200, y: 120, width: 800, height: 600 });
    const view = browserViewHarness.instances[0];
    const contents = view.webContents;
    view.setBounds.mockClear();

    contents.emit('enter-html-full-screen');

    expect(window.setFullScreen).toHaveBeenCalledWith(true);
    expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 0, width: 1024, height: 768 });
    expect(service.getState().isFullscreen).toBe(true);

    view.setBounds.mockClear();
    contents.emit('leave-html-full-screen');

    expect(window.setFullScreen).toHaveBeenCalledWith(false);
    expect(view.setBounds).toHaveBeenCalledWith({ x: 200, y: 120, width: 800, height: 600 });
    expect(service.getState().isFullscreen).toBe(false);
  });

  it('impide dos tareas agentes simultaneas y libera el control tras un fallo de viewport', async () => {
    const service = new IntegratedBrowserService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://example.com');
    service.setViewport({ x: 100, y: 100, width: 800, height: 600 });

    await service.openForAgent();
    await expect(service.openForAgent()).rejects.toThrow(/otra tarea/i);
    const controlGuard = service.createAgentTargetGuard();
    expect(service.getState().agentControlling).toBe(true);
    service.releaseAgentControl();
    expect(controlGuard).toThrow('cambió');
    expect(service.getState().agentControlling).toBe(false);

    service.hide();
    await expect(service.openForAgent(undefined, 1)).rejects.toThrow(/viewport visible/i);
    expect(service.getState().agentControlling).toBe(false);
  });

  it('cancelar mientras espera viewport retira la espera y no enfoca después', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com'); service.hide();
    const contents = browserViewHarness.instances[0].webContents;
    const abort = new AbortController();
    const result = service.openForAgent(undefined, 60_000, abort.signal);
    await vi.waitFor(() => expect(service.getState().agentControlling).toBe(true));
    contents.focus.mockClear(); abort.abort();
    await expect(result).rejects.toThrow('Tarea cancelada.');
    expect(service.getState().agentControlling).toBe(false);
    service.setViewport({ x: 100, y: 100, width: 800, height: 600 });
    expect(contents.focus).not.toHaveBeenCalled();
    await service.openForAgent(); service.releaseAgentControl();
  });

  it('una apertura ya cancelada no crea vistas ni cambia el control', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    const count = browserViewHarness.instances.length;
    const abort = new AbortController(); abort.abort();
    await expect(service.openForAgent('https://example.com', undefined, abort.signal)).rejects.toThrow('Tarea cancelada.');
    expect(browserViewHarness.instances).toHaveLength(count);
    expect(service.getState().agentControlling).toBe(false);
  });

  it('cancelar durante la evaluación de navegación impide cargar su destino tardío', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com'); service.setViewport({ x: 100, y: 100, width: 800, height: 600 });
    const contents = browserViewHarness.instances[0].webContents;
    let finish!: (value: navigationSafety.BrowserNavigationSafetyVerdict) => void;
    const safety = vi.spyOn(navigationSafety, 'checkBrowserNavigation').mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const abort = new AbortController(); const result = service.openForAgent('https://example.com/otro', undefined, abort.signal);
    await vi.waitFor(() => expect(safety).toHaveBeenCalledOnce());
    contents.loadURL.mockClear(); abort.abort();
    finish({ action: 'allow', source: 'local', reason: null, checkedAt: new Date().toISOString() });
    await expect(result).rejects.toThrow('Tarea cancelada.');
    expect(contents.loadURL).not.toHaveBeenCalled();
    expect(service.getState().agentControlling).toBe(false);
  });

  it('retiene el control hasta drenar una navegación nativa cancelada', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    await service.open('https://example.com'); service.setViewport({ x: 100, y: 100, width: 800, height: 600 });
    const contents = browserViewHarness.instances[0].webContents;
    let finish!: () => void;
    contents.loadURL.mockClear(); contents.loadURL.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const abort = new AbortController(); const result = service.openForAgent('https://example.com/otro', undefined, abort.signal);
    await vi.waitFor(() => expect(contents.loadURL).toHaveBeenCalledOnce());
    abort.abort();
    await expect(service.openForAgent()).rejects.toThrow('otra tarea');
    expect(service.getState().agentControlling).toBe(true);
    contents.focus.mockClear(); finish(); await expect(result).rejects.toThrow('Tarea cancelada.');
    expect(service.getState().agentControlling).toBe(false);
    expect(contents.focus).not.toHaveBeenCalled();
  });

  it('DOC-READ-001: rechaza el contenido si cambia la pestaña activa durante la extracción', async () => {
    const service = new IntegratedBrowserService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://example.com/documento');
    service.setViewport({ x: 100, y: 100, width: 800, height: 600 });
    const firstContents = browserViewHarness.instances[0].webContents;
    let finishExtraction!: (value: unknown) => void;
    firstContents.executeJavaScript.mockImplementationOnce(() => new Promise((resolve) => {
      finishExtraction = resolve;
    }));

    const pendingRead = service.readActiveDocument();
    await Promise.resolve();
    await service.createTab('https://example.com/otro');
    finishExtraction({
      title: 'Documento anterior',
      language: 'es',
      truncated: false,
      blocks: [{ kind: 'paragraph', text: 'Contenido que ya no es activo.', level: null }],
    });

    await expect(pendingRead).rejects.toThrow(/cambió durante la lectura/i);
  });

  it('una lectura por pestaña rechaza el cambio de documento en vez de ocultarlo como texto vacío', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://example.com/documento');
      const contents = browserViewHarness.instances[0].webContents;
      contents.executeJavaScript.mockImplementationOnce(async () => {
        contents.emit('did-navigate-in-page');
        throw new Error('Documento reemplazado');
      });
      await expect(service.getTabContent(service.getState().activeTabId!)).rejects.toThrow('cambió');
    } finally { service.detachWindow(); }
  });

  it('el recibo de fuente impide leer otro documento, incluso con la misma ruta y distinta consulta', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    const readDom = vi.spyOn(pageObservation, 'collectIntegratedBrowserDom');
    try {
      await service.open('https://example.com/documento?privado=1');
      await service.setObservationEnabled(false);
      const summary = service.getTabSummaries()[0];
      const expected = { profileRevision: service.getState().profileRevision!, documentToken: summary.documentToken };
      const contents = browserViewHarness.instances[0].webContents;
      const calls = readDom.mock.calls.length;
      contents.emit('did-navigate-in-page', {}, 'https://example.com/documento?privado=2');
      expect(service.getTabSummaries()[0].documentToken).not.toBe(summary.documentToken);
      await expect(service.getTabContent(summary.tabId, expected)).rejects.toThrow('cambió');
      expect(readDom.mock.calls).toHaveLength(calls);
      const fresh = service.getTabSummaries()[0];
      await expect(service.getTabContent(fresh.tabId, { ...expected, documentToken: fresh.documentToken, profileRevision: expected.profileRevision + 1 })).rejects.toThrow('cambió');
      expect(JSON.stringify(summary)).not.toContain('privado=');
    } finally { service.detachWindow(); readDom.mockRestore(); }
  });

  it('iniciar una navegación principal invalida la selección antes del nuevo documento', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    try {
      await service.open('https://example.com/documento');
      const summary = service.getTabSummaries()[0];
      const contents = browserViewHarness.instances[0].webContents;
      contents.emit('did-start-navigation', {}, 'https://example.com/nuevo', false, false);
      expect(service.getTabSummaries()[0].documentToken).toBe(summary.documentToken);
      contents.emit('did-start-navigation', {}, 'https://example.com/nuevo', false, true);
      await expect(service.getTabContent(summary.tabId, { profileRevision: service.getState().profileRevision!, documentToken: summary.documentToken })).rejects.toThrow('cambió');
    } finally { service.detachWindow(); }
  });

  it('una selección vigente conserva el título leído y acota contenido antes del IPC', async () => {
    const service = newService(); service.attachWindow(new BrowserWindow());
    const readDom = vi.spyOn(pageObservation, 'collectIntegratedBrowserDom');
    try {
      await service.open('https://example.com/documento');
      await service.setObservationEnabled(false);
      readDom.mockResolvedValueOnce({ title: 'Título del DOM', text: 'e'.repeat(5000) } as never);
      const summary = service.getTabSummaries()[0];
      const result = await service.getTabContent(summary.tabId, { profileRevision: service.getState().profileRevision!, documentToken: summary.documentToken });
      expect(result.title).toBe('Título del DOM'); expect(result.text).toHaveLength(3000);
      expect(result.url).toBe(summary.url);
    } finally { service.detachWindow(); readDom.mockRestore(); }
  });
});
