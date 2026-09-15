import { EventEmitter } from 'node:events';
import { applyBrowserTabZoom, browserDomPoint, supportsIsolatedBrowserZoom } from './tab-zoom';
import { BrowserCredentialUnlock } from './credential-unlock';
import { BrowserPasskeySelection } from './passkey-selection';
import { listExtensionCatalog } from './extension-catalog';
import { validateExtensionCatalogRequest, type BrowserExtensionCatalogEntry } from '../../src/shared/browser-extension-catalog';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { validateCredentialSessionRequest } from '../../src/shared/browser-credential-session';
import { BrowserSemanticMemory } from './semantic-memory';
import { inspectBrowserSensitivePage } from './sensitive-page';
import { BROWSER_HANDOFF_MESSAGES, type BrowserSensitiveReason } from '../../src/shared/browser-sensitive-handoff';
import { validateBrowserSemanticRequest, type BrowserSemanticRequest, type BrowserSemanticResponse } from '../../src/shared/browser-semantic-memory';
import { validateBrowserAgentControlRequest, type BrowserAgentControlRequest, type BrowserAgentControlResponse } from '../../src/shared/browser-agent-control';
import type { BrowserCuControlPort } from '../desktop-agent/browser-cu-supervisor';
import { randomUUID } from 'node:crypto';
import { BROWSER_SOURCE_LIMITS } from '../../src/shared/browser-tab-context';
import { validateBrowserShortcutRequest, type BrowserShortcutRequest, type BrowserShortcutResponse } from '../../src/shared/browser-agent-shortcuts';
import { BrowserAgentShortcutStore } from './agent-shortcut-store';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDomain } from 'tldts';
import {
  BaseWindow,
  BrowserWindow,
  WebContentsView,
  app,
  dialog,
  session as electronSession,
  type BrowserWindowConstructorOptions,
  type Rectangle,
  type Session,
  type WebContents,
} from 'electron';
import {
  BROWSER_ANONYMOUS_SCOPE,
  browserPartitionFor,
  browserProfileRoot,
  browserProfilePath,
  browserScopeIdFor,
  browserPrivateScopeId,
  getBrowserScopeId,
  getBrowserProfileKind,
  isEphemeralBrowserScope,
  setBrowserProfileKind,
  setBrowserScopeId,
} from './profile-scope';
import { BrowserHistoryStore } from './browser-history-store';
import { BrowserHistoryImporter } from './history-importer';
import {
  clearBrowsingData,
  validateBrowsingDataRequest,
  type BrowsingDataSummary,
} from './browsing-data';
import { BrowserCredentialVault, normalizeCredentialOrigin } from './credential-vault';
import { BrowserCredentialSaver } from './credential-saver';
import { BrowserCredentialError } from './credential-errors';
import { BrowserCredentialTransfer } from './credential-transfer';
import { BrowserCredentialAutosave } from './credential-autosave';
import type { BrowserCredentialTransferEntry } from './credential-vault';
import { BrowserExtensionManager } from './extension-manager';
import { buildBrowserContextMenu, buildSelectionInstruction, MAX_READING_SELECTION_CHARS, MAX_SELECTION_CHARS } from './context-menu';
import {
  installBrowserSelectionMenu,
  parseSelectionMenuBeacon,
  setBrowserSelectionMenuEnabled,
  type BrowserSelectionMenuAction,
} from './selection-menu';
import {
  closeBrowserWritingPanel,
  deliverBrowserWritingResult,
  installBrowserWritingPanel,
  takeBrowserWritingRequest,
  WRITING_PANEL_BEACON,
  type BrowserWritingResult,
} from './writing-panel';
import { runInAgentWorldOn } from './agent-world';
import { IntegratedBrowserBootstrap } from './browser-bootstrap';
import { collectIntegratedBrowserDom } from './page-observation';
import { describeResolutionFailure, resolveBrowserElement, type BrowserElementTarget } from './page-interaction';
import { IntegratedBrowserPermissionGovernance } from './permission-governance';
import { BrowserSitePermissionStore, normalizeOrigin } from './site-permissions';
import { POLICY_RECOVERY_LABELS, validatePolicyRecoveryRequest } from '../../src/shared/browser-policy-recovery';
import { pickDisplayMediaSource } from './display-media-picker';
import { BrowserReadingModeService, type BrowserReadingSpeechResult } from './reading-mode-service';
import { BrowserDownloadManager } from './download-manager';
import { BrowserSessionStore } from './session-store';
import type { BrowserSessionSnapshot, BrowserRecentlyClosedTab, BrowserHistoryRetention, BrowserProfileDescriptor, BrowserProfileKind } from './platform-types';
import { readBrowserCapabilityFlags } from './feature-flags';
import { BookmarkImportRejected, BrowserBookmarkStore } from './bookmark-store';
import { BrowserBookmarkImporter } from './bookmark-importer';
import { BrowserDiagnosticExporter } from './diagnostic-report';
import { BrowserSyncDevices, type BrowserSyncDeviceContext } from './sync-devices';
import { BrowserSyncController, type BrowserSyncControlContext } from './sync-controller';
import { createBrowserSyncLocalAdapter } from './sync-local-adapter';
import type { BrowserSyncControlRequest } from './platform-types';
import { BrowserAgentPolicyStore, normalizeAgentOrigin } from './agent-policy-store';
import { BrowserAgentAuditStore, BrowserAuditError, type BrowserAuditOperation } from './agent-audit-store';
import { AsyncLocalStorage } from 'node:async_hooks';
import { browserCertificateDecision } from './certificate-policy';
import { assertCuNotAborted, CuContextChangedError } from '../desktop-agent/gemini-cu/execution-guard';
import { BrowserPrivacyStore, normalizePrivacyOrigin } from './privacy-store';
import { BrowserTrackingRuleEngine, createTrackingRuleList, mitigateFingerprintingRequestHeaders, mitigateFingerprintingResponseHeaders, stripTrackingParameters } from './tracking-protection';
import { BrowserEnterprisePolicyStore } from './enterprise-policy-store';
import { toStandardChromiumUserAgent } from './user-agent';
import {
  collectBrowserReadingContent,
  type BrowserDocumentContent,
  type BrowserReadingContent,
  type BrowserReadingPrepareInput,
  type BrowserReadingToolbarAction,
  type BrowserReadingToolbarState,
} from './reading-mode-content';
import {
  INTEGRATED_BROWSER_AGENT_VIEWPORT_TIMEOUT_MS,
  INTEGRATED_BROWSER_BACKDROP_QUALITY,
  INTEGRATED_BROWSER_DEFER_THROTTLE_MS,
  SELECTION_PROBE_DELAY_MS,
  INTEGRATED_BROWSER_HOME,
  INTEGRATED_BROWSER_MAX_DETACHED_WINDOWS,
  INTEGRATED_BROWSER_MAX_LIVE_TABS,
  INTEGRATED_BROWSER_MAX_TABS,
  INTEGRATED_BROWSER_MEDIA_OBSERVATION_IDLE_MS,
  INTEGRATED_BROWSER_MEDIA_OBSERVATION_INTERVAL_MS,
  INTEGRATED_BROWSER_OBSERVATION_IDLE_MS,
  INTEGRATED_BROWSER_OBSERVATION_INTERVAL_MS,
  INTEGRATED_BROWSER_OBSERVATION_MAX_EDGE,
  INTEGRATED_BROWSER_OBSERVATION_QUALITY,
  type BrowserCredentialMetadata,
  type BrowserCredentialSaveInput,
  type BrowserExtensionInstallPreview,
  type BrowserExtensionMetadata,
  type BrowserHistoryEntry,
  type BrowserInteractionOutcome,
  type BrowserObservationSnapshot,
  type BrowserObservationStatus,
  type BrowserPermissionPromptRequest,
  type BrowserSitePermissionKind,
  type BrowserSitePermissionState,
  type BrowserSitePermissionSummary,
  type IntegratedBrowserState,
  type IntegratedBrowserTabState,
  type IntegratedBrowserViewMode,
} from './types';
import type { BrowserAgentCapability, BrowserAgentPolicyPromptRequest, BrowserAgentPolicyMode, BrowserAgentSiteDecision, BrowserEnterprisePolicy, BrowserPrivacyCategory, BrowserPrivacyLevel, BrowserRuntimeDiagnostic, BrowserSessionTab, BrowserTabGroup, BrowserTabGroupColor } from './platform-types';
import { describeBlockedUrl, isAllowedBrowserUrl, normalizeBrowserTarget, parseBrowserViewport } from './validation';
import { canCheckBrowserNavigationRemotely, checkBrowserNavigation, checkBrowserNavigationLocal, type BrowserNavigationSafetyVerdict } from './safe-navigation';
import { BrowserRequestSafety } from './request-safety';
import { BrowserSafetyInterstitials } from './safety-interstitial';
import {
  nextBrowserZoomFactor,
  printBrowserPage,
  saveBrowserPageAsPdf,
  validateFindQuery,
  type BrowserZoomAction,
} from './page-tools';

type ViewportWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type BrowserTabRuntime = {
  id: string;
  view: WebContentsView | null;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  error: string | null;
  navigationSafety: BrowserNavigationSafetyVerdict | null;
  /** Asociación interna: no exponer otro destino ni persistir reputación. */
  navigationSafetyUrl: string | null;
  lastActivatedAt: number;
  visualRevision: number;
  documentToken: string;
  passiveCaptureNotBefore: number;
  lastDeferAt: number;
  /** Ultimo estado aplicado a la vista nativa: evita ocultar y volver a mostrar
   *  la pagina en cada publicacion de viewport, que la obliga a descartar el
   *  cuadro compuesto y reiniciar temporizadores de carga. */
  appliedVisible: boolean | null;
  appliedBounds: Rectangle | null;
  /** Arranque del mundo del agente por CDP. Nulo cuando no se pudo instalar. */
  bootstrap: IntegratedBrowserBootstrap | null;
  credentialObserver: BrowserCredentialAutosave | null;
  muted: boolean;
  zoomFactor: number;
  find: {
    query: string;
    activeMatchOrdinal: number;
    matches: number;
    finalUpdate: boolean;
  } | null;
  pinned: boolean;
  groupId: string | null;
};

type BrowserVisualCapture = {
  tabId: string;
  url: string;
  capturedAt: string;
  screenshot: string;
  revision: number;
};

export class IntegratedBrowserService extends EventEmitter {
  private extensionAuthRevision = 0;
  private extensionAuthCleanup: (() => void) | null = null;
  private readonly sensitiveDocuments = new WeakMap<WebContents, BrowserSensitiveReason>();
  private markSensitiveDocument(tab: BrowserTabRuntime, reason: BrowserSensitiveReason): void {
    const contents = tab.view?.webContents;
    if (!contents || this.sensitiveDocuments.has(contents)) return;
    this.sensitiveDocuments.set(contents, reason);
    this.agentPolicyRevision++;
    this.invalidateObservation(tab.id);
    this.agentTaskBinding?.control.command('stop');
    this.emitState();
  }
  private assertKnownDocumentNotSensitive(tabId?: string): void {
    const tab = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    const contents = tab?.view?.webContents;
    if (contents && this.sensitiveDocuments.has(contents)) throw new Error(`Continúa manualmente. ${BROWSER_HANDOFF_MESSAGES[this.sensitiveDocuments.get(contents)!]}`);
  }
  private async assertDocumentNotSensitive(tabId?: string): Promise<void> {
    this.assertKnownDocumentNotSensitive(tabId);
    if (!this.capabilities.agentGovernance) return;
    const tab = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    const contents = tab?.view?.webContents;
    if (!tab || !contents) throw new Error('La página no está disponible para revisión de seguridad.');
    const guard = this.createAgentAccessGuard(tabId);
    const reason = await inspectBrowserSensitivePage(contents);
    guard();
    if (reason) {
      this.markSensitiveDocument(tab, reason);
      throw new Error(`Continúa manualmente. ${BROWSER_HANDOFF_MESSAGES[reason]}`);
    }
  }
  private readonly semanticMemory = new BrowserSemanticMemory();
  configureSemanticMemoryKey(provider: () => string | null): void { this.semanticMemory.configureKey(provider); }
  async semanticMemoryCommand(raw: BrowserSemanticRequest, assertCaller: () => void = () => {}): Promise<BrowserSemanticResponse> {
    const input = validateBrowserSemanticRequest(raw);
    this.assertCapability('agentGovernance');
    const profile = this.captureProfileGuard(); const control = this.agentControlRevision; const scope = this.scopeId;
    const guard = () => {
      assertCaller();
      profile();
      if (input.profileRevision !== this.scopeTransition || getBrowserScopeId() !== scope || this.agentControlling || control !== this.agentControlRevision
        || getBrowserProfileKind() !== 'authenticated' || isEphemeralBrowserScope(scope)) throw new Error('La memoria requiere el perfil persistente y control humano vigentes.');
    };
    guard(); await this.ensureEnterprisePolicy(); guard();
    if (this.enterprisePolicy?.agentAllowed === false && !['disable', 'cancel', 'status'].includes(input.action)) throw new Error('La memoria está bloqueada por tu organización.');
    return this.semanticMemory.run(input, { guard,
      sources: async () => {
        const [history, bookmarks] = await Promise.all([this.historyStore.list({ limit: 200 }), this.bookmarkStore.list()]); guard();
        return [...history.map(entry => ({ ...entry, source: 'history' as const })),
          ...bookmarks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 200).map(entry => ({ ...entry, source: 'bookmark' as const }))];
      },
      confirm: async action => {
        const result = await dialog.showMessageBox(this.requireParentWindow(), {
          type: 'warning', title: 'Memoria semántica del navegador',
          message: action === 'enable' ? '¿Permitir búsquedas semánticas con Google Gemini?' : '¿Desactivar y borrar el índice semántico local?',
          detail: action === 'enable'
            ? 'Sólo al reconstruir se enviarán a Google títulos y rutas URL (sin parámetros ni fragmentos) de hasta 200 visitas recientes y 200 marcadores. Las consultas también se envían. Títulos y rutas pueden contener datos personales. Puede generar costes de API. No se envían páginas ni formularios. El índice local se cifra por el SO, vence a los 30 días y no se sincroniza. Cancelar no retira datos ya enviados al proveedor.'
            : 'No elimina historial ni marcadores originales. El borrado local no garantiza eliminación forense ni retira información ya enviada a Google.',
          buttons: ['Cancelar', action === 'enable' ? 'Permitir' : 'Desactivar y borrar'], defaultId: 0, cancelId: 0, noLink: true,
        }); guard(); return result.response === 1;
      },
    });
  }
  private readonly shortcutStore = new BrowserAgentShortcutStore();
  private shortcutReviewPending = false;

  async agentShortcuts(raw: BrowserShortcutRequest): Promise<BrowserShortcutResponse> {
    const input = validateBrowserShortcutRequest(raw);
    this.assertCapability('agentGovernance');
    const profile = this.captureProfileGuard(); const control = this.agentControlRevision; const scope = this.scopeId;
    const expires = Date.now() + 5 * 60_000;
    const guard = () => {
      profile();
      if (getBrowserScopeId() !== scope || input.profileRevision !== this.scopeTransition || this.agentControlling || control !== this.agentControlRevision || Date.now() >= expires) throw new Error('El contexto cambió. Abre de nuevo los atajos.');
      if (getBrowserProfileKind() !== 'authenticated' || isEphemeralBrowserScope(getBrowserScopeId()) || getBrowserScopeId() === BROWSER_ANONYMOUS_SCOPE) throw new Error('Los atajos requieren un perfil autenticado persistente.');
    };
    guard(); await this.ensureEnterprisePolicy(); guard();
    if (this.enterprisePolicy?.agentAllowed === false) throw new Error('El agente está bloqueado por tu organización.');
    if (input.action === 'remove') {
      if (this.shortcutReviewPending) throw new Error('Ya hay una eliminación de atajo pendiente.');
      this.shortcutReviewPending = true;
      try {
        const result = await dialog.showMessageBox(this.requireParentWindow(), {
          type: 'warning', title: 'Eliminar atajo', message: '¿Eliminar este atajo del perfil?',
          detail: 'También elimina todas las copias locales de recuperación de atajos de este perfil. No elimina conversaciones ni datos de las páginas. La eliminación local no garantiza borrado forense.',
          buttons: ['Cancelar', 'Eliminar'], defaultId: 0, cancelId: 0, noLink: true,
        });
        guard(); if (result.response !== 1) return { success: true, canceled: true };
        const library = await this.shortcutStore.run(input, guard); guard();
        return { success: true, library };
      } finally { this.shortcutReviewPending = false; }
    }
    const library = await this.shortcutStore.run(input, guard); guard();
    return { success: true, library };
  }
  private readonly auditStore = new BrowserAgentAuditStore();
  private readonly auditTrace = new AsyncLocalStorage<string>();
  private auditReviewPending = false;

  /** Sólo main registra operaciones, sin argumentos ni contenido del resultado. */
  async auditAgentOperation<T>(operation: BrowserAuditOperation, action: () => Promise<T>, traceId: string = randomUUID(), tabId?: string): Promise<T> {
    if (!this.capabilities.agentGovernance) return action();
    const guard = this.captureProfileGuard();
    const tab = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    traceId = this.auditTrace.getStore() ?? traceId;
    const context = { traceId, tabId: tab?.id ?? '', url: tab?.view?.webContents.getURL() ?? tab?.url ?? '', operation };
    guard(); this.auditStore.record({ ...context, result: 'started' });
    try {
      const value = await this.auditTrace.run(traceId, action); guard();
      this.auditStore.record({ ...context, result: 'completed' });
      return value;
    } catch (error) {
      // Un inicio sin cierre indica interrupción; no recrear un perfil ya purgado.
      try { guard(); this.auditStore.record({ ...context, result: error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed' }); }
      catch { /* Se conserva el error original, nunca se anuncia éxito. */ }
      throw error;
    }
  }

  listAgentAudit(offset = 0) {
    this.captureProfileGuard()();
    return this.auditStore.list(offset);
  }

  async changeAgentAudit(action: 'clear' | 'retention', days?: number) {
    if (this.auditReviewPending) throw new BrowserAuditError('Ya hay una revisión de bitácora pendiente.');
    if (action !== 'clear' && action !== 'retention' || action === 'retention' && ![7, 30, 90].includes(days ?? 0)) throw new BrowserAuditError('Solicitud de bitácora inválida.');
    const profile = this.captureProfileGuard(); const control = this.agentControlRevision;
    const expires = Date.now() + 5 * 60_000;
    const guard = () => { profile(); if (this.agentControlling || control !== this.agentControlRevision || Date.now() >= expires) throw new BrowserAuditError('Toma el control y revisa la bitácora de nuevo.'); };
    guard(); this.auditReviewPending = true;
    try {
      const result = await dialog.showMessageBox(this.requireParentWindow(), {
        type: 'warning', title: 'Bitácora del agente', message: action === 'clear' ? '¿Borrar la bitácora de este perfil?' : `¿Conservar la bitácora durante ${days} días?`,
        detail: 'Se eliminará evidencia local y se retirarán sus copias de recuperación anteriores. Esto no deshace las acciones del agente ni elimina datos de los sitios.',
        buttons: ['Cancelar', 'Confirmar'], defaultId: 0, cancelId: 0, noLink: true,
      });
      guard();
      if (result.response !== 1) return { cancelled: true };
      if (action === 'clear') this.auditStore.clear(); else this.auditStore.setRetention(days!);
      return { cancelled: false };
    } catch (error) {
      if (error instanceof BrowserAuditError) throw error;
      throw new BrowserAuditError('No se pudo modificar la bitácora. Revisa el perfil y vuelve a intentarlo.');
    } finally { this.auditReviewPending = false; }
  }
  private parentWindow: BrowserWindow | null = null;
  private detachedWindows = new Map<string, BaseWindow>();
  private mainWindowFocusHandler: (() => void) | null = null;
  private tabs = new Map<string, BrowserTabRuntime>();
  private activeTabValue: string | null = null;
  private activeTabRevision = 0;
  private navigationRequestRevision = 0;
  private readonly requestSafety = new BrowserRequestSafety();
  private readonly safetyInterstitials = new BrowserSafetyInterstitials();
  private profileSelectionPending = false;
  private agentPolicyRevision = 0;
  private agentControlRevision = 0;
  private get activeTabId(): string | null { return this.activeTabValue; }
  private set activeTabId(value: string | null) {
    if (value !== this.activeTabValue) this.activeTabRevision += 1;
    this.activeTabValue = value;
  }
  private primaryTabId: string | null = null;
  private secondaryTabId: string | null = null;
  private viewMode: IntegratedBrowserViewMode = 'single';
  private overlayTopTabId: string | null = null;
  private customOverlayBounds: Rectangle | null = null;
  private viewport: Rectangle | null = null;
  private visible = false;
  private agentControlling = false;
  private agentTaskBinding: { control: BrowserCuControlPort; profileRevision: number; scope: string; assertCurrent: () => void } | null = null;

  /** Enlace main efímero: conserva la reserva hasta que el ejecutor termina su limpieza. */
  bindAgentTask(control: BrowserCuControlPort): () => void {
    if (this.agentTaskBinding) throw new Error('Otra tarea aún conserva el control.');
    const profile = this.captureProfileGuard();
    const scope = this.scopeId;
    let target: (() => void) | null = null;
    const binding = { control, profileRevision: this.scopeTransition, scope, assertCurrent: () => {
      profile();
      if (getBrowserScopeId() !== scope) throw new Error('El perfil cambió.');
      const status = control.snapshot().status;
      if (this.activeTabId && this.detachedWindows.has(this.activeTabId)) throw new Error('Acopla la pestaña para supervisar la tarea.');
      if (!target && status !== 'starting' && status !== 'stopping') target = this.createAgentTargetGuard();
      target?.();
    } };
    binding.assertCurrent();
    this.agentTaskBinding = binding;
    const unsubscribe = control.subscribe(() => this.emitState());
    this.emitState();
    return () => {
      unsubscribe();
      if (this.agentTaskBinding === binding) { this.agentTaskBinding = null; this.emitState(); }
    };
  }

  controlAgentTask(raw: BrowserAgentControlRequest): BrowserAgentControlResponse {
    const input = validateBrowserAgentControlRequest(raw);
    const binding = this.agentTaskBinding;
    if (!binding || input.profileRevision !== this.scopeTransition || input.profileRevision !== binding.profileRevision || binding.scope !== getBrowserScopeId() || binding.control.snapshot().taskId !== input.taskId) throw new Error('La tarea o el perfil cambió.');
    // Detener reduce autoridad y debe seguir disponible aunque se invalide el destino.
    if (input.action === 'resume' || input.action === 'pause') {
      if (input.taskRevision !== binding.control.snapshot().revision) throw new Error('La ejecución cambió.');
      binding.assertCurrent();
    }
    binding.control.command(input.action);
    return { success: true, agentTask: binding.control.snapshot() };
  }
  private permissions: IntegratedBrowserPermissionGovernance | null = null;
  private passkeySelection: BrowserPasskeySelection | null = null;
  /** Pestaña que pidio pantalla completa a la pagina, si hay alguna. */
  private fullscreenTabId: string | null = null;
  /** Estado de la ventana anfitriona antes de entrar en pantalla completa. */
  private fullscreenRestore: { window: BaseWindow | BrowserWindow; wasFullScreen: boolean } | null = null;
  private pictureInPictureWindows = new Set<BrowserWindow>();
  /** Avisos de permiso esperando la respuesta del renderer, por identificador. */
  private permissionPrompts = new Map<string, (granted: boolean) => void>();
  private agentPolicyPrompts = new Map<string, (decision: BrowserAgentSiteDecision) => void>();
  /**
   * Origen del abridor de cada ventana real adoptada, por id de `webContents`.
   *
   * Un Document Picture-in-Picture y un popup que la pagina rellena por script
   * son documentos `about:blank`: heredan el origen de quien los abrio, pero
   * `getURL()` sigue devolviendo `about:blank`, que no es un origen. Sin este
   * registro la gobernanza se quedaba sin origen con el que resolver el
   * permiso, y `request` salia denegando sin llegar a preguntar.
   */
  private governedWindowOrigins = new Map<number, string>();
  private viewportWaiters = new Set<ViewportWaiter>();
  private extensionsRestored = false;
  private observationEnabled = true;
  private observationTimer: ReturnType<typeof setTimeout> | null = null;
  private observationTimerGeneration = 0;
  private observationInFlight: Promise<BrowserObservationSnapshot | null> | null = null;
  private observationInFlightTarget: { tabId: string; url: string } | null = null;
  private visualCaptureInFlight: Promise<BrowserVisualCapture | null> | null = null;
  private visualCaptureInFlightTarget: { tabId: string; url: string } | null = null;
  private latestVisualCapture: BrowserVisualCapture | null = null;
  private latestObservation: BrowserObservationSnapshot | null = null;
  private observationSequence = 0;
  private observationLastError: string | null = null;
  /** Perfil (usuario) al que pertenece la sesion de navegacion en curso. */
  private scopeId = getBrowserScopeId();
  private profileKind: BrowserProfileKind = getBrowserProfileKind();
  private authenticatedScopeId: string | null = this.profileKind === 'authenticated' ? this.scopeId : null;
  private profileStartedAt = Date.now();
  private readonly diagnosticExporter: BrowserDiagnosticExporter;
  private readonly syncDevices = new BrowserSyncDevices();
  private readonly syncController = new BrowserSyncController();
  private syncDialogPending = false;
  private readonly credentialSaver: BrowserCredentialSaver;
  private readonly credentialTransfer: BrowserCredentialTransfer;
  private readonly downloadManager: BrowserDownloadManager;
  private readonly certificateSessions = new WeakSet<Session>();
  private closedTabs: Array<BrowserSessionTab & { closedAt: string }> = [];
  private readonly reopeningTabs = new Set<string>();
  private groups = new Map<string, BrowserTabGroup>();
  private tabLayout: 'horizontal' | 'vertical' = 'horizontal';
  private readonly sessionStore: BrowserSessionStore;
  private readonly bookmarkStore: BrowserBookmarkStore;
  private readonly bookmarkImporter: BrowserBookmarkImporter;
  private bookmarkRecoveryPending = false;
  private readonly historyImporter: BrowserHistoryImporter;
  private readonly agentPolicyStore: BrowserAgentPolicyStore;
  private readonly privacyStore: BrowserPrivacyStore;
  private readonly trackingEngine = new BrowserTrackingRuleEngine();
  private readonly enterprisePolicyStore: BrowserEnterprisePolicyStore;
  private enterprisePolicy: BrowserEnterprisePolicy | null = null;
  private enterprisePolicyLoad: Promise<void> | null = null;
  private enterprisePolicyReady = false;
  private enterprisePolicyFailed = false;
  private restorableSession: BrowserSessionSnapshot | null = null;
  private sessionLoadedScope: string | null = null;
  private sessionLoad: Promise<void> | null = null;
  private sessionGeneration = 0;
  private scopeTransition = 0;
  private scopeChanging = false;
  private credentialAutosaveEnabled = false;
  private credentialAutosaveRevision = 0;
  private credentialAutosaveSetting = false;
  private credentialRecoveryPending = false;
  private readonly credentialUnlock = new BrowserCredentialUnlock(() => {
    if (!this.credentialUnlock.isUnlocked()) {
      this.credentialAutosaveEnabled = false; ++this.credentialAutosaveRevision;
      void this.syncCredentialObservers().catch(() => undefined);
    }
    this.emitState();
  });
  private shutdownCommitted = false;
  private shutdownFlushing = false;
  private shutdownRevision = 0;
  private lastSessionSave: Promise<void> = Promise.resolve();
  private lastSessionSaveFailed = false;
  private lastSessionSnapshot: { scopeId: string; snapshot: BrowserSessionSnapshot } | null = null;
  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Cola de E/S antes de purgar perfiles efímeros al cerrar la ventana. */
  private ephemeralCleanup: Promise<void> = Promise.resolve();
  private ephemeralCleanupPending = false;
  private ephemeralCleanupFailed = false;
  private ephemeralCleanupScope: string | null = null;
  private readonly capabilities = readBrowserCapabilityFlags();

  constructor(
    private readonly historyStore = new BrowserHistoryStore(),
    private readonly credentialVault = new BrowserCredentialVault(),
    private readonly extensionManager = new BrowserExtensionManager(),
    private readonly readingModeService = new BrowserReadingModeService(),
    private readonly sitePermissionStore = new BrowserSitePermissionStore(),
    downloadManager?: BrowserDownloadManager,
    sessionStore?: BrowserSessionStore,
    bookmarkStore?: BrowserBookmarkStore,
    agentPolicyStore?: BrowserAgentPolicyStore,
    privacyStore?: BrowserPrivacyStore,
    enterprisePolicyStore?: BrowserEnterprisePolicyStore,
  ) {
    super();
    this.credentialSaver = new BrowserCredentialSaver(this.credentialVault);
    this.credentialTransfer = new BrowserCredentialTransfer(this.credentialVault);
    this.downloadManager = downloadManager ?? new BrowserDownloadManager(
      (downloads) => this.sendToRenderer('integrated-browser:downloads-changed', downloads),
      undefined,
      (sourceUrl) => {
        this.assertCapability('downloads');
        if (this.scopeChanging || !this.enterpriseUrlAllowed(sourceUrl)) throw new Error('La descarga está bloqueada por la política del perfil.');
        const safety = checkBrowserNavigationLocal(sourceUrl);
        if (safety.action === 'block') throw new Error(safety.reason ?? 'La descarga está bloqueada por la protección local.');
      },
    );
    this.sessionStore = sessionStore ?? new BrowserSessionStore(() => browserProfilePath('session.json'));
    this.bookmarkStore = bookmarkStore ?? new BrowserBookmarkStore();
    this.diagnosticExporter = new BrowserDiagnosticExporter(() => ({
      scopeId: this.scopeId, generation: this.sessionGeneration, parent: this.parentWindow,
      authenticated: this.profileKind === 'authenticated',
      changing: this.scopeChanging || this.shutdownCommitted || this.shutdownFlushing,
    }), () => ({
      startedAt: this.profileStartedAt, runtime: this.getRuntimeDiagnostic(),
      tabs: this.tabs.size, liveViews: [...this.tabs.values()].filter((tab) => tab.view && !tab.view.webContents.isDestroyed()).length,
      detachedWindows: this.detachedWindows.size, groups: this.groups.size,
      downloadStates: this.downloadManager.list().map((download) => download.state),
    }));
    this.bookmarkImporter = new BrowserBookmarkImporter(this.bookmarkStore, () => ({
      scopeId: this.scopeId, generation: this.sessionGeneration,
      changing: this.scopeChanging || this.shutdownCommitted || this.ephemeralCleanupPending || this.ephemeralCleanupFailed, parent: this.parentWindow,
    }));
    this.historyImporter = new BrowserHistoryImporter(this.historyStore, () => ({
      scopeId: this.scopeId, generation: this.sessionGeneration,
      changing: this.scopeChanging || this.shutdownCommitted || this.ephemeralCleanupPending || this.ephemeralCleanupFailed, parent: this.parentWindow,
    }));
    this.agentPolicyStore = agentPolicyStore ?? new BrowserAgentPolicyStore();
    this.privacyStore = privacyStore ?? new BrowserPrivacyStore();
    this.enterprisePolicyStore = enterprisePolicyStore ?? new BrowserEnterprisePolicyStore();
    this.trackingEngine.install(createTrackingRuleList(1, BUILTIN_TRACKING_RULES));
  }

  /** Permisos del origen que ocupa la pestaña activa, para el panel del sitio. */
  async getSitePermissions(): Promise<BrowserSitePermissionSummary> {
    const url = this.getActiveTab()?.url ?? '';
    if (!this.permissions) {
      return { origin: null, url, secure: false, permissions: [] };
    }
    return this.permissions.getSummary(url);
  }

  async setSitePermission(input: {
    origin?: unknown;
    kind?: unknown;
    state?: unknown;
  }): Promise<BrowserSitePermissionSummary> {
    if (!this.permissions) throw new Error('El navegador no esta iniciado.');
    const assertCurrent = this.captureProfileGuard();
    const permissions = this.permissions;
    const origin = typeof input.origin === 'string' && input.origin
      ? input.origin
      : this.getActiveTab()?.url ?? '';
    await permissions.setPermission(
      origin,
      input.kind as BrowserSitePermissionKind,
      input.state as BrowserSitePermissionState,
    );
    assertCurrent();
    return permissions.getSummary(origin);
  }

  async resetSitePermissions(input: { origin?: unknown } = {}): Promise<BrowserSitePermissionSummary> {
    if (!this.permissions) throw new Error('El navegador no esta iniciado.');
    const assertCurrent = this.captureProfileGuard();
    const permissions = this.permissions;
    const origin = typeof input.origin === 'string' && input.origin
      ? input.origin
      : this.getActiveTab()?.url ?? '';
    await permissions.resetOrigin(origin);
    assertCurrent();
    return permissions.getSummary(origin);
  }

  attachWindow(window: BrowserWindow): void {
    if (this.parentWindow === window) return;
    this.detachWindow();
    this.parentWindow = window;
    this.extensionAuthCleanup = onAuthStateChange(() => {
      this.extensionAuthRevision++;
      this.extensionManager.resetForProfileChange();
    });
    this.shutdownCommitted = false;
    this.credentialAutosaveEnabled = false;
    this.credentialAutosaveRevision++;
    this.mainWindowFocusHandler = () => {
      const primary = this.primaryTabId ? this.tabs.get(this.primaryTabId) : null;
      if (!primary || this.detachedWindows.has(primary.id) || this.activeTabId === primary.id) return;
      this.activeTabId = primary.id;
      primary.lastActivatedAt = Date.now();
      this.deferPassiveCapture(primary);
      this.emitState();
    };
    window.on('focus', this.mainWindowFocusHandler);
    window.once('closed', () => this.detachWindow(window));
    this.startObservationTimer();
    const profileReady = this.flushClosedProfileForShutdown();
    void profileReady.then(() => {
      if (this.parentWindow === window && !this.scopeChanging) return this.loadCredentialAutosave();
    }).catch(() => undefined);
    const loadSession = () => this.loadRestorableSession().catch(() => {
      console.warn('[Navegador][Sesión] No se pudo leer la sesión anterior; se conserva sin modificar.');
    });
    if (this.capabilities.sessionRestore && !this.scopeChanging) {
      if (!this.ephemeralCleanupPending) void loadSession();
      else void profileReady.then(() => {
        if (this.parentWindow !== window || this.scopeChanging) return;
        return loadSession();
      }).catch(() => undefined);
    }
    const loadEnterprise = () => this.ensureEnterprisePolicy().catch(() => undefined);
    if (this.capabilities.enterpriseControls) void (this.ephemeralCleanupPending ? profileReady.then(() => {
      if (this.parentWindow !== window || this.scopeChanging) return;
      return loadEnterprise();
    }) : loadEnterprise()).catch(() => undefined);
    void profileReady.catch(() => undefined);
  }

  detachWindow(expectedWindow?: BrowserWindow): void {
    if (expectedWindow && this.parentWindow !== expectedWindow) return;
    if (!this.parentWindow) return;
    this.extensionAuthCleanup?.(); this.extensionAuthCleanup = null; this.extensionAuthRevision++;
    this.cancelSyncOperation();
    this.requestSafety.cancelAll();
    const detachedScopeId = this.scopeId;
    if (this.parentWindow && this.mainWindowFocusHandler) {
      this.parentWindow.removeListener('focus', this.mainWindowFocusHandler);
    }
    this.mainWindowFocusHandler = null;
    const pendingSave = this.persistSession(true).catch(() => {
      console.warn('[Navegador][Sesión] No se pudo guardar al cerrar; se conserva el último respaldo válido.');
    });
    this.teardownBrowsingSession('La ventana principal se cerro antes de mostrar el navegador.');
    this.downloadManager.resetForProfileChange();
    this.parentWindow = null;
    this.stopObservationTimer();
    if (isEphemeralBrowserScope(detachedScopeId)) void this.startEphemeralCleanup(detachedScopeId, pendingSave);
  }

  /** Barrera main: no destruye vistas ni consume la sesión ofrecida. */
  async flushSessionForShutdown(): Promise<void> {
    if (!this.capabilities.sessionRestore) {
      await this.flushClosedProfileForShutdown();
      return;
    }
    const generation = this.sessionGeneration;
    const shutdownRevision = this.shutdownRevision;
    if (this.scopeChanging) throw new Error('El perfil está cambiando durante el cierre.');
    this.shutdownFlushing = true;
    if (this.sessionSaveTimer) { clearTimeout(this.sessionSaveTimer); this.sessionSaveTimer = null; }
    if (this.parentWindow) await this.loadRestorableSession();
    if (generation !== this.sessionGeneration || shutdownRevision !== this.shutdownRevision || this.scopeChanging) throw new Error('La sesión cambió durante el cierre.');
    const previous = this.lastSessionSnapshot;
    if (this.tabs.size === 0 && !this.restorableSession && this.lastSessionSaveFailed && previous?.scopeId === this.scopeId) {
      await this.saveSessionSnapshot(previous.snapshot);
    } else await this.persistSession(true);
    // Incluye un guardado iniciado en detachWindow cuando ya no quedan vistas.
    await this.lastSessionSave;
    if (generation !== this.sessionGeneration || shutdownRevision !== this.shutdownRevision || this.scopeChanging) throw new Error('La sesión cambió durante el cierre.');
    // Navegaciones y gestos que llegaron durante la E/S deben entrar en el
    // checkpoint. No comparar savedAt: cambia aunque las pestañas sean iguales.
    while (true) {
      const current = this.buildSessionSnapshot(true);
      const saved = this.lastSessionSnapshot?.snapshot;
      if (!current || !saved || JSON.stringify({ ...current, savedAt: '' }) === JSON.stringify({ ...saved, savedAt: '' })) break;
      await this.saveSessionSnapshot(current);
      if (generation !== this.sessionGeneration || shutdownRevision !== this.shutdownRevision || this.scopeChanging) throw new Error('La sesión cambió durante el cierre.');
    }
    // detachWindow puede haber iniciado la limpieza de un perfil efímero;
    // la barrera de cierre no termina hasta que esa cola queda estable.
    await this.flushClosedProfileForShutdown();
  }

  commitShutdown(): void {
    this.lockCredentials();
    this.semanticMemory.cancel();
    this.agentTaskBinding?.control.command('stop');
    this.cancelSyncOperation();
    this.requestSafety.cancelAll();
    this.shutdownCommitted = true;
    if (this.sessionSaveTimer) { clearTimeout(this.sessionSaveTimer); this.sessionSaveTimer = null; }
    // beforeunload todavía puede cancelar la salida: aquí no se purga.
  }

  /** Se espera también en will-quit, después del cierre efectivo de vistas. */
  async flushClosedProfileForShutdown(): Promise<void> {
    const generation = this.sessionGeneration;
    if (this.ephemeralCleanupFailed && this.ephemeralCleanupScope) {
      await this.startEphemeralCleanup(this.ephemeralCleanupScope);
    } else await this.ephemeralCleanup;
    if (generation !== this.sessionGeneration) throw new Error('La ventana cambió durante la limpieza del perfil.');
  }

  resumeAfterShutdown(): void {
    this.shutdownRevision += 1;
    this.shutdownFlushing = false;
    this.shutdownCommitted = false;
    this.queueSessionSave();
  }

  /**
   * Vincula el navegador al usuario con sesion activa. Se invoca en cada cambio
   * de estado de autenticacion (login, cierre de sesion y cambio de cuenta).
   *
   * Cerrar sesion no puede dejar el navegador como estaba: las pestañas abiertas
   * siguen autenticadas en los sitios del usuario anterior y sus vistas siguen
   * leyendo la particion y los archivos de ese perfil. Por eso se derriba toda la
   * navegacion en curso y se conmuta el perfil antes de que exista una nueva
   * sesion.
   */
  async applyUserScope(userId: string | null | undefined): Promise<void> {
    const nextScopeId = browserScopeIdFor(userId);
    // Salir a invitado desde el selector no equivale a cerrar la sesión real.
    // Sólo la autenticación puede conservar o revocar el perfil al que volver.
    this.authenticatedScopeId = userId ? nextScopeId : null;
    await this.transitionProfile(nextScopeId, userId ? 'authenticated' : 'guest');
  }

  getProfile(): BrowserProfileDescriptor {
    const kind = this.profileKind;
    return {
      id: kind === 'authenticated' || kind === 'private' ? this.scopeId : BROWSER_ANONYMOUS_SCOPE,
      kind,
      label: kind === 'authenticated' ? 'Perfil autenticado' : kind === 'private' ? 'Ventana privada' : 'Invitado',
      persistent: kind === 'authenticated',
      managed: false,
    };
  }

  async setProfileKind(kind: BrowserProfileKind): Promise<BrowserProfileDescriptor> {
    this.assertCapability('profiles');
    if (!['authenticated', 'guest', 'private'].includes(kind)) throw new Error('El perfil indicado no es válido.');
    const assertCurrent = this.captureProfileGuard();
    if (kind === this.profileKind) return this.getProfile();
    if (this.agentControlling) throw new Error('Toma el control antes de cambiar el perfil.');
    if (this.profileSelectionPending) throw new Error('Ya hay una confirmación de cambio de perfil pendiente.');
    const target = kind === 'authenticated'
      ? this.authenticatedScopeId
      : kind === 'guest' ? BROWSER_ANONYMOUS_SCOPE : browserPrivateScopeId();
    if (!target) throw new Error('No hay una sesión autenticada disponible para volver al perfil persistente.');
    this.profileSelectionPending = true;
    const expiresAt = Date.now() + 5 * 60_000;
    try {
      const confirmation = await dialog.showMessageBox(this.requireParentWindow(), {
        type: 'warning', title: 'Cambiar perfil de navegación',
        message: 'Se cerrarán las pestañas del perfil actual.',
        detail: this.profileKind === 'authenticated'
          ? 'Los datos persistentes de tu cuenta se conservarán. El nuevo perfil tendrá una sesión separada.'
          : 'Se eliminarán los datos temporales de este perfil. Los archivos que descargaste fuera del perfil no se borrarán.',
        buttons: ['Cancelar', 'Cambiar perfil'], defaultId: 0, cancelId: 0, noLink: true,
      });
      assertCurrent();
      if (this.agentControlling || Date.now() > expiresAt) throw new Error('La confirmación del perfil ya no está vigente.');
      if (confirmation.response !== 1) return this.getProfile();
      await this.transitionProfile(target, kind);
      return this.getProfile();
    } finally { this.profileSelectionPending = false; }
  }

  private async transitionProfile(nextScopeId: string, nextKind: BrowserProfileKind): Promise<void> {
    this.semanticMemory.cancel();
    this.cancelSyncOperation();
    this.requestSafety.cancelAll();
    if (nextScopeId === this.scopeId && nextKind === this.profileKind && !this.scopeChanging) return;
    const previousScopeId = this.scopeId;
    const transition = ++this.scopeTransition;
    this.scopeChanging = true;
    this.credentialAutosaveEnabled = false;
    this.credentialAutosaveRevision++;

    const pendingSave = this.persistSession(true).catch(() => {
      console.warn('[Navegador][Sesión] No se pudo guardar antes del cambio de cuenta.');
    });
    this.teardownBrowsingSession();
    this.downloadManager.resetForProfileChange();
    if (isEphemeralBrowserScope(previousScopeId)) {
      await this.startEphemeralCleanup(previousScopeId, pendingSave);
    } else {
      await this.historyStore.flushAndClose();
      await pendingSave;
    }
    if (transition !== this.scopeTransition) return;
    // No cambiar el scope global antes de drenar los stores del perfil saliente.
    if (nextScopeId === BROWSER_ANONYMOUS_SCOPE && nextScopeId !== previousScopeId) {
      await this.purgeEphemeralProfile(nextScopeId);
      if (transition !== this.scopeTransition) return;
    }
    this.scopeId = nextScopeId;
    this.profileKind = nextKind;
    if (nextKind === 'authenticated') this.authenticatedScopeId = nextScopeId;
    this.profileStartedAt = Date.now();
    this.lastSessionSave = Promise.resolve();
    this.lastSessionSaveFailed = false;
    this.lastSessionSnapshot = null;
    setBrowserScopeId(nextScopeId);
    setBrowserProfileKind(nextKind);
    this.enterprisePolicy = null;
    this.enterprisePolicyReady = false;
    this.enterprisePolicyLoad = null;
    this.sitePermissionStore.invalidateCache();
    this.sessionLoadedScope = null;
    this.restorableSession = null;
    console.log('[Navegador] Perfil conmutado por cambio de sesion.');

    if (transition !== this.scopeTransition) return;
    this.scopeChanging = false;
    if (this.parentWindow) void this.loadCredentialAutosave();
    this.emitState();
    if (this.parentWindow && this.capabilities.sessionRestore) {
      await this.loadRestorableSession().catch(() => {
        console.warn('[Navegador][Sesión] No se pudo cargar la sesión de este perfil.');
      });
    }
  }

  /**
   * Cierra pestañas, ventanas separadas, permisos y observacion, conservando la
   * ventana anfitriona: el renderer volvera a publicar su viewport cuando el
   * nuevo usuario abra el navegador.
   */
  private teardownBrowsingSession(reason = 'La sesion del navegador se cerro.'): void {
    this.lockCredentials();
    this.semanticMemory.cancel();
    this.agentTaskBinding?.control.command('stop');
    this.requestSafety.cancelAll();
    this.safetyInterstitials.clear();
    this.sessionGeneration += 1;
    this.enterprisePolicy = null;
    this.enterprisePolicyReady = false;
    this.enterprisePolicyFailed = false;
    this.enterprisePolicyLoad = null;
    this.sessionLoadedScope = null;
    this.sessionLoad = null;
    this.restorableSession = null;
    this.rejectViewportWaiters(new Error(reason));
    this.discardPermissionPrompts();
    this.permissions?.dispose();
    this.permissions = null;
    this.passkeySelection?.dispose();
    this.passkeySelection = null;
    this.closePictureInPictureWindows();
    if (this.fullscreenTabId) this.leaveHtmlFullScreen(this.fullscreenTabId);
    this.fullscreenTabId = null;
    this.fullscreenRestore = null;
    for (const [tabId, detached] of this.detachedWindows) {
      const tab = this.tabs.get(tabId);
      if (tab?.view) {
        try { detached.contentView.removeChildView(tab.view); } catch { /* cierre idempotente */ }
      }
      try { if (!detached.isDestroyed()) detached.destroy(); } catch { /* cierre idempotente */ }
    }
    this.detachedWindows.clear();
    for (const tab of this.tabs.values()) this.destroyTab(tab);
    this.tabs.clear();
    this.closedTabs = [];
    this.groups.clear();
    this.tabLayout = 'horizontal';
    this.activeTabId = null;
    this.primaryTabId = null;
    this.secondaryTabId = null;
    this.viewMode = 'single';
    this.overlayTopTabId = null;
    this.customOverlayBounds = null;
    this.viewport = null;
    this.visible = false;
    this.agentControlling = false;
    if (this.selectionProbeTimer) {
      clearTimeout(this.selectionProbeTimer);
      this.selectionProbeTimer = null;
    }
    this.lastReportedSelection = '';
    this.latestObservation = null;
    this.observationInFlight = null;
    this.observationInFlightTarget = null;
    this.latestVisualCapture = null;
    this.visualCaptureInFlight = null;
    this.visualCaptureInFlightTarget = null;
    this.observationLastError = null;
    // Las extensiones pertenecen al perfil: el proximo perfil restaura las suyas.
    this.extensionManager.resetForProfileChange();
    this.extensionsRestored = false;
    this.readingModeService.dispose();
    if (this.sessionSaveTimer) {
      clearTimeout(this.sessionSaveTimer);
      this.sessionSaveTimer = null;
    }
  }

  /** Vacía la partición y archivos de un perfil efímero (invitado o privado). */
  private async purgeEphemeralProfile(scopeId: string): Promise<void> {
    if (!isEphemeralBrowserScope(scopeId)) return;
    if (scopeId !== BROWSER_ANONYMOUS_SCOPE && !/^privado-[a-f0-9]{24}$/.test(scopeId)) {
      throw new Error('El identificador del perfil temporal no es válido.');
    }
    const ephemeral = electronSession.fromPartition(browserPartitionFor(scopeId));
    // Intentar todas las categorías, pero nunca informar éxito parcial.
    const results = await Promise.allSettled([
      ephemeral.clearStorageData(), ephemeral.clearCache(), ephemeral.clearAuthCache(),
      fs.rm(browserProfileRoot(scopeId), { recursive: true, force: true }),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('No se pudo completar la limpieza del perfil temporal. Vuelve a intentarlo.');
    }
  }

  private startEphemeralCleanup(scopeId: string, pendingSave: Promise<void> = Promise.resolve()): Promise<void> {
    if (this.ephemeralCleanupPending) return this.ephemeralCleanup;
    this.ephemeralCleanupPending = true;
    this.ephemeralCleanupFailed = false;
    this.ephemeralCleanupScope = scopeId;
    // Capturar ahora las colas y rutas: la próxima cuenta aún no está activa.
    const stores = this.flushEphemeralStores();
    const cleanup = Promise.allSettled([pendingSave, stores]).then(async (results) => {
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      await this.purgeEphemeralProfile(scopeId);
      this.sitePermissionStore.invalidateCache();
      this.privacyStore.invalidateCache();
      this.enterprisePolicyStore.invalidateCache();
      this.lastSessionSave = Promise.resolve();
      this.lastSessionSaveFailed = false;
      this.lastSessionSnapshot = null;
    });
    this.ephemeralCleanup = cleanup;
    void cleanup.then(() => {
      if (this.ephemeralCleanup !== cleanup) return;
      this.ephemeralCleanupPending = false;
      this.ephemeralCleanupScope = null;
    }, () => {
      if (this.ephemeralCleanup !== cleanup) return;
      this.ephemeralCleanupPending = false;
      this.ephemeralCleanupFailed = true;
      console.warn('[Navegador] La limpieza del perfil temporal no terminó; se requiere reintentar.');
    });
    return cleanup;
  }

  /** Espera las colas de todos los stores que escriben bajo el perfil actual. */
  private async flushEphemeralStores(): Promise<void> {
    const results = await Promise.allSettled([
      this.historyStore.flushAndClose(),
      this.sessionStore.flush(),
      this.bookmarkStore.flush(),
      this.credentialVault.flush(),
      this.agentPolicyStore.flush(),
      this.shortcutStore.flush(),
      this.privacyStore.flush(),
      this.enterprisePolicyStore.flush(),
      this.sitePermissionStore.flush(),
      this.extensionManager.flush(),
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }

  getState(): IntegratedBrowserState {
    const active = this.getActiveTab();
    if (active) this.snapshotTab(active);
    const contents = active?.view?.webContents ?? null;
    return {
      url: active?.url || 'about:blank',
      profileRevision: this.scopeTransition,
      credentialUnlocked: this.credentialUnlock.isUnlocked(),
      title: active?.title || 'Navegador',
      canGoBack: contents?.navigationHistory.canGoBack() ?? active?.canGoBack ?? false,
      canGoForward: contents?.navigationHistory.canGoForward() ?? active?.canGoForward ?? false,
      isLoading: active?.loading ?? false,
      isVisible: this.visible || Array.from(this.detachedWindows.values()).some((window) => this.isWindowUsable(window)),
      agentControlling: this.agentControlling,
      agentTask: this.agentTaskBinding?.profileRevision === this.scopeTransition && this.agentTaskBinding.scope === getBrowserScopeId() ? this.agentTaskBinding.control.snapshot() : null,
      agentPolicyPromptIds: Array.from(this.agentPolicyPrompts.keys()),
      error: active?.error ?? null,
      tabs: Array.from(this.tabs.values()).map((tab) => this.toTabState(tab)),
      activeTabId: this.activeTabId,
      primaryTabId: this.primaryTabId,
      secondaryTabId: this.viewMode === 'single' ? null : this.secondaryTabId,
      viewMode: this.viewMode,
      // El renderer necesita saberlo para retirar su barra y su chat: en
      // pantalla completa la vista nativa los cubre y quedarian pintados
      // debajo, capturando clics que el usuario ya no ve.
      isFullscreen: this.fullscreenTabId !== null,
      tabLayout: this.tabLayout,
      groups: Array.from(this.groups.values()).map((group) => ({ ...group })),
      canReopenClosedTab: this.closedTabs.length > 0,
      restoreAvailable: this.restorableSession ? {
        tabCount: this.restorableSession.tabs.length,
        savedAt: this.restorableSession.savedAt,
        cleanExit: this.restorableSession.cleanExit,
      } : null,
    };
  }

  async restorePreviousSession(): Promise<IntegratedBrowserState> {
    if (!this.capabilities.sessionRestore) throw new Error('La restauración de sesión no está habilitada.');
    const generation = this.sessionGeneration;
    const parent = this.requireParentWindow();
    await this.loadRestorableSession();
    await this.ensureEnterprisePolicy();
    if (generation !== this.sessionGeneration || parent !== this.parentWindow) throw new Error('La sesión cambió durante la restauración.');
    if (this.agentControlling) throw new Error('Detén la tarea del agente antes de restaurar la sesión.');
    const snapshot = this.restorableSession;
    if (!snapshot) throw new Error('No hay una sesión anterior disponible.');
    if (snapshot.tabs.some((tab) => !this.enterpriseUrlAllowed(tab.url))) throw new Error('La sesión contiene sitios bloqueados por tu organización.');
    if (this.fullscreenTabId) this.leaveHtmlFullScreen(this.fullscreenTabId);
    this.closePictureInPictureWindows();
    this.discardPermissionPrompts();
    for (const tab of this.tabs.values()) this.destroyTab(tab);
    this.tabs.clear();
    this.groups = new Map(snapshot.groups.map((group) => [group.id, { ...group }]));
    this.tabLayout = snapshot.tabLayout;
    this.activeTabId = null;
    this.primaryTabId = null;
    this.secondaryTabId = null;
    const idMap = new Map<string, string>();
    for (const saved of snapshot.tabs) {
      const tab = this.createTabRuntime(false);
      idMap.set(saved.id, tab.id);
      tab.url = saved.url;
      tab.title = saved.title;
      tab.pinned = saved.pinned;
      tab.muted = saved.muted;
      tab.groupId = saved.groupId;
    }
    this.activeTabId = idMap.get(snapshot.activeTabId ?? '') ?? this.tabs.keys().next().value ?? null;
    this.primaryTabId = idMap.get(snapshot.primaryTabId ?? '') ?? this.activeTabId;
    this.secondaryTabId = idMap.get(snapshot.secondaryTabId ?? '') ?? null;
    this.viewMode = this.secondaryTabId ? snapshot.viewMode : 'single';
    this.overlayTopTabId = null;
    this.customOverlayBounds = null;
    this.closedTabs = [];
    // Las pestañas de fondo permanecen lógicas hasta activarlas: restaurar
    // cientos no debe navegar cientos de sitios ni sobrepasar ocho vistas.
    const activeTabId = this.activeTabId;
    for (const savedId of snapshot.detachedTabIds) this.detachTabInternal(idMap.get(savedId)!);
    if (activeTabId) this.activateTabInternal(activeTabId);
    this.restorableSession = null;
    this.applyViewLayout();
    this.emitState();
    return this.getState();
  }

  async discardPreviousSession(): Promise<IntegratedBrowserState> {
    if (!this.capabilities.sessionRestore) throw new Error('La restauración de sesión no está habilitada.');
    const generation = this.sessionGeneration;
    await this.loadRestorableSession();
    if (generation !== this.sessionGeneration) throw new Error('La sesión cambió antes del descarte.');
    await this.sessionStore.clear();
    if (generation !== this.sessionGeneration) throw new Error('La sesión cambió durante el descarte.');
    this.restorableSession = null;
    this.emitState();
    return this.getState();
  }

  async open(rawUrl?: unknown): Promise<IntegratedBrowserState> {
    const assertCurrent = this.captureNavigationGuard(true);
    await this.ephemeralCleanup;
    assertCurrent();
    await this.ensureEnterprisePolicy();
    assertCurrent();
    const contents = this.ensureView().webContents;
    const currentUrl = contents.getURL();
    if (rawUrl !== undefined) {
      await this.loadTarget(rawUrl);
    } else if (!currentUrl || currentUrl === 'about:blank') {
      if (!this.enterpriseUrlAllowed(INTEGRATED_BROWSER_HOME)) throw new Error('El sitio está bloqueado por tu organización.');
      await this.loadTarget(INTEGRATED_BROWSER_HOME);
    }
    return this.getState();
  }

  async navigate(rawTarget: unknown, assertCurrent?: () => void): Promise<IntegratedBrowserState> {
    const assertNavigationCurrent = this.captureNavigationGuard(true);
    await this.ephemeralCleanup;
    assertNavigationCurrent();
    await this.ensureEnterprisePolicy();
    assertNavigationCurrent();
    assertCurrent?.();
    this.ensureView();
    await this.loadTarget(rawTarget, assertCurrent);
    return this.getState();
  }

  listDownloads() { this.assertCapability('downloads'); return this.downloadManager.list(); }
  cancelDownload(id: string) { this.assertCapability('downloads'); return this.downloadManager.cancel(id); }
  resumeDownload(id: string) { this.assertCapability('downloads'); return this.downloadManager.resume(id); }
  async retryDownload(id: string) {
    this.assertCapability('downloads');
    await this.ensureEnterprisePolicy();
    return this.downloadManager.retry(id, this.ensureView().webContents, (sourceUrl) => {
      if (!this.enterpriseUrlAllowed(sourceUrl)) throw new Error('La descarga está bloqueada por tu organización.');
      const safety = checkBrowserNavigationLocal(sourceUrl);
      if (safety.action === 'block') throw new Error(safety.reason ?? 'La descarga está bloqueada por la protección local.');
    });
  }
  async openDownload(id: string): Promise<boolean> { this.assertCapability('downloads'); await this.downloadManager.open(id); return true; }
  revealDownload(id: string): boolean { this.assertCapability('downloads'); this.downloadManager.reveal(id); return true; }

  getRuntimeDiagnostic(): BrowserRuntimeDiagnostic {
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron ?? 'desconocida',
      chromiumVersion: process.versions.chrome ?? 'desconocida',
      nodeVersion: process.versions.node,
      profileKind: this.profileKind,
      protectionLevel: this.enterprisePolicy?.forcedPrivacyLevel ?? (this.capabilities.privacyProtection ? 'balanced' : 'off'),
      managed: this.enterprisePolicy !== null,
      enterprisePolicyStatus: !this.capabilities.enterpriseControls ? 'disabled' : this.enterprisePolicyReady ? 'ready' : this.enterprisePolicyFailed ? 'error' : 'loading',
      checkedAt: new Date().toISOString(),
    };
  }

  exportRuntimeDiagnostic() { return this.diagnosticExporter.exportFromDialog(); }

  listBookmarks(query?: string) { this.assertCapability('mainBookmarks'); this.captureProfileGuard()(); return this.bookmarkStore.list(query); }
  saveBookmark(input: { id?: string; url: string; title: string; folderId?: string | null; tags?: string[]; position?: number }) { this.assertCapability('mainBookmarks'); this.captureProfileGuard()(); return this.bookmarkStore.save(input); }
  removeBookmark(id: string) { this.assertCapability('mainBookmarks'); this.captureProfileGuard()(); return this.bookmarkStore.remove(id); }
  migrateLegacyBookmarks(entries: unknown) { this.assertCapability('mainBookmarks'); this.captureProfileGuard()(); return this.bookmarkStore.migrateLegacy(entries); }
  async getAgentPolicy(origin?: string) {
    const assertCurrent = this.captureProfileGuard();
    const target = origin ?? this.getState().url;
    await this.ensureEnterprisePolicy(); assertCurrent();
    const policy = await this.agentPolicyStore.get(target); assertCurrent();
    return { ...policy, decision: this.enterprisePolicy?.agentAllowed === false ? 'block' as const : policy.decision, enabled: this.capabilities.agentGovernance, managed: policy.managed || this.enterprisePolicy?.agentAllowed === false };
  }
  async setAgentPolicy(input: { origin?: string; mode: BrowserAgentPolicyMode; decision: BrowserAgentSiteDecision }) {
    const assertCurrent = this.captureProfileGuard();
    const target = input.origin ?? this.getState().url;
    await this.ensureEnterprisePolicy(); assertCurrent();
    if (this.enterprisePolicy?.agentAllowed === false) throw new Error('El agente está administrado por tu organización.');
    // Invalidar antes de esperar evita que una tarea use una autorización anterior.
    this.agentPolicyRevision += 1;
    const policy = await this.agentPolicyStore.set({ ...input, origin: target }); assertCurrent();
    return { ...policy, enabled: this.capabilities.agentGovernance };
  }
  async getPrivacySite(origin?: string) {
    const assertCurrent = this.captureProfileGuard();
    const target = origin ?? this.getState().url;
    await this.ensureEnterprisePolicy(); assertCurrent();
    const site = await this.privacyStore.get(target); assertCurrent();
    return { ...this.effectivePrivacyState(site), enabled: this.privacyProtectionEnabled(), managed: Boolean(this.enterprisePolicy?.forcedPrivacyLevel) };
  }
  async setPrivacySite(input: { origin?: string; level: BrowserPrivacyLevel; exceptionCategories: BrowserPrivacyCategory[] }) {
    const assertCurrent = this.captureProfileGuard();
    const target = input.origin ?? this.getState().url;
    await this.ensureEnterprisePolicy(); assertCurrent();
    if (this.enterprisePolicy?.forcedPrivacyLevel) throw new Error('La privacidad está administrada por tu organización.');
    const site = await this.privacyStore.set({ ...input, origin: target }); assertCurrent();
    return { ...site, enabled: this.capabilities.privacyProtection, managed: false };
  }
  importBookmarksHtml() { this.assertCapability('mainBookmarks'); this.captureProfileGuard()(); return this.bookmarkImporter.importFromDialog(); }

  private policyRecoveryPending = false;
  async recoverPolicyStore(raw: unknown, assertCaller: () => void): Promise<{ cancelled: boolean; restored: number }> {
    const input = validatePolicyRecoveryRequest(raw);
    if (this.policyRecoveryPending) throw new Error('Ya hay una recuperación en revisión.');
    const profile = this.captureProfileGuard(); const parent = this.requireParentWindow();
    const control = this.agentControlRevision; let sessionChanged = false;
    const off = onAuthStateChange(() => { sessionChanged = true; });
    const guard = () => {
      assertCaller(); profile(); const auth = getAuthState();
      if (sessionChanged || !auth.authenticated || !auth.userId || this.profileKind !== 'authenticated'
        || browserScopeIdFor(auth.userId) !== this.scopeId || input.profileRevision !== this.getState().profileRevision
        || this.agentControlling || control !== this.agentControlRevision || parent.isDestroyed() || !parent.isVisible()) throw new Error('La recuperación quedó fuera de contexto.');
    };
    this.policyRecoveryPending = true;
    try {
      guard(); await this.ensureEnterprisePolicy(); guard();
      if (input.store === 'semantic' || input.store === 'audit') this.assertCapability('agentGovernance');
      if (input.store === 'history') this.assertCapability('advancedHistory');
      if (input.store === 'shortcuts') {
        this.assertCapability('agentGovernance');
        if (this.enterprisePolicy?.agentAllowed === false) throw new Error('Los atajos están bloqueados por tu organización.');
      }
      const store = input.store === 'permissions' ? this.sitePermissionStore : input.store === 'privacy' ? this.privacyStore
        : input.store === 'shortcuts' ? this.shortcutStore : input.store === 'semantic' ? this.semanticMemory
        : input.store === 'history' ? this.historyStore : input.store === 'audit' ? this.auditStore : this.agentPolicyStore;
      const review = await store.prepareRecovery(guard); guard();
      const decision = await dialog.showMessageBox(parent, {
        type: 'warning', title: 'Recuperación de ajustes del navegador',
        message: input.store === 'semantic' ? '¿Recuperar el almacén de memoria semántica vacío y desactivado?' : `¿Recuperar ${review.count} ${['shortcuts', 'history', 'audit'].includes(input.store) ? 'entradas' : 'sitios'} de ${POLICY_RECOVERY_LABELS[input.store]}?`,
        detail: input.store === 'history' || input.store === 'audit'
          ? 'Se recupera la última instantánea SQLite compatible; puede no incluir cambios recientes. Se aplica la retención vigente y se conserva cifrado el original dañado. Borrar, recortar datos o cambiar retención retira las copias locales anteriores. No cambia páginas abiertas, permisos, credenciales ni sincronización.'
          : input.store === 'semantic'
          ? 'Se conserva una copia cifrada del índice dañado hasta la siguiente modificación de memoria. No se recuperan fuentes ni vectores antiguos y no se contacta al proveedor. Para reconstruir el índice debes volver a activarlo con consentimiento. No cambia historial, marcadores, contraseñas ni sincronización.'
          : input.store === 'shortcuts'
          ? 'El principal falta o está dañado. La copia puede no incluir cambios recientes. Se conservarán el respaldo y una copia cifrada del principal dañado. Revisa las instrucciones recuperadas antes de usarlas: reciben identificadores nuevos, no se ejecutan ni conceden permisos. No cambia políticas empresariales, credenciales ni sincronización.'
          : 'El principal falta o está dañado. La copia puede no incluir cambios recientes. Se conservarán el respaldo y una copia cifrada del principal dañado. Se retiran permisos concedidos, permitir siempre y excepciones de privacidad: el agente vuelve a preguntar y la privacidad queda estricta. No cambia políticas empresariales, credenciales ni sincronización.',
        buttons: ['Cancelar', 'Recuperar con restricciones'], defaultId: 0, cancelId: 0, noLink: true,
      });
      guard(); if (decision.response !== 1) return { cancelled: true, restored: 0 };
      this.agentPolicyRevision++;
      await review.commit(); guard();
      if (input.store === 'permissions') await this.sitePermissionStore.warmUp();
      if (input.store === 'privacy') await this.privacyStore.hydrate();
      guard(); this.emitState(); return { cancelled: false, restored: review.count };
    } finally { this.policyRecoveryPending = false; off(); }
  }

  async recoverBookmarks(): Promise<{ cancelled: boolean; restored: number }> {
    this.assertCapability('mainBookmarks');
    if (this.bookmarkRecoveryPending) throw new BookmarkImportRejected('Ya hay una recuperación de marcadores pendiente.');
    const profileGuard = this.captureProfileGuard();
    const controlRevision = this.agentControlRevision;
    const guard = () => {
      profileGuard();
      if (this.agentControlling || this.agentControlRevision !== controlRevision) throw new BookmarkImportRejected('Toma el control del navegador y vuelve a revisar la recuperación.');
    };
    guard();
    const parent = this.parentWindow!;
    this.bookmarkRecoveryPending = true;
    try {
      const prepared = await this.bookmarkStore.prepareRecovery(); guard();
      const decision = await dialog.showMessageBox(parent, {
        type: 'warning', title: 'Recuperar marcadores', message: `¿Restaurar ${prepared.count} marcadores del respaldo local?`,
        detail: 'El archivo principal falta o está dañado. El respaldo puede no incluir tus últimos cambios. Se conservarán el respaldo y una copia del principal dañado, si existe. No se recuperan contraseñas ni historial.',
        buttons: ['Cancelar', 'Restaurar respaldo'], defaultId: 0, cancelId: 0, noLink: true,
      });
      guard();
      if (decision.response !== 1) return { cancelled: true, restored: 0 };
      const restored = await prepared.commit(guard); guard();
      return { cancelled: false, restored };
    } catch (error) {
      if (error instanceof BookmarkImportRejected) throw error;
      throw new BookmarkImportRejected('No se pudo recuperar el respaldo de marcadores. Los archivos existentes se conservaron.');
    } finally { this.bookmarkRecoveryPending = false; }
  }

  async exportBookmarksHtml() {
    this.assertCapability('mainBookmarks');
    const assertCurrent = this.captureProfileGuard();
    const scopeId = this.scopeId;
    if (!this.parentWindow) throw new Error('El navegador no está iniciado.');
    const selection = await dialog.showSaveDialog(this.parentWindow, {
      title: 'Exportar marcadores',
      defaultPath: path.join(app.getPath('documents'), 'marcadores-soflia.html'),
      filters: [{ name: 'Marcadores HTML', extensions: ['html'] }],
    });
    if (selection.canceled || !selection.filePath) return { cancelled: true, exported: 0 };
    assertCurrent();
    if (this.scopeId !== scopeId) throw new Error('El perfil cambió durante la exportación.');
    const destination = selection.filePath.toLocaleLowerCase('es').endsWith('.html') ? selection.filePath : `${selection.filePath}.html`;
    const html = await this.bookmarkStore.exportHtml();
    assertCurrent();
    if (this.scopeId !== scopeId) throw new Error('El perfil cambió durante la exportación.');
    await fs.writeFile(destination, html, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return { cancelled: false, exported: (await this.bookmarkStore.list()).length };
  }

  findInPage(rawQuery: unknown, forward = true): IntegratedBrowserState {
    this.assertCapability('pageTools');
    const query = validateFindQuery(rawQuery);
    const tab = this.getActiveTab();
    if (!tab) throw new Error('No hay una pestaña activa.');
    const contents = this.requireTabView(tab).webContents;
    if (!query) {
      contents.stopFindInPage('clearSelection');
      tab.find = null;
    } else {
      const sameQuery = tab.find?.query === query;
      tab.find = {
        query,
        activeMatchOrdinal: tab.find?.activeMatchOrdinal ?? 0,
        matches: tab.find?.matches ?? 0,
        finalUpdate: false,
      };
      contents.findInPage(query, { forward, findNext: sameQuery });
    }
    this.emitState();
    return this.getState();
  }

  stopFindInPage(): IntegratedBrowserState {
    this.assertCapability('pageTools');
    const tab = this.getActiveTab();
    if (!tab) return this.getState();
    this.requireTabView(tab).webContents.stopFindInPage('clearSelection');
    tab.find = null;
    this.emitState();
    return this.getState();
  }

  setZoom(action: BrowserZoomAction): IntegratedBrowserState {
    this.assertCapability('pageTools');
    const tab = this.getActiveTab();
    if (!tab) throw new Error('No hay una pestaña activa.');
    const contents = this.requireTabView(tab).webContents;
    const factor = nextBrowserZoomFactor(supportsIsolatedBrowserZoom(contents) ? contents.getZoomFactor() : tab.zoomFactor, action);
    applyBrowserTabZoom(contents, factor, tab.appliedBounds);
    tab.zoomFactor = factor;
    tab.visualRevision++; this.invalidateObservation(tab.id);
    this.agentTaskBinding?.control.command('stop');
    this.emitState();
    return this.getState();
  }

  setMuted(muted: boolean): IntegratedBrowserState {
    this.assertCapability('pageTools');
    const tab = this.getActiveTab();
    if (!tab) throw new Error('No hay una pestaña activa.');
    tab.muted = muted;
    this.requireTabView(tab).webContents.setAudioMuted(muted);
    this.emitState();
    return this.getState();
  }

  toggleFullscreen(): IntegratedBrowserState {
    this.assertCapability('pageTools');
    const tab = this.getActiveTab();
    if (!tab) throw new Error('No hay una pestaña activa.');
    if (this.fullscreenTabId === tab.id) this.leaveHtmlFullScreen(tab.id);
    else this.enterHtmlFullScreen(tab.id);
    return this.getState();
  }

  async printPage(): Promise<IntegratedBrowserState> {
    this.assertCapability('pageTools');
    await printBrowserPage(this.ensureView().webContents);
    return this.getState();
  }

  async savePageAsPdf(): Promise<{ state: IntegratedBrowserState; canceled: boolean; filename?: string }> {
    this.assertCapability('pageTools');
    const tab = this.getActiveTab();
    if (!tab) throw new Error('No hay una pestaña activa.');
    const result = await saveBrowserPageAsPdf(this.requireParentWindow(), this.requireTabView(tab).webContents, tab.title);
    return { state: this.getState(), ...result };
  }

  async createTab(rawUrl?: unknown, activate = true, restored?: BrowserSessionTab): Promise<IntegratedBrowserState> {
    const assertCurrent = this.captureProfileGuard(true);
    await this.ephemeralCleanup;
    assertCurrent();
    await this.ensureEnterprisePolicy();
    assertCurrent();
    const target = rawUrl === undefined ? INTEGRATED_BROWSER_HOME : normalizeBrowserTarget(rawUrl);
    const safety = await checkBrowserNavigation(target, { allowRemote: this.profileKind === 'authenticated' });
    assertCurrent();
    this.assertNavigationAllowed(safety);
    if (!this.enterpriseUrlAllowed(target)) throw new Error('El sitio está bloqueado por tu organización.');
    if (this.tabs.size >= INTEGRATED_BROWSER_MAX_TABS) {
      throw new Error(`El navegador admite hasta ${INTEGRATED_BROWSER_MAX_TABS} pestañas abiertas.`);
    }
    const tab = this.createTabRuntime();
    tab.url = target;
    this.setNavigationSafety(tab, target, safety);
    if (restored) {
      tab.pinned = restored.pinned;
      tab.muted = restored.muted;
      tab.groupId = this.groups.has(restored.groupId ?? '') ? restored.groupId : null;
      this.requireTabView(tab).webContents.setAudioMuted(tab.muted);
      this.moveTabToIndex(tab.id, restored.position);
    }
    if (!this.primaryTabId) this.primaryTabId = tab.id;
    if (activate) this.activateTabInternal(tab.id);
    this.applyViewLayout();
    try {
      await this.requireTabView(tab).webContents.loadURL(target);
      assertCurrent();
      this.enforceLiveTabBudget();
    } catch (error) {
      this.recordError(error, tab.id);
      throw error;
    }
    this.emitState();
    return this.getState();
  }

  closeTab(rawTabId: unknown): IntegratedBrowserState {
    const tabId = this.requireTabId(rawTabId);
    const tab = this.tabs.get(tabId);
    if (!tab) throw new Error('La pestaña indicada no existe.');
    const wasVisible = tabId === this.primaryTabId || (this.viewMode !== 'single' && tabId === this.secondaryTabId);
    this.closedTabs.push({ ...this.toSessionTab(tab, Array.from(this.tabs.keys()).indexOf(tabId)), closedAt: new Date().toISOString() });
    if (this.closedTabs.length > 25) this.closedTabs.shift();
    const remainingIds = Array.from(this.tabs.keys()).filter((id) => id !== tabId);
    this.tabs.delete(tabId);
    this.destroyTab(tab);
    if (this.visible && !Array.from(this.tabs.values()).some((candidate) => !this.detachedWindows.has(candidate.id))) {
      const replacement = this.createTabRuntime();
      replacement.url = INTEGRATED_BROWSER_HOME;
      remainingIds.unshift(replacement.id);
      void this.requireTabView(replacement).webContents.loadURL(INTEGRATED_BROWSER_HOME).catch((error) => this.recordError(error, replacement.id));
    }
    if (remainingIds.length === 0) {
      const replacement = this.createTabRuntime();
      remainingIds.push(replacement.id);
      replacement.url = INTEGRATED_BROWSER_HOME;
      void this.requireTabView(replacement).webContents.loadURL(INTEGRATED_BROWSER_HOME).catch((error) => this.recordError(error, replacement.id));
    }
    const fallback = remainingIds.find((id) => !this.detachedWindows.has(id)) ?? remainingIds[0] ?? null;
    if (this.activeTabId === tabId) this.activeTabId = this.secondaryTabId && this.secondaryTabId !== tabId ? this.secondaryTabId : fallback;
    if (wasVisible) {
      this.viewMode = 'single';
      this.secondaryTabId = null;
      this.primaryTabId = this.activeTabId ?? fallback;
    }
    this.applyViewLayout();
    this.emitState();
    return this.getState();
  }

  async duplicateTab(rawTabId: unknown): Promise<IntegratedBrowserState> {
    this.assertCapability('advancedTabs');
    const sourceId = this.requireTabId(rawTabId);
    const source = this.tabs.get(sourceId)!;
    this.snapshotTab(source);
    const sourceZoom = source.zoomFactor;
    await this.createTab(source.url, true);
    const created = this.getActiveTab();
    if (created) {
      created.groupId = source.groupId;
      created.muted = source.muted;
      created.zoomFactor = sourceZoom;
      this.requireTabView(created).webContents.setAudioMuted(created.muted);
      this.configureTabZoom(created);
    }
    this.emitState();
    return this.getState();
  }

  listRecentlyClosedTabs(): BrowserRecentlyClosedTab[] {
    return this.closedTabs.slice().reverse().map(({ id, url, title, closedAt }) => ({ id, url, title, closedAt }));
  }

  async reopenClosedTab(id?: string): Promise<IntegratedBrowserState> {
    this.assertCapability('advancedTabs');
    const scopeId = this.scopeId;
    const closed = id === undefined ? this.closedTabs[this.closedTabs.length - 1] : this.closedTabs.find((tab) => tab.id === id);
    if (!closed) throw new Error('No hay pestañas cerradas para reabrir.');
    if (this.reopeningTabs.has(closed.id)) throw new Error('La pestaña ya se está reabriendo.');
    this.reopeningTabs.add(closed.id);
    try {
      await this.createTab(closed.url, true, closed);
      if (this.scopeId !== scopeId) throw new Error('El perfil cambió al reabrir la pestaña.');
      this.closedTabs = this.closedTabs.filter((tab) => tab.id !== closed.id);
    } finally { this.reopeningTabs.delete(closed.id); }
    this.emitState();
    return this.getState();
  }

  closeOtherTabs(rawTabId: unknown): IntegratedBrowserState {
    this.assertCapability('advancedTabs');
    const keepId = this.requireTabId(rawTabId);
    for (const id of Array.from(this.tabs.keys())) if (id !== keepId) this.closeTab(id);
    return this.activateTab(keepId);
  }

  closeTabsToRight(rawTabId: unknown): IntegratedBrowserState {
    this.assertCapability('advancedTabs');
    const keepId = this.requireTabId(rawTabId);
    const ids = Array.from(this.tabs.keys());
    const index = ids.indexOf(keepId);
    for (const id of ids.slice(index + 1)) this.closeTab(id);
    return this.getState();
  }

  setTabPinned(rawTabId: unknown, pinned: boolean): IntegratedBrowserState {
    this.assertCapability('advancedTabs');
    const tabId = this.requireTabId(rawTabId);
    this.tabs.get(tabId)!.pinned = pinned;
    this.tabs = new Map([...this.tabs.entries()].sort((left, right) => Number(right[1].pinned) - Number(left[1].pinned)));
    this.emitState();
    return this.getState();
  }

  setTabLayout(layout: 'horizontal' | 'vertical'): IntegratedBrowserState {
    this.assertCapability('advancedTabs');
    this.tabLayout = layout;
    this.emitState();
    return this.getState();
  }

  createTabGroup(rawName: unknown, color: BrowserTabGroupColor): BrowserTabGroup {
    this.assertCapability('advancedTabs');
    if (typeof rawName !== 'string' || !rawName.trim() || rawName.trim().length > 80) throw new Error('El nombre del grupo es inválido.');
    const group = { id: randomUUID(), name: rawName.trim(), color, collapsed: false } satisfies BrowserTabGroup;
    this.groups.set(group.id, group);
    this.emitState();
    return { ...group };
  }

  assignTabGroup(rawTabId: unknown, rawGroupId: unknown): IntegratedBrowserState {
    this.assertCapability('advancedTabs');
    const tabId = this.requireTabId(rawTabId);
    if (rawGroupId !== null && (typeof rawGroupId !== 'string' || !this.groups.has(rawGroupId))) throw new Error('El grupo indicado no existe.');
    this.tabs.get(tabId)!.groupId = rawGroupId as string | null;
    this.emitState();
    return this.getState();
  }

  activateTab(rawTabId: unknown): IntegratedBrowserState {
    const tabId = this.requireTabId(rawTabId);
    this.activateTabInternal(tabId);
    this.applyViewLayout();
    this.emitState();
    return this.getState();
  }

  detachTab(rawTabId: unknown): IntegratedBrowserState {
    this.assertCapability('advancedTabs');
    const tabId = this.requireTabId(rawTabId);
    return this.detachTabInternal(tabId);
  }

  private detachTabInternal(tabId: string): IntegratedBrowserState {
    const existing = this.detachedWindows.get(tabId);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return this.getState();
    }
    if (this.detachedWindows.size >= INTEGRATED_BROWSER_MAX_DETACHED_WINDOWS) {
      throw new Error(`El navegador admite hasta ${INTEGRATED_BROWSER_MAX_DETACHED_WINDOWS} ventanas separadas.`);
    }
    const parent = this.requireParentWindow();
    const tab = this.tabs.get(tabId)!;
    const view = this.requireTabView(tab);
    const workspaceTabs = Array.from(this.tabs.values()).filter((candidate) => candidate.id !== tabId && !this.detachedWindows.has(candidate.id));
    if (workspaceTabs.length === 0) {
      const replacement = this.createTabRuntime();
      replacement.url = INTEGRATED_BROWSER_HOME;
      workspaceTabs.push(replacement);
      void this.requireTabView(replacement).webContents.loadURL(INTEGRATED_BROWSER_HOME).catch((error) => this.recordError(error, replacement.id));
    }

    const detached = new BaseWindow({
      width: 1200,
      height: 800,
      minWidth: 480,
      minHeight: 320,
      show: false,
      backgroundColor: '#111820',
      title: detachedWindowTitle(tab),
    });
    try { parent.contentView.removeChildView(view); } catch { /* la vista puede estar oculta */ }
    detached.contentView.addChildView(view);
    this.detachedWindows.set(tabId, detached);
    this.layoutDetachedTab(tabId);

    detached.on('resize', () => this.layoutDetachedTab(tabId));
    detached.on('focus', () => {
      if (!this.tabs.has(tabId) || this.detachedWindows.get(tabId) !== detached) return;
      this.activeTabId = tabId;
      tab.lastActivatedAt = Date.now();
      this.invalidateObservation();
      this.emitState();
    });
    detached.on('close', (event) => {
      if (this.detachedWindows.get(tabId) !== detached) return;
      if (this.shutdownCommitted) return;
      event.preventDefault();
      this.reattachTab(tabId);
    });

    if (this.primaryTabId === tabId) this.primaryTabId = workspaceTabs[0]?.id ?? null;
    if (this.secondaryTabId === tabId) {
      this.secondaryTabId = null;
      this.viewMode = 'single';
    }
    this.overlayTopTabId = null;
    this.applyViewLayout();
    tab.appliedVisible = true;
    view.setVisible(true);
    detached.show();
    detached.focus();
    this.enforceLiveTabBudget();
    this.emitState();
    return this.getState();
  }

  reattachTab(rawTabId: unknown): IntegratedBrowserState {
    this.assertCapability('advancedTabs');
    const tabId = this.requireTabId(rawTabId);
    const detached = this.detachedWindows.get(tabId);
    if (!detached) return this.getState();
    const parent = this.requireParentWindow();
    const tab = this.tabs.get(tabId)!;
    const view = this.requireTabView(tab);
    this.detachedWindows.delete(tabId);
    try { detached.contentView.removeChildView(view); } catch { /* cierre idempotente */ }
    parent.contentView.addChildView(view);
    try { if (!detached.isDestroyed()) detached.destroy(); } catch { /* cierre idempotente */ }
    this.activeTabId = tabId;
    this.primaryTabId = tabId;
    this.secondaryTabId = null;
    this.viewMode = 'single';
    this.overlayTopTabId = null;
    tab.lastActivatedAt = Date.now();
    this.invalidateObservation();
    this.applyViewLayout();
    if (this.visible) view.webContents.focus();
    this.emitState();
    return this.getState();
  }

  reorderTabs(rawSourceId: unknown, rawTargetId: unknown): IntegratedBrowserState {
    const sourceId = this.requireTabId(rawSourceId);
    const targetId = this.requireTabId(rawTargetId);
    if (sourceId === targetId) return this.getState();

    const entries = Array.from(this.tabs.entries());
    const sourceIndex = entries.findIndex(([id]) => id === sourceId);
    const targetIndex = entries.findIndex(([id]) => id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return this.getState();

    const [movedEntry] = entries.splice(sourceIndex, 1);
    entries.splice(targetIndex, 0, movedEntry);

    this.tabs = new Map(entries);
    this.emitState();
    return this.getState();
  }

  async setViewMode(rawMode: unknown, rawSecondaryTabId?: unknown): Promise<IntegratedBrowserState> {
    this.assertCapability('advancedTabs');
    const mode = this.parseViewMode(rawMode);
    this.ensureView();
    if (this.activeTabId && this.detachedWindows.has(this.activeTabId)) {
      throw new Error('Integra la pestaña activa antes de usar la vista dividida.');
    }
    if (mode === 'single') {
      this.viewMode = 'single';
      this.secondaryTabId = null;
      this.primaryTabId = this.activeTabId;
    } else {
      let secondaryTabId = rawSecondaryTabId === undefined ? null : this.requireTabId(rawSecondaryTabId);
      if (secondaryTabId && this.detachedWindows.has(secondaryTabId)) throw new Error('La pestaña secundaria está en una ventana separada.');
      if (secondaryTabId === this.activeTabId) secondaryTabId = null;
      secondaryTabId ??= Array.from(this.tabs.keys()).find((id) => id !== this.activeTabId && !this.detachedWindows.has(id)) ?? null;
      if (!secondaryTabId) {
        await this.createTab(undefined, false);
        secondaryTabId = Array.from(this.tabs.keys()).find((id) => id !== this.activeTabId && !this.detachedWindows.has(id)) ?? null;
      }
      if (!secondaryTabId) throw new Error('No se pudo preparar la segunda pestaña.');
      this.primaryTabId = this.activeTabId;
      this.secondaryTabId = secondaryTabId;
      this.viewMode = mode === 'overlay' ? 'split' : mode;
      this.customOverlayBounds = null;
    }
    this.applyViewLayout();
    this.emitState();
    return this.getState();
  }

  public setOverlayBounds(bounds: Rectangle): IntegratedBrowserState {
    if (this.viewMode === 'overlay' && this.secondaryTabId) {
      this.customOverlayBounds = bounds;
      const secondary = this.tabs.get(this.secondaryTabId);
      if (secondary && secondary.view && this.viewport) {
        this.applyTabBounds(secondary, secondary.view, {
          x: this.viewport.x + bounds.x,
          y: this.viewport.y + bounds.y + 32,
          width: Math.max(160, bounds.width),
          height: Math.max(100, bounds.height - 32),
        });
      }
    }
    return this.getState();
  }

  public setOverlayPosition(pos: string): IntegratedBrowserState {
    if (this.viewMode === 'overlay' && this.secondaryTabId && this.viewport) {
      const margin = 12;
      let w = Math.min(Math.max(360, Math.round(this.viewport.width * 0.40)), this.viewport.width - margin * 2);
      let h = Math.max(200, this.viewport.height - margin * 2);

      if (pos === 'horizontal') {
        w = Math.min(Math.max(480, Math.round(this.viewport.width * 0.55)), this.viewport.width - margin * 2);
        h = Math.min(Math.max(300, Math.round(this.viewport.height * 0.50)), this.viewport.height - margin * 2);
      }

      let x = this.viewport.width - w - margin;
      let y = margin;

      if (pos === 'top-left' || pos === 'vertical-left') {
        x = margin;
        y = margin;
      } else if (pos === 'bottom-right') {
        x = this.viewport.width - w - margin;
        y = this.viewport.height - h - margin;
      } else if (pos === 'bottom-left') {
        x = margin;
        y = this.viewport.height - h - margin;
      } else if (pos === 'center' || pos === 'vertical-center') {
        x = Math.round((this.viewport.width - w) / 2);
        y = margin;
      }

      this.customOverlayBounds = { x, y, width: w, height: h };
      this.applyViewLayout();
      this.emitState();
    }
    return this.getState();
  }

  setViewport(rawViewport: unknown): IntegratedBrowserState {
    const parent = this.requireParentWindow();
    this.ensureWorkspaceView();
    const viewport = parseBrowserViewport(rawViewport, parent.getContentBounds());
    this.viewport = viewport;
    this.visible = true;
    this.applyViewLayout();
    const active = this.getActiveTab();
    if (active) this.deferPassiveCapture(active);
    this.resolveViewportWaiters();
    this.emitState();
    return this.getState();
  }

  hide(): IntegratedBrowserState {
    this.hideWorkspaceTabsExcept();
    this.visible = false;
    this.latestObservation = null;
    this.latestVisualCapture = null;
    this.emitState();
    return this.getState();
  }

  async prepareReadingMode(request: BrowserReadingPrepareInput): Promise<BrowserReadingContent> {
    return this.auditAgentOperation('document', () => this.prepareReadingModeInternal(request));
  }
  private async prepareReadingModeInternal(request: BrowserReadingPrepareInput): Promise<BrowserReadingContent> {
    const assertTarget = await this.authorizeAgentAccess('read-document');
    assertTarget();
    const active = this.getActiveTab();
    const contents = active?.view?.webContents;
    if (!active || !contents || contents.isDestroyed()) {
      throw new Error('La pestaña activa no está disponible para lectura.');
    }
    // Si el usuario tiene texto marcado, eso es lo que quiere escuchar. Solo se
    // recurre al documento completo cuando no hay seleccion viva.
    const solicitud = request.selection?.trim()
      ? request
      : { ...request, selection: await this.readSelectionText(contents) };
    assertTarget();
    if (solicitud.selection) selectionLog(`modo lectura sobre la seleccion (${solicitud.selection.length} chars)`);
    const prepared = await this.readingModeService.prepare({ contents, tabId: active.id, request: solicitud });
    await this.assertDocumentNotSensitive(active.id);
    assertTarget();
    return prepared;
  }

  /**
   * Extrae el documento completo de la pestaña activa sin crear la cápsula ni
   * una sesión de audio. La identidad se comprueba otra vez al terminar para
   * que una navegación concurrente nunca entregue texto de otra pestaña.
   */
  async readActiveDocument(): Promise<BrowserDocumentContent> {
    return this.auditAgentOperation('document', () => this.readActiveDocumentInternal());
  }
  private async readActiveDocumentInternal(): Promise<BrowserDocumentContent> {
    const assertTarget = await this.authorizeAgentAccess('read-document');
    assertTarget();
    const active = this.getActiveTab();
    const contents = active?.view?.webContents;
    if (!active || !contents || contents.isDestroyed() || !this.visible || !this.isTabVisible(active)) {
      throw new Error('La pestaña activa no está disponible para lectura documental.');
    }
    const tabId = active.id;
    const startedUrl = contents.getURL();
    const reading = await collectBrowserReadingContent({ contents, tabId, request: {} });
    await this.assertDocumentNotSensitive(tabId);
    const current = this.getActiveTab();
    if (!current || current.id !== tabId || current.view?.webContents !== contents
      || contents.isDestroyed() || contents.getURL() !== startedUrl || reading.url !== startedUrl) {
      throw new Error('El documento activo cambió durante la lectura. Vuelve a intentarlo.');
    }
    assertTarget();
    return {
      tabId,
      url: reading.url,
      title: reading.title,
      language: reading.language,
      text: reading.text,
      truncated: reading.truncated,
    };
  }

  synthesizeReadingSegment(input: { readingId: string; requestId: string; start: number; end: number }): Promise<BrowserReadingSpeechResult> {
    return this.readingModeService.synthesize(input);
  }

  highlightReadingRange(input: { readingId: string; start?: number; end?: number }): Promise<{ highlighted: boolean }> {
    return this.readingModeService.highlight(input);
  }

  waitForReadingToolbarAction(input: { readingId: string }): Promise<BrowserReadingToolbarAction> {
    return this.readingModeService.waitForToolbarAction(input);
  }

  syncReadingToolbar(input: BrowserReadingToolbarState): Promise<{ toolbarVisible: boolean }> {
    return this.readingModeService.syncToolbar(input);
  }

  cancelReadingSpeech(input: { readingId: string; requestId?: string }): { canceled: number } {
    return this.readingModeService.cancel(input);
  }

  closeReadingMode(input: { readingId: string }): Promise<{ closed: boolean }> {
    return this.readingModeService.close(input);
  }

  /**
   * Abre o cierra las herramientas de desarrollo de la pestaña activa. Es la
   * unica via para observar directamente las peticiones y los errores de una
   * pagina cuando algo falla dentro de la vista integrada, en vez de inferirlo.
   */
  toggleDevTools(): IntegratedBrowserState {
    const contents = this.getWebContentsForAgent();
    if (contents.isDevToolsOpened()) contents.closeDevTools();
    else contents.openDevTools({ mode: 'detach' });
    return this.getState();
  }

  focus(): IntegratedBrowserState {
    const active = this.getActiveTab();
    const detached = active ? this.detachedWindows.get(active.id) : null;
    if (detached && this.isWindowUsable(detached)) detached.focus();
    else if (this.visible) this.getWebContents()?.focus();
    return this.getState();
  }

  goBack(): IntegratedBrowserState {
    const history = this.ensureView().webContents.navigationHistory;
    if (history.canGoBack()) history.goBack();
    return this.getState();
  }

  goForward(): IntegratedBrowserState {
    const history = this.ensureView().webContents.navigationHistory;
    if (history.canGoForward()) history.goForward();
    return this.getState();
  }

  reload(): IntegratedBrowserState {
    this.ensureView().webContents.reload();
    return this.getState();
  }

  stop(): IntegratedBrowserState {
    this.getWebContents()?.stop();
    const active = this.getActiveTab();
    if (active) active.loading = false;
    this.emitState();
    return this.getState();
  }

  async openForAgent(rawUrl?: unknown, timeoutMs = INTEGRATED_BROWSER_AGENT_VIEWPORT_TIMEOUT_MS, signal?: AbortSignal): Promise<void> {
    assertCuNotAborted(signal);
    const assertProfile = this.captureProfileGuard();
    await this.ensureEnterprisePolicy();
    assertCuNotAborted(signal);
    assertProfile();
    if (this.enterprisePolicy?.agentAllowed === false) throw new Error('SofLIA está bloqueada por tu organización en el navegador.');
    if (this.agentControlling) {
      throw new Error('El navegador integrado ya esta siendo controlado por otra tarea.');
    }
    const parent = this.requireParentWindow();
    const contents = this.ensureView().webContents;
    const active = this.getActiveTab();
    const detached = active ? this.detachedWindows.get(active.id) : null;
    if (this.agentTaskBinding && detached) throw new Error('Acopla la pestaña a la ventana principal antes de iniciar una tarea supervisada.');
    if (this.agentTaskBinding && this.fullscreenTabId) this.leaveHtmlFullScreen(this.fullscreenTabId);
    const host = detached ?? parent;
    if (host.isMinimized()) host.restore();
    if (!host.isVisible()) host.show();
    host.focus();
    this.setAgentControlling(true);
    const controlRevision = this.agentControlRevision;
    const viewportAbort = new AbortController();
    const abortViewport = () => viewportAbort.abort();
    signal?.addEventListener('abort', abortViewport, { once: true });
    const assertOpening = () => {
      assertCuNotAborted(signal);
      assertProfile();
      if (this.agentControlRevision !== controlRevision || this.getActiveTab() !== active) throw new CuContextChangedError();
    };
    try {
      assertOpening();
      parent.webContents.send('integrated-browser:open-requested', { url: typeof rawUrl === 'string' ? rawUrl : this.getState().url });
      const viewportReady = detached || (this.visible && this.viewport) ? Promise.resolve() : this.waitForViewport(timeoutMs, viewportAbort.signal);
      const navigationReady = (rawUrl !== undefined
        ? this.loadTarget(rawUrl, assertOpening)
        : (!contents.getURL() || contents.getURL() === 'about:blank')
          ? this.loadTarget(INTEGRATED_BROWSER_HOME, assertOpening)
          : Promise.resolve()).catch(error => { abortViewport(); throw error; });
      // No liberar control mientras una navegación nativa ya emitida sigue pendiente.
      const results = await Promise.allSettled([navigationReady, viewportReady]);
      assertOpening();
      for (const result of results) if (result.status === 'rejected') throw result.reason;
      contents.focus();
    } catch (error) {
      if (this.agentControlRevision === controlRevision) this.setAgentControlling(false);
      throw error;
    } finally {
      signal?.removeEventListener('abort', abortViewport);
      abortViewport();
    }
  }

  releaseAgentControl(): void {
    if (!this.agentControlling) return;
    this.setAgentControlling(false);
  }

  private setAgentControlling(value: boolean): void {
    if (value) this.passkeySelection?.cancel();
    if (this.agentControlling !== value) this.agentControlRevision += 1;
    this.agentControlling = value;
    this.setSelectionMenuEnabled(!value);
    if (!value) {
      const active = this.getActiveTab();
      if (active) this.deferPassiveCapture(active);
    }
    this.emitState();
  }

  getViewportSize(): { width: number; height: number } {
    const active = this.getActiveTab();
    if (!active) throw new Error('El navegador integrado no tiene una pestaña activa.');
    if (!this.isTabVisible(active)) throw new Error('El navegador integrado no tiene un viewport visible.');
    const bounds = this.requireTabView(active).getBounds();
    return { width: bounds.width, height: bounds.height };
  }

  getWebContentsForAgent(): WebContents {
    const contents = this.getWebContents();
    if (!contents || contents.isDestroyed()) throw new Error('El navegador integrado no esta disponible.');
    return contents;
  }

  /** Única entrada del driver de acciones; enlaza la decisión a la página actual. */
  async authorizeAgentTarget(capability: BrowserAgentCapability, signal?: AbortSignal): Promise<{ contents: WebContents; assertCurrent: () => void }> {
    const assertTarget = await this.authorizeAgentAccess(capability, undefined, signal);
    assertTarget();
    return { contents: this.getWebContentsForAgent(), assertCurrent: assertTarget };
  }
  /** Comprobación posterior para capturas nativas del driver; no concede permisos. */
  async assertAgentDocumentSafe(signal?: AbortSignal): Promise<void> {
    const guard = this.createAgentTargetGuard(signal, true);
    await this.assertDocumentNotSensitive(); guard();
  }

  /** Sólo comprueba identidad; no concede permisos ni expone una capacidad por IPC. */
  createAgentTargetGuard(signal?: AbortSignal, document = false): () => void {
    return this.createAgentAccessGuard(undefined, signal, document);
  }

  /**
   * Respaldo visual que el renderer muestra mientras la vista nativa esta
   * oculta. Se codifica en JPEG y a la escala logica del viewport: el PNG a
   * resolucion de dispositivo tardaba cientos de milisegundos en codificarse y
   * viajaba por IPC como varios megabytes en cada apertura de la barra.
   */
  async captureVisiblePage(): Promise<string> {
    return this.auditAgentOperation('capture', () => this.captureVisiblePageInternal());
  }
  private async captureVisiblePageInternal(): Promise<string> {
    const assertTarget = await this.authorizeAgentAccess('capture');
    assertTarget();
    const capture = await this.captureVisibleBackdrop();
    await this.assertDocumentNotSensitive();
    assertTarget();
    return capture.screenshot;
  }

  /**
   * Captura y el rectangulo exacto que ocupaba la vista al tomarla. El
   * renderer usa el respaldo mientras oculta la vista nativa para desplegar un
   * panel encima; sin el rectangulo lo estiraba al contenedor disponible y la
   * pagina aparecia ampliada durante ese instante.
   */
  async captureVisibleBackdrop(): Promise<{ screenshot: string; bounds: Rectangle }> {
    // Respaldo local de UI: no es percepción del agente ni genera permisos.
    const active = this.getActiveTab();
    if (!active || !this.isTabVisible(active)) throw new Error('El navegador integrado no esta visible.');
    const contents = this.getWebContentsForAgent();
    const image = await contents.capturePage();
    if (image.isEmpty()) throw new Error('La captura del navegador integrado esta vacia.');
    const bounds = this.requireTabView(active).getBounds();
    const logicalEdge = Math.max(1, bounds.width, bounds.height);
    return {
      screenshot: encodeBrowserCapture(image, logicalEdge, INTEGRATED_BROWSER_BACKDROP_QUALITY),
      bounds,
    };
  }

  /**
   * Devuelve un resumen instantáneo de cada pestaña abierta (id, url, título, isCurrent).
   * No recorre el DOM de forma síncrona para no ralentizar la apertura del menú flotante.
   */
  getTabSummaries(): Array<{
    documentToken: string;
    tabId: string;
    url: string;
    title: string;
    isCurrent: boolean;
    text: string;
  }> {
    const summaries: Array<{
      documentToken: string;
      tabId: string;
      url: string;
      title: string;
      isCurrent: boolean;
      text: string;
    }> = [];

    for (const tab of this.tabs.values()) {
      const isCurrent = tab.id === this.activeTabId;
      summaries.push({
        documentToken: tab.documentToken,
        tabId: tab.id,
        url: sanitizeStateUrl(tab.view?.webContents.getURL() ?? tab.url ?? 'about:blank'),
        title: tab.title || 'Nueva pestaña',
        isCurrent,
        text: '',
      });
    }
    return summaries;
  }

  /**
   * Obtiene el contenido DOM completo de una pestaña específica bajo demanda cuando es seleccionada.
   */
  async getTabContent(tabId: string, expected?: import('../../src/shared/browser-tab-context').BrowserTabExpectation): Promise<{
    tabId: string;
    url: string;
    title: string;
    text: string;
  }> {
    return this.auditAgentOperation('dom', () => this.getTabContentInternal(tabId, expected), undefined, tabId);
  }
  private async getTabContentInternal(tabId: string, expected?: import('../../src/shared/browser-tab-context').BrowserTabExpectation): Promise<{ tabId: string; url: string; title: string; text: string }> {
    const tab = this.tabs.get(tabId);
    const assertSelection = () => {
      if (expected && (!tab || this.scopeChanging || expected.profileRevision !== this.scopeTransition
        || expected.documentToken !== tab.documentToken || this.tabs.get(tabId) !== tab)) {
        throw new Error('La página o el perfil cambió. Selecciona de nuevo la pestaña.');
      }
    };
    assertSelection();
    if (!tab) {
      return { tabId, url: '', title: '', text: '' };
    }
    const assertTarget = await this.authorizeAgentAccess('observe-dom', tabId);
    assertSelection();
    let text = '';
    let title = tab.title || 'Nueva pestaña';
    if (tab.view && !tab.view.webContents.isDestroyed()) {
      try {
        const dom = await collectIntegratedBrowserDom(tab.view.webContents);
        await this.assertDocumentNotSensitive(tabId);
        assertTarget();
        text = expected ? dom.text.slice(0, BROWSER_SOURCE_LIMITS.fragmentsPerTab * BROWSER_SOURCE_LIMITS.fragmentChars) : dom.text;
        title = dom.title || title;
      } catch {
        // Fallback si la pestaña está inaccesible o cargando
      }
    }
    assertTarget();
    assertSelection();
    return {
      tabId: tab.id,
      url: sanitizeStateUrl(tab.view?.webContents.getURL() ?? tab.url ?? 'about:blank'),
      title,
      text,
    };
  }

  getObservationStatus(): BrowserObservationStatus {
    const active = this.getActiveTab();
    return {
      enabled: this.observationEnabled,
      capturing: this.observationInFlight !== null || this.visualCaptureInFlight !== null,
      intervalMs: passiveObservationIntervalMs(active?.view?.webContents.getURL() ?? active?.url ?? ''),
      lastCapturedAt: this.latestVisualCapture?.capturedAt ?? this.latestObservation?.capturedAt ?? null,
      lastError: this.observationLastError,
    };
  }

  async getObservation(forceFresh = false, signal?: AbortSignal): Promise<{ observation: BrowserObservationSnapshot | null; observationStatus: BrowserObservationStatus }> {
    return this.auditAgentOperation('dom', () => this.getObservationInternal(forceFresh, signal));
  }
  private async getObservationInternal(forceFresh = false, signal?: AbortSignal): Promise<{ observation: BrowserObservationSnapshot | null; observationStatus: BrowserObservationStatus }> {
    assertCuNotAborted(signal);
    if (!this.observationEnabled) return { observation: null, observationStatus: this.getObservationStatus() };
    const assertTarget = await this.authorizeAgentAccess('observe-dom', undefined, signal);
    const active = this.getActiveTab();
    const currentUrl = active?.view?.webContents.getURL() ?? active?.url ?? '';
    const latest = this.latestObservation;
    const latestMatches = latest !== null && latest.tabId === active?.id && latest.dom.url === sanitizeStateUrl(currentUrl);
    const observation = forceFresh ? await this.refreshObservation(true, assertTarget) : latestMatches ? latest : null;
    assertTarget();
    return { observation, observationStatus: this.getObservationStatus() };
  }

  async setObservationEnabled(enabled: boolean): Promise<{ observation: BrowserObservationSnapshot | null; observationStatus: BrowserObservationStatus }> {
    this.observationEnabled = enabled;
    this.observationLastError = null;
    if (!enabled) {
      this.stopObservationTimer();
      this.latestObservation = null;
      this.latestVisualCapture = null;
      return { observation: null, observationStatus: this.getObservationStatus() };
    }
    this.startObservationTimer();
    await this.refreshVisualCapture(true);
    return { observation: null, observationStatus: this.getObservationStatus() };
  }

  /**
   * Controlador determinista: hace clic sobre un control del ultimo snapshot
   * usando entrada real del navegador, sin pasar por el actuador visual. La
   * referencia se resuelve contra el elemento vivo, no contra coordenadas
   * guardadas, para que el scroll o un re-render no desvien el clic.
   */
  async clickElement(rawRef: unknown): Promise<BrowserInteractionOutcome> {
    return this.auditAgentOperation('click', () => this.clickElementInternal(rawRef));
  }
  private async clickElementInternal(rawRef: unknown): Promise<BrowserInteractionOutcome> {
    const assertTarget = await this.authorizeAgentAccess('act');
    const { contents, target } = await this.requireInteractiveTarget(rawRef);
    assertTarget();
    if (target.disabled) throw new Error(`El control "${target.name || target.tag}" esta deshabilitado.`);
    const point = browserDomPoint(contents, target, this.getActiveTab()?.zoomFactor ?? 1);
    sendBrowserClick(contents, point.x, point.y);
    this.noteInteraction();
    return { target, warning: target.occluded ? 'Otro elemento cubria el punto de impacto; verifica el resultado antes de continuar.' : null };
  }

  /**
   * Escribe en un campo del ultimo snapshot. Enfoca con un clic real para que
   * los editores controlados del sitio reciban los mismos eventos que con un
   * usuario, limpia el valor previo y opcionalmente envia el formulario.
   */
  async typeInElement(rawRef: unknown, rawText: unknown, rawSubmit: unknown): Promise<BrowserInteractionOutcome> {
    return this.auditAgentOperation('type', () => this.typeInElementInternal(rawRef, rawText, rawSubmit));
  }
  private async typeInElementInternal(rawRef: unknown, rawText: unknown, rawSubmit: unknown): Promise<BrowserInteractionOutcome> {
    const assertTarget = await this.authorizeAgentAccess('act');
    if (typeof rawText !== 'string') throw new Error('El texto a escribir debe ser una cadena.');
    if (rawText.length > 5_000) throw new Error('El texto a escribir excede el limite de 5000 caracteres.');
    const { contents, target } = await this.requireInteractiveTarget(rawRef);
    assertTarget();
    if (!target.editable) throw new Error(`El elemento "${target.name || target.tag}" no es un campo editable.`);
    if (target.disabled) throw new Error(`El campo "${target.name || target.tag}" esta deshabilitado.`);
    const point = browserDomPoint(contents, target, this.getActiveTab()?.zoomFactor ?? 1);
    sendBrowserClick(contents, point.x, point.y);
    const selectionModifier = process.platform === 'darwin' ? 'meta' : 'control';
    contents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: [selectionModifier] });
    contents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: [selectionModifier] });
    await contents.insertText(rawText);
    assertTarget();
    if (rawSubmit === true) {
      contents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      contents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
    }
    this.noteInteraction();
    return { target, warning: null };
  }

  /** Desplaza la pestaña activa con la rueda real del navegador. */
  async scrollView(rawDirection: unknown, rawAmount: unknown): Promise<void> {
    return this.auditAgentOperation('scroll', () => this.scrollViewInternal(rawDirection, rawAmount));
  }
  private async scrollViewInternal(rawDirection: unknown, rawAmount: unknown): Promise<void> {
    const assertTarget = await this.authorizeAgentAccess('act');
    assertTarget();
    const direction = rawDirection === undefined ? 'down' : rawDirection;
    if (direction !== 'up' && direction !== 'down' && direction !== 'left' && direction !== 'right') {
      throw new Error('La direccion de desplazamiento debe ser up, down, left o right.');
    }
    const amount = rawAmount === undefined ? 3 : rawAmount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1 || amount > 20) {
      throw new Error('La magnitud de desplazamiento debe estar entre 1 y 20.');
    }
    const contents = this.requireVisibleContents();
    const size = this.getViewportSize();
    const delta = Math.round(amount) * 100;
    contents.sendInputEvent({
      type: 'mouseWheel',
      x: Math.round(size.width / 2),
      y: Math.round(size.height / 2),
      deltaX: direction === 'right' ? -delta : direction === 'left' ? delta : 0,
      deltaY: direction === 'down' ? -delta : direction === 'up' ? delta : 0,
      canScroll: true,
    });
    this.noteInteraction();
  }

  private async requireInteractiveTarget(rawRef: unknown): Promise<{ contents: WebContents; target: BrowserElementTarget }> {
    if (typeof rawRef !== 'string' || !rawRef.trim() || rawRef.length > 60) {
      throw new Error('La referencia del elemento es invalida.');
    }
    const contents = this.requireVisibleContents();
    const resolution = await resolveBrowserElement(contents, rawRef.trim());
    if (!resolution.ok) throw new Error(describeResolutionFailure(resolution.reason));
    return { contents, target: resolution.target };
  }

  private requireVisibleContents(): WebContents {
    const active = this.getActiveTab();
    if (!active || !this.isTabVisible(active)) {
      throw new Error('El navegador integrado no tiene una pestaña visible para interactuar.');
    }
    if (this.agentControlling) {
      throw new Error('El navegador integrado esta siendo controlado por otra tarea.');
    }
    return this.getWebContentsForAgent();
  }

  /** La interaccion invalida la percepcion previa y abre una ventana de calma. */
  private noteInteraction(): void {
    const active = this.getActiveTab();
    if (!active) return;
    this.invalidateObservation(active.id);
    active.lastDeferAt = 0;
    this.deferPassiveCapture(active);
  }

  async listHistory(input?: { query?: unknown; limit?: unknown; offset?: unknown; from?: unknown; to?: unknown; domain?: unknown }): Promise<BrowserHistoryEntry[]> {
    const assertCurrent = this.captureProfileGuard();
    await this.ensureEnterprisePolicy(); assertCurrent();
    const entries = await this.historyStore.list(input); assertCurrent();
    return entries;
  }

  async importHistory() {
    this.assertCapability('advancedHistory');
    const assertCurrent = this.captureProfileGuard();
    await this.ensureEnterprisePolicy();
    assertCurrent();
    return this.historyImporter.importFromDialog();
  }

  async clearHistory(): Promise<boolean> {
    const assertCurrent = this.captureProfileGuard();
    const scopeId = this.scopeId;
    await this.historyStore.clear();
    assertCurrent();
    if (this.scopeId === scopeId) { this.closedTabs = []; this.emitState(); }
    return true;
  }

  async getHistoryRetention(): Promise<BrowserHistoryRetention> {
    const assertCurrent = this.captureProfileGuard();
    const scopeId = this.scopeId;
    await this.ensureEnterprisePolicy();
    assertCurrent();
    if (this.scopeId !== scopeId) throw new Error('El perfil cambió al consultar la retención.');
    const days = await this.historyStore.getRetention();
    assertCurrent();
    if (this.scopeId !== scopeId) throw new Error('El perfil cambió al consultar la retención.');
    return { days, managed: this.enterprisePolicy?.historyRetentionDays != null };
  }

  async setHistoryRetention(days: number | null): Promise<BrowserHistoryRetention & { removed: number }> {
    const assertCurrent = this.captureProfileGuard();
    const scopeId = this.scopeId;
    await this.ensureEnterprisePolicy();
    assertCurrent();
    if (this.scopeId !== scopeId) throw new Error('El perfil cambió al configurar la retención.');
    if (this.enterprisePolicy?.historyRetentionDays != null) throw new Error('La retención está administrada por tu organización.');
    const result = await this.historyStore.setRetention(days);
    assertCurrent();
    if (this.scopeId !== scopeId) throw new Error('El perfil cambió al configurar la retención.');
    if (days !== null) this.closedTabs = this.closedTabs.filter((tab) => Date.parse(tab.closedAt) >= Date.now() - days * 86_400_000);
    this.emitState();
    return { ...result, managed: false };
  }

  /**
   * Borra datos de navegacion del perfil ACTIVO, nunca de otro perfil: la
   * particion se resuelve con `browserPartitionFor()` sin argumento.
   *
   * No cierra ni recarga las pestañas abiertas, igual que Chrome. Una pagina ya
   * cargada sigue en pantalla; su sesion desaparece en la siguiente peticion.
   */
  async clearBrowsingData(rawInput: unknown): Promise<BrowsingDataSummary> {
    const assertCurrent = this.captureProfileGuard();
    assertCurrent();
    const request = validateBrowsingDataRequest(rawInput);
    const credentialGuard = request.categories.includes('contrasenas') ? this.credentialUnlock.capture() : () => undefined;
    const scopeId = this.scopeId;
    const profileSession = electronSession.fromPartition(browserPartitionFor());

    const summary = await clearBrowsingData(request, {
      clearHistorySince: async (since) => {
        assertCurrent();
        if (this.scopeId !== scopeId) throw new Error('El perfil cambió durante el borrado.');
        const removed = await this.historyStore.clearSince(since);
        if (this.scopeId === scopeId) {
          this.closedTabs = since === null ? [] : this.closedTabs.filter((tab) => Date.parse(tab.closedAt) < Date.parse(since));
          this.emitState();
        }
        return removed;
      },
      clearSiteData: () => { assertCurrent(); return profileSession.clearData({ dataTypes: [...SITE_DATA_TYPES] }); },
      clearCache: async () => {
        assertCurrent();
        await profileSession.clearCache();
        // La cache de autenticacion HTTP es la que mantiene viva una sesion
        // Basic/NTLM aunque las cookies ya no esten.
        assertCurrent();
        await profileSession.clearAuthCache();
      },
      clearPasswords: () => {
        credentialGuard();
        assertCurrent();
        if (this.scopeId !== scopeId) throw new Error('El perfil cambió durante el borrado.');
        return this.credentialVault.clearAll(() => { assertCurrent(); credentialGuard(); });
      },
      clearSitePermissions: () => {
        assertCurrent();
        if (this.scopeId !== scopeId) throw new Error('El perfil cambió durante el borrado.');
        return this.sitePermissionStore.clearAll();
      },
    });
    assertCurrent();
    return summary;
  }

  lockCredentials(): void { this.credentialUnlock.lock(); }

  async credentialSessionCommand(raw: unknown, assertCaller: () => void = () => undefined) {
    const request = validateCredentialSessionRequest(raw);
    const guard = this.captureProfileGuard();
    const parent = this.requireParentWindow();
    const assertCurrent = () => {
      assertCaller(); guard();
      if (request.profileRevision !== this.scopeTransition || this.agentControlling || !parent.isVisible()) throw new BrowserCredentialError('El perfil o la ventana no está disponible para desbloquear.');
    };
    assertCurrent();
    if (request.action === 'lock') this.lockCredentials();
    if (request.action === 'unlock') {
      const unlocked = await this.credentialUnlock.unlock(parent, assertCurrent);
      assertCurrent();
      if (!unlocked) return { success: false, unlocked: false, error: 'Windows no verificó tu identidad. Configura Windows Hello/PIN y vuelve a intentarlo; cancelar conserva el bloqueo.' };
      await this.loadCredentialAutosave(); assertCurrent();
    }
    return { success: true, unlocked: this.credentialUnlock.isUnlocked() };
  }

  private credentialContext() {
    const assertUnlocked = this.credentialUnlock.capture();
    const guard = this.createAgentAccessGuard();
    const parent = this.requireParentWindow();
    const origin = normalizeCredentialOrigin(this.getWebContentsForAgent().getURL());
    const assertCurrent = () => {
      assertUnlocked();
      try { guard(); } catch { throw new BrowserCredentialError('La página o el perfil cambió. Abre de nuevo el gestor de contraseñas.'); }
      if (this.agentControlling) throw new BrowserCredentialError('Toma el control del navegador antes de gestionar contraseñas.');
      if (this.scopeChanging || this.shutdownCommitted) throw new BrowserCredentialError('El perfil no está disponible.');
    };
    assertCurrent();
    return { origin, parent, assertCurrent };
  }

  async listCredentials() {
    const context = this.credentialContext();
    const credentials = await this.credentialVault.list(context.origin);
    context.assertCurrent();
    return { credentials, credentialOrigin: context.origin, credentialAutosaveEnabled: this.credentialAutosaveEnabled };
  }

  async setCredentialAutosave(enabled: boolean) {
    const context = this.credentialContext();
    if (this.credentialAutosaveSetting) throw new BrowserCredentialError('La preferencia de guardado está cambiando.');
    this.credentialAutosaveSetting = true;
    ++this.credentialAutosaveRevision;
    try {
      const existing = await this.credentialVault.getAutosaveEnabled();
      context.assertCurrent();
      this.credentialAutosaveEnabled = existing;
      await this.syncCredentialObservers();
      context.assertCurrent();
      if (enabled) {
        const result = await dialog.showMessageBox(context.parent, {
          type: 'question', title: 'Activar sugerencias de guardado',
          message: '¿Sugerir guardar las cuentas que envíes desde formularios?',
          detail: 'Se leerán usuario y contraseña sólo al enviar un formulario compatible. Cada guardado requiere tu confirmación. No se envían al agente ni se sincronizan.',
          buttons: ['Cancelar', 'Activar'], defaultId: 0, cancelId: 0, noLink: true,
        });
        if (result.response !== 1) return { canceled: true, credentialAutosaveEnabled: this.credentialAutosaveEnabled };
      }
      context.assertCurrent();
      await this.credentialVault.setAutosaveEnabled(enabled, context.assertCurrent);
      context.assertCurrent();
      this.credentialAutosaveEnabled = enabled;
      await this.syncCredentialObservers();
      context.assertCurrent();
      return { canceled: false, credentialAutosaveEnabled: enabled };
    } finally { this.credentialAutosaveSetting = false; }
  }

  private async loadCredentialAutosave(): Promise<void> {
    if (!this.credentialUnlock.isUnlocked()) return;
    const assertUnlocked = this.credentialUnlock.capture();
    const revision = ++this.credentialAutosaveRevision;
    const scope = this.scopeId;
    const generation = this.sessionGeneration;
    try {
      const enabled = await this.credentialVault.getAutosaveEnabled();
      assertUnlocked();
      if (revision !== this.credentialAutosaveRevision || scope !== this.scopeId || generation !== this.sessionGeneration
        || this.scopeChanging || this.shutdownCommitted || !this.parentWindow) return;
      this.credentialAutosaveEnabled = enabled;
      await this.syncCredentialObservers();
    } catch { /* Si la bóveda no está disponible, el guardado manual mostrará el error. */ }
  }

  private async syncCredentialObservers(): Promise<void> {
    await Promise.all([...this.tabs.values()].map(async (tab) => {
      if (!this.credentialAutosaveEnabled) {
        const observer = tab.credentialObserver;
        await observer?.dispose();
        if (tab.credentialObserver === observer) tab.credentialObserver = null;
      } else this.installCredentialObserver(tab);
    }));
  }

  private installCredentialObserver(tab: BrowserTabRuntime): void {
    const contents = tab.view?.webContents;
    if (!this.credentialUnlock.isUnlocked() || !this.credentialAutosaveEnabled || !contents || contents.isDestroyed() || tab.credentialObserver) return;
    const observer = new BrowserCredentialAutosave(contents, (candidate) => {
      if (tab.credentialObserver === observer) void this.offerCredential(tab, candidate);
    });
    tab.credentialObserver = observer;
    const pending = setImmediate(() => {
      if (tab.credentialObserver === observer && this.credentialAutosaveEnabled) void observer.install();
    });
    pending.unref?.();
  }

  private async offerCredential(tab: BrowserTabRuntime, candidate: BrowserCredentialTransferEntry): Promise<void> {
    let stopWatching: (() => void) | undefined;
    try {
      const assertUnlocked = this.credentialUnlock.capture();
      const contents = tab.view?.webContents;
      if (!this.credentialAutosaveEnabled || this.credentialAutosaveSetting || this.agentControlling || this.activeTabId !== tab.id
        || !this.isTabVisible(tab) || !contents?.isFocused()) return;
      // El puente privado ya verificó marco/origen; comprobar de nuevo antes de cifrar.
      if (candidate.origin !== normalizeCredentialOrigin(contents.getURL())) return;
      const guard = this.createAgentAccessGuard(undefined, undefined, false);
      const revision = this.credentialAutosaveRevision;
      const expiresAt = Date.now() + 60_000;
      let reviewGuard: (() => void) | null = null;
      let changedDuringReview = false;
      const beginReview = () => {
        reviewGuard = this.createAgentAccessGuard();
        const onNavigation = (_event: unknown, _url: string, _inPlace: boolean, isMainFrame: boolean) => {
          if (isMainFrame) changedDuringReview = true;
        };
        contents.on('did-start-navigation', onNavigation);
        stopWatching = () => contents.removeListener('did-start-navigation', onNavigation);
      };
      const assertCurrent = () => {
        assertUnlocked();
        guard();
        reviewGuard?.();
        if (!this.credentialAutosaveEnabled || this.credentialAutosaveSetting || revision !== this.credentialAutosaveRevision || this.agentControlling
          || !this.isTabVisible(tab) || changedDuringReview || Date.now() >= expiresAt) {
          throw new BrowserCredentialError('La sugerencia ya no pertenece al sitio activo.');
        }
      };
      assertCurrent();
      await this.credentialSaver.save(candidate, { origin: candidate.origin, parent: this.requireParentWindow(), assertCurrent, beginReview }, true);
    } catch { /* Cancelación, navegación o bóveda no disponible: nunca registrar el formulario. */ }
    finally { stopWatching?.(); }
  }

  async analyzeCredentialHealth() {
    const context = this.credentialContext();
    const health = await this.credentialVault.analyzeHealth();
    context.assertCurrent();
    return health;
  }

  importCredentials() {
    const context = this.credentialContext();
    return this.credentialTransfer.importFromDialog(context);
  }

  exportCredentials() {
    const context = this.credentialContext();
    return this.credentialTransfer.exportToDialog(context);
  }

  async recoverCredentials(): Promise<{ cancelled: boolean; restored: number }> {
    const assertUnlocked = this.credentialUnlock.capture();
    if (this.credentialRecoveryPending) throw new BrowserCredentialError('Ya hay una recuperación de contraseñas en revisión.');
    const profileGuard = this.captureProfileGuard();
    const controlRevision = this.agentControlRevision;
    const assertCurrent = () => {
      assertUnlocked();
      try { profileGuard(); } catch { throw new BrowserCredentialError('El perfil o la ventana cambió durante la recuperación.'); }
      if (this.agentControlling || this.agentControlRevision !== controlRevision) throw new BrowserCredentialError('Toma el control y revisa de nuevo la recuperación de contraseñas.');
    };
    assertCurrent();
    const parent = this.requireParentWindow();
    this.credentialRecoveryPending = true;
    try {
      const prepared = await this.credentialVault.prepareRecovery(); assertCurrent();
      const decision = await dialog.showMessageBox(parent, {
        type: 'warning', title: 'Restaurar bóveda desde respaldo', message: `¿Recuperar ${prepared.count} credenciales del respaldo local cifrado?`,
        detail: 'Sólo se recupera si el principal falta o está dañado; una bóveda válida o de versión futura no se reemplaza. El respaldo puede contener contraseñas anteriores; verifica cada cuenta. Se conservarán el respaldo y una copia cifrada del principal dañado. El guardado sugerido quedará desactivado. No se mostrarán ni enviarán contraseñas.',
        buttons: ['Cancelar', 'Restaurar bóveda'], defaultId: 0, cancelId: 0, noLink: true,
      });
      assertCurrent();
      if (decision.response !== 1) return { cancelled: true, restored: 0 };
      const restored = await prepared.commit(assertCurrent); assertCurrent();
      this.credentialAutosaveEnabled = false; this.credentialAutosaveRevision++;
      await this.syncCredentialObservers(); assertCurrent();
      return { cancelled: false, restored };
    } catch (error) {
      if (error instanceof BrowserCredentialError) throw error;
      throw new BrowserCredentialError('No se pudo completar la recuperación de contraseñas. El respaldo se conservó.');
    } finally { this.credentialRecoveryPending = false; }
  }

  saveCredential(input: BrowserCredentialSaveInput & { expectedOrigin: string }) {
    const context = this.credentialContext();
    if (input.expectedOrigin !== context.origin) throw new BrowserCredentialError('El sitio cambió. Abre de nuevo el gestor de contraseñas.');
    return this.credentialSaver.save(input, context);
  }

  async fillCredential(id: string): Promise<BrowserCredentialMetadata> {
    const target = this.getActiveTab();
    if (target && this.capabilities.agentGovernance) this.markSensitiveDocument(target, 'autofill');
    const context = this.credentialContext();
    const contents = this.getWebContentsForAgent();
    const tab = this.getActiveTab();
    const url = contents.getURL();
    const scopeId = this.scopeId;
    const revision = tab?.visualRevision;
    const assertTarget = () => {
      context.assertCurrent();
      if (!this.visible || this.scopeId !== scopeId || !tab || this.getActiveTab() !== tab || tab.view?.webContents !== contents
        || contents.isDestroyed() || contents.getURL() !== url || tab.visualRevision !== revision) throw new Error('La página o el perfil cambió. Selecciona de nuevo la credencial.');
    };
    if (!this.visible) throw new Error('El navegador debe estar visible para rellenar una credencial.');
    const resolved = await this.credentialVault.resolveSecret(id, url);
    assertTarget();
    // En el mundo aislado: localizar el campo de contrasena es una herramienta
    // del agente y la pagina no tiene por que ver la sonda que la busca.
    const fields = await runInAgentWorldOn(contents, FIND_LOGIN_FIELDS_SCRIPT) as CredentialFieldTargets | null;
    assertTarget();
    if (!fields?.password || !isPoint(fields.password)) {
      throw new Error('No se encontro un campo de contrasena visible en esta pagina.');
    }
    if (fields.username && isPoint(fields.username)) {
      await replaceFocusedField(contents, browserDomPoint(contents, fields.username, tab!.zoomFactor), resolved.metadata.username);
      assertTarget();
    }
    await replaceFocusedField(contents, browserDomPoint(contents, fields.password, tab!.zoomFactor), resolved.password);
    assertTarget();
    return resolved.metadata;
  }

  async removeCredential(id: string): Promise<boolean> {
    const context = this.credentialContext();
    const scopeId = this.scopeId;
    const currentUrl = this.getState().url;
    const credential = (await this.credentialVault.list(currentUrl)).find((item) => item.id === id);
    context.assertCurrent();
    if (!credential) throw new Error('La credencial no pertenece al sitio actual.');
    if (this.scopeId !== scopeId) throw new Error('El perfil cambió antes de eliminar la credencial.');
    const removed = await this.credentialVault.remove(id, currentUrl, context.assertCurrent);
    context.assertCurrent();
    return removed;
  }

  async listExtensions(): Promise<BrowserExtensionMetadata[]> {
    const assertCurrent = this.captureProfileGuard();
    await this.ensureEnterprisePolicy();
    assertCurrent();
    if (this.profileKind !== 'authenticated') return [];
    return this.extensionManager.list(assertCurrent);
  }

  async extensionCatalog(raw: unknown, assertCaller: () => void): Promise<{ catalog?: BrowserExtensionCatalogEntry[]; canceled?: boolean; preview?: BrowserExtensionInstallPreview }> {
    const request = validateExtensionCatalogRequest(raw);
    const profile = this.captureProfileGuard(); const control = this.agentControlRevision; const auth = this.extensionAuthRevision;
    const parent = this.requireParentWindow();
    const guard = () => {
      assertCaller(); profile(); this.assertExtensionsProfile();
      const session = getAuthState();
      if (!session.authenticated || !session.userId || browserScopeIdFor(session.userId) !== this.scopeId
        || auth !== this.extensionAuthRevision || this.agentControlling || control !== this.agentControlRevision
        || parent.isDestroyed() || this.parentWindow !== parent || !parent.isVisible()) throw new Error('Catálogo fuera de contexto.');
      if (request.action === 'prepare' && request.updateInstallId) this.assertNoPagesForExtensionChange();
    };
    guard(); await this.ensureEnterprisePolicy(); guard();
    if (this.enterprisePolicy?.extensionsAllowed === false) throw new Error('Extensiones bloqueadas por la organización.');
    if (request.action === 'list') return { catalog: listExtensionCatalog() };
    return this.extensionManager.prepareFromDialog(parent, guard, { id: request.catalogId, updateInstallId: request.updateInstallId });
  }

  private assertNoPagesForExtensionChange(): void {
    if (this.pictureInPictureWindows.size || [...this.tabs.values()].some(tab => tab.url !== 'about:blank'
      || tab.view && !['', 'about:blank'].includes(tab.view.webContents.getURL()))) throw new Error('Cierra otras páginas y deja la última pestaña en about:blank.');
  }

  async prepareExtensionInstall(): Promise<{ canceled: boolean; preview?: BrowserExtensionInstallPreview }> {
    const assertCurrent = this.captureProfileGuard();
    await this.ensureEnterprisePolicy();
    assertCurrent();
    if (this.enterprisePolicy?.extensionsAllowed === false) throw new Error('Las extensiones están bloqueadas por tu organización.');
    this.assertExtensionsProfile();
    return this.extensionManager.prepareFromDialog(this.requireParentWindow(), assertCurrent);
  }

  async confirmExtensionInstall(token: string): Promise<BrowserExtensionMetadata> {
    const assertCurrent = this.captureProfileGuard();
    await this.ensureEnterprisePolicy();
    assertCurrent();
    if (this.enterprisePolicy?.extensionsAllowed === false) throw new Error('Las extensiones están bloqueadas por tu organización.');
    this.assertExtensionsProfile();
    return this.extensionManager.confirmInstall(token, this.ensureView().webContents.session, assertCurrent);
  }

  async setExtensionEnabled(installId: string, enabled: boolean): Promise<BrowserExtensionMetadata> {
    const assertCurrent = this.captureProfileGuard();
    await this.ensureEnterprisePolicy();
    assertCurrent();
    this.assertExtensionsProfile();
    if (enabled && this.enterprisePolicy?.extensionsAllowed === false) throw new Error('Las extensiones están bloqueadas por tu organización.');
    return this.extensionManager.setEnabled(installId, enabled, this.ensureView().webContents.session, assertCurrent);
  }

  async removeExtension(installId: string): Promise<boolean> {
    const assertCurrent = this.captureProfileGuard();
    await this.ensureEnterprisePolicy();
    assertCurrent();
    this.assertExtensionsProfile();
    return this.extensionManager.remove(installId, this.ensureView().webContents.session, assertCurrent);
  }

  async restrictExtensionSites(installId: string, sites: string[], assertCaller: () => void): Promise<BrowserExtensionMetadata> {
    const profile = this.captureProfileGuard();
    const revision = this.agentControlRevision;
    const assertCurrent = () => {
      assertCaller(); profile(); this.assertExtensionsProfile();
      if (this.agentControlling || revision !== this.agentControlRevision || this.pictureInPictureWindows.size
        || [...this.tabs.values()].some(tab => tab.url !== 'about:blank' || tab.view && tab.view.webContents.getURL() !== 'about:blank')) {
        throw new Error('Cierra las páginas abiertas y deshabilita la extensión antes de restringir sitios; esto evita conservar scripts ya inyectados.');
      }
    };
    assertCurrent(); await this.ensureEnterprisePolicy(); assertCurrent();
    return this.extensionManager.restrictSites(installId, sites, assertCurrent);
  }

  private assertExtensionsProfile(): void {
    if (this.profileKind !== 'authenticated') throw new Error('Las extensiones no están disponibles en perfiles privados o de invitado.');
  }

  private ensureView(): WebContentsView {
    const active = this.getActiveTab();
    if (active) return this.requireTabView(active);
    const tab = this.createTabRuntime();
    this.activeTabId = tab.id;
    this.primaryTabId = tab.id;
    return this.requireTabView(tab);
  }

  private ensureWorkspaceView(): WebContentsView {
    const primary = this.primaryTabId ? this.tabs.get(this.primaryTabId) : null;
    if (primary && !this.detachedWindows.has(primary.id)) return this.requireTabView(primary);
    const workspaceTab = Array.from(this.tabs.values()).find((tab) => !this.detachedWindows.has(tab.id));
    if (workspaceTab) {
      this.primaryTabId = workspaceTab.id;
      return this.requireTabView(workspaceTab);
    }
    const tab = this.createTabRuntime();
    this.primaryTabId = tab.id;
    if (!this.activeTabId) this.activeTabId = tab.id;
    return this.requireTabView(tab);
  }

  private createTabRuntime(materialize = true): BrowserTabRuntime {
    if (this.scopeChanging) throw new Error('El perfil está cambiando; espera antes de abrir pestañas.');
    this.captureProfileGuard()();
    const tab: BrowserTabRuntime = {
      id: randomUUID(),
      view: null,
      url: 'about:blank',
      title: 'Nueva pestaña',
      canGoBack: false,
      canGoForward: false,
      loading: false,
      error: null,
      navigationSafety: null,
      navigationSafetyUrl: null,
      lastActivatedAt: Date.now(),
      visualRevision: 0,
      documentToken: randomUUID(),
      passiveCaptureNotBefore: 0,
      lastDeferAt: 0,
      appliedVisible: null,
      appliedBounds: null,
      bootstrap: null,
      credentialObserver: null,
      muted: false,
      zoomFactor: 1,
      find: null,
      pinned: false,
      groupId: null,
    };
    this.tabs.set(tab.id, tab);
    if (materialize) this.materializeTab(tab, false);
    return tab;
  }

  private materializeTab(tab: BrowserTabRuntime, restoreUrl: boolean): WebContentsView {
    if (tab.view && !tab.view.webContents.isDestroyed()) return tab.view;
    const parent = this.requireParentWindow();
    const view = new WebContentsView({
      webPreferences: {
        // Particion del perfil del usuario con sesion activa: cookies, sesiones
        // de sitio y almacenamiento local no cruzan de una cuenta a otra.
        partition: browserPartitionFor(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        // La vista se oculta cada vez que se abre un panel del navegador o las
        // sugerencias de la barra. Con el throttling activo esa pausa congela
        // temporizadores y carga diferida de la pagina (paneles de YouTube,
        // listas de Gmail) y la reanudacion tarda segundos.
        backgroundThrottling: false,
        spellcheck: true,
      },
    });
    view.setVisible(false);
    view.setBackgroundColor('#ffffff');
    parent.contentView.addChildView(view);
    this.overlayTopTabId = null;
    tab.view = view;
    tab.documentToken = randomUUID();
    tab.appliedVisible = false;
    tab.appliedBounds = null;
    this.configureWebContents(tab);
    this.downloadManager.attach(view.webContents.session);
    this.configureCertificateVerification(view.webContents.session);
    view.webContents.setAudioMuted(tab.muted);
    this.configureTabZoom(tab);
    this.installAgentBootstrap(tab);
    this.installCredentialObserver(tab);
    if (!this.permissions) {
      this.passkeySelection = new BrowserPasskeySelection(view.webContents.session, details => {
        const profile = this.captureProfileGuard();
        const target = this.getActiveTab();
        const contents = target?.view?.webContents;
        const parent = this.requireParentWindow();
        if (!target || !contents || !details.frame || details.frame !== contents.mainFrame
          || !getAuthState().authenticated || this.profileKind !== 'authenticated' || this.agentControlling || !this.isTabVisible(target)
          || !this.enterpriseUrlAllowed(contents.getURL()) || target.navigationSafety?.action === 'block') {
          throw new Error('Toma el control de la pestaña autenticada para elegir una passkey.');
        }
        this.markSensitiveDocument(target, 'identity');
        // Sin id fija también la revisión de foco: A→B→A no revive el diálogo.
        const document = this.createAgentAccessGuard();
        return { parent, contents, assertCurrent: () => {
          profile(); document();
          if (!getAuthState().authenticated || this.agentControlling || this.getActiveTab() !== target || !this.isTabVisible(target)) throw new Error('La selección de passkey cambió de contexto.');
        } };
      }, cancel => onAuthStateChange(cancel));
      this.permissions = new IntegratedBrowserPermissionGovernance({
        session: view.webContents.session,
        store: this.sitePermissionStore,
        isBrowserContents: (contents) => this.isBrowserContents(contents),
        resolveGovernedOrigin: (contents) => this.governedOriginFor(contents),
        getParentWindow: () => this.parentWindow,
        prompt: (request) => this.promptPermission(request),
        onChanged: () => this.sendToRenderer('integrated-browser:site-permissions-changed', {}),
      });
      this.configureDisplayMedia(view.webContents.session);
      this.observeFailedRequests(view.webContents.session);
      this.configureRequestGovernance(view.webContents.session);
    }
    if (this.profileKind === 'authenticated' && !this.extensionsRestored && (!this.capabilities.enterpriseControls || this.enterprisePolicyReady) && this.enterprisePolicy?.extensionsAllowed !== false) {
      this.extensionsRestored = true;
      void this.extensionManager.restore(view.webContents.session, this.captureProfileGuard()).catch((error) => {
        console.warn('[Navegador][Extensiones] No se pudieron restaurar todas las extensiones:', safeErrorMessage(error instanceof Error ? error.message : String(error)));
      });
    }
    if (restoreUrl && tab.url && tab.url !== 'about:blank' && this.enterpriseUrlAllowed(tab.url)) {
      const safety = checkBrowserNavigationLocal(tab.url);
      this.setNavigationSafety(tab, tab.url, safety);
      if (safety.action === 'block') {
        this.recordError(new Error(safety.reason ?? 'La restauración fue bloqueada por seguridad.'), tab.id);
        return view;
      }
      tab.loading = true;
      void view.webContents.loadURL(tab.url).catch((error) => this.recordError(error, tab.id));
    }
    return view;
  }

  /**
   * `getDisplayMedia`. Sin este handler Electron rechaza la solicitud y el
   * boton de presentar de Meet o Teams falla sin explicacion. El selector de
   * origen es el consentimiento: no se comparte nada que el usuario no elija.
   */
  private configureDisplayMedia(session: WebContentsView['webContents']['session']): void {
    session.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        const source = await pickDisplayMediaSource({
          parentWindow: this.parentWindow,
          audioRequested: request.audioRequested,
        });
        if (!source) {
          // Electron exige responder siempre; un objeto vacio cancela la
          // solicitud y la pagina recibe NotAllowedError, igual que al cerrar
          // el selector de Chrome.
          callback({});
          return;
        }
        callback({
          video: source.video,
          // La captura de audio del sistema solo existe en Windows.
          ...(source.withSystemAudio && process.platform === 'win32' ? { audio: 'loopback' as const } : {}),
        });
      } catch (error) {
        this.recordError(error);
        callback({});
      }
    }, { useSystemPicker: false });
  }

  private configureWebContents(tab: BrowserTabRuntime): void {
    const { id: tabId } = tab;
    const view = this.requireTabView(tab);
    const contents = view.webContents;
    normalizeBrowserUserAgent(contents);
    const isCurrentView = () => tab.view === view && !contents.isDestroyed();
    contents.on('before-input-event', (event, input) => {
      if (!isCurrentView() || !this.capabilities.pageTools || this.activeTabId !== tab.id || input.type !== 'keyDown'
        || input.alt || !(process.platform === 'darwin' ? input.meta : input.control)) return;
      const action = input.key === '0' ? 'reset' : ['+', '='].includes(input.key) ? 'in' : input.key === '-' ? 'out' : null;
      if (!action) return;
      event.preventDefault(); this.setZoom(action);
    });
    contents.on('zoom-changed', (event, direction) => {
      if (!isCurrentView() || !this.capabilities.pageTools || this.activeTabId !== tab.id || supportsIsolatedBrowserZoom(contents)
        || (direction !== 'in' && direction !== 'out')) return;
      event.preventDefault(); this.setZoom(direction);
    });
    contents.on('did-navigate', () => { if (isCurrentView()) this.sensitiveDocuments.delete(contents); });
    contents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => {
      if (isCurrentView() && isMainFrame) tab.documentToken = randomUUID();
    });
    contents.setWindowOpenHandler((details) => {
      if (!isCurrentView()) return { action: 'deny' };
      const { url } = details;
      if (isBlockedGoogleChatDirectCall(contents.getURL(), url)) {
        console.warn('[Navegador][Seguridad] Llamada directa automática de Google Chat bloqueada.');
        return { action: 'deny' };
      }
      // Document Picture-in-Picture y los popups que la pagina rellena por
      // script piden `about:blank`. Convertirlos en pestañas dejaba pestañas
      // vacias y a la pagina esperando una ventana que nunca existio.
      if (isBlankPopupTarget(url)) {
        console.info('[Navegador][Ventana] Popup gobernado permitido como ventana real.');
        const popupOptions = buildPopupWindowOptions(details);
        return {
          action: 'allow',
          // `did-create-window` se emite despues de entregar el webContents a
          // Chromium. Prepararla aqui cierra la carrera de gobernanza sin
          // confiar en todo contenido que comparta la sesion.
          createWindow: (options: BrowserWindowConstructorOptions) => {
            // Se conservan las opciones heredadas del abridor, en particular
            // webPreferences/session y la relacion `window.opener`. Solo se
            // acotan dimensiones y presentacion de la ventana.
            const popup = new BrowserWindow({ ...options, ...popupOptions });
            this.prepareBrowserPopupWindow(popup, normalizeOrigin(contents.getURL()));
            console.info(`[Navegador][Ventana] Ventana real adoptada antes de entregarla: ${this.isBrowserContents(popup.webContents) ? 'sí' : 'no'}.`);
            return popup.webContents;
          },
        };
      }
      if (isAllowedBrowserUrl(url) && this.enterpriseUrlAllowed(url)) {
        const safety = checkBrowserNavigationLocal(url);
        if (safety.action === 'block') {
          this.recordError(new Error(safety.reason ?? 'La navegación fue bloqueada por la revisión local.'));
          return { action: 'deny' };
        }
        // `window.open` con destino se convierte en pestaña, asi que quien la
        // abrio recibe `null` y pierde la relacion `opener`. Queda registrado
        // porque hay flujos que dependen de ese vinculo.
        console.info(`[Navegador][Ventana] Apertura con destino convertida en pestaña: ${describeBlockedUrl(url)}`);
        void this.createTab(url, true).catch((error) => this.recordError(error));
      } else this.recordError(new Error('El sitio intento abrir un protocolo no permitido.'));
      return { action: 'deny' };
    });
    // Un marco que no carga deja a la pagina a medias sin decir por que. El
    // codigo -3 es una cancelacion ordinaria y no se registra.
    contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (errorCode === -3) return;
      const ambito = isMainFrame ? 'documento' : 'marco';
      console.warn(`[Navegador][Carga] ${ambito} fallido (${errorCode} ${errorDescription}): ${describeBlockedUrl(validatedURL)}`);
    });
    // Publicar el cierre de una pestaña permite recargarla sin reiniciar la
    // aplicación. Este listener no puede interceptar un fallo nativo de main.
    contents.on('render-process-gone', (_event, details) => {
      // No dependemos de `isCurrentView()`: en algunas versiones el evento se
      // emite cuando `webContents.isDestroyed()` ya cambió a true.
      if (tab.view !== view) return;
      tab.loading = false;
      tab.error = 'La página se cerró inesperadamente. Vuelve a cargarla para continuar.';
      this.invalidateObservation(tabId);
      console.error(`[Navegador][Proceso] La pestaña terminó (${details.reason}, código ${details.exitCode}).`);
      this.emitState();
    });
    contents.on('unresponsive', () => {
      if (!isCurrentView()) return;
      console.warn(`[Navegador][Proceso] La pestaña dejó de responder: ${describeBlockedUrl(tab.url)}.`);
      this.emitState();
    });
    contents.on('did-create-window', (window) => {
      // Respaldo para cualquier ventana permitida por Electron fuera del
      // creador controlado anterior.
      this.prepareBrowserPopupWindow(window, normalizeOrigin(contents.getURL()));
    });
    // Pantalla completa de la pagina. Chromium solo cambia su propio estado
    // interno: la vista conserva los bounds del layout y la ventana su tamaño,
    // asi que sin esto el video quedaba encerrado en el mismo recuadro.
    contents.on('enter-html-full-screen', () => {
      if (!isCurrentView()) return;
      this.enterHtmlFullScreen(tabId);
    });
    contents.on('leave-html-full-screen', () => {
      if (!isCurrentView()) return;
      this.leaveHtmlFullScreen(tabId);
    });
    contents.on('context-menu', (_event, params) => {
      if (!isCurrentView()) return;
      buildBrowserContextMenu({
        contents,
        params,
        pageTitle: tab.title,
        onSelectionAction: (request) => this.sendToRenderer('integrated-browser:selection-action', {
          action: request.action,
          text: request.text,
          title: request.title,
          instruction: buildSelectionInstruction(request.action),
        }),
        onOpenReadingMode: (selection) => this.sendToRenderer('integrated-browser:reading-mode-requested', {
          url: contents.getURL(),
          title: tab.title,
          selection,
        }),
        onFind: () => this.sendToRenderer('integrated-browser:find-requested', {}),
        onPrint: () => { void this.printPage().catch((error) => this.recordError(error, tabId)); },
        onSavePdf: () => { void this.savePageAsPdf().catch((error) => this.recordError(error, tabId)); },
        onToggleMute: () => { this.setMuted(!tab.muted); },
        muted: tab.muted,
      }).popup({ window: this.requireParentWindow() });
    });
    contents.on('will-navigate', (event) => {
      if (!isCurrentView()) return;
      if ((event as typeof event & { isMainFrame?: boolean }).isMainFrame === false) return;
      const url = event.url;
      if (isBlockedGoogleChatDirectCall(contents.getURL(), url)) {
        event.preventDefault();
        console.warn('[Navegador][Seguridad] Llamada directa automática de Google Chat bloqueada.');
        return;
      }
      const safety = this.localNavigationVerdict(url);
      this.setNavigationSafety(tab, url, safety);
      if (isAllowedBrowserUrl(url) && this.enterpriseUrlAllowed(url) && safety.action !== 'block') {
        this.emitState();
        return;
      }
      event.preventDefault();
      console.warn('[Navegador][Seguridad] Navegacion bloqueada:', describeBlockedUrl(url));
      this.recordError(new Error('La navegacion fue bloqueada por seguridad.'), tabId);
    });
    contents.on('will-redirect', (event) => {
      if (!isCurrentView()) return;
      if (isBlockedGoogleChatDirectCall(contents.getURL(), event.url)) {
        event.preventDefault();
        console.warn('[Navegador][Seguridad] Llamada directa automática de Google Chat bloqueada.');
        return;
      }
      if ((event as typeof event & { isMainFrame?: boolean }).isMainFrame === false) return;
      const safety = this.localNavigationVerdict(event.url);
      this.setNavigationSafety(tab, event.url, safety);
      if (isAllowedBrowserUrl(event.url) && this.enterpriseUrlAllowed(event.url) && safety.action !== 'block') {
        this.emitState();
        return;
      }
      event.preventDefault();
      console.warn('[Navegador][Seguridad] Redireccion bloqueada:', describeBlockedUrl(event.url));
      this.recordError(new Error('La redireccion fue bloqueada por seguridad.'), tabId);
    });
    contents.on('will-frame-navigate', (event) => {
      if (!isCurrentView() || event.isMainFrame) return;
      if (!isBlockedGoogleChatDirectCall(contents.getURL(), event.url)) return;
      event.preventDefault();
      console.warn('[Navegador][Seguridad] Llamada directa automática de Google Chat bloqueada.');
    });
    contents.on('did-start-loading', () => {
      if (!isCurrentView()) return;
      tab.loading = true;
      tab.error = null;
      this.deferPassiveCapture(tab);
      this.emitState();
    });
    contents.on('did-stop-loading', () => {
      if (!isCurrentView()) return;
      tab.loading = false;
      // loadURL/did-finish-load pueden terminar antes de que Chromium retire
      // isLoadingMainFrame. Reaplicar aquí el zoom diferido por esa barrera.
      this.configureTabZoom(tab);
      this.snapshotTab(tab);
      this.emitState();
      this.deferPassiveCapture(tab);
    });
    contents.on('focus', () => {
      if (!isCurrentView()) return;
      if (!this.tabs.has(tabId) || this.activeTabId === tabId) return;
      this.activeTabId = tabId;
      this.emitState();
    });
    contents.on('did-navigate', () => {
      if (!isCurrentView()) return;
      this.configureTabZoom(tab);
      tab.documentToken = randomUUID();
      tab.visualRevision += 1;
      this.snapshotTab(tab);
      this.refreshNavigationSafety(tab);
      this.invalidateObservation(tabId);
      this.deferPassiveCapture(tab);
      this.emitState();
    });
    contents.on('found-in-page', (_event, result) => {
      if (!isCurrentView() || !tab.find || result.requestId === undefined) return;
      tab.find = {
        ...tab.find,
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
        finalUpdate: result.finalUpdate,
      };
      this.emitState();
    });
    contents.on('did-finish-load', () => {
      if (!isCurrentView()) return;
      this.configureTabZoom(tab);
      void this.installSelectionWatcher(contents);
      this.snapshotTab(tab);
      if (isAllowedBrowserUrl(tab.url)) tab.error = null;
      void this.historyStore.record({ url: contents.getURL(), title: contents.getTitle() }).catch((error) => {
        console.warn('[Navegador][Historial] No se pudo registrar la visita:', safeErrorMessage(error instanceof Error ? error.message : String(error)));
      });
    });
    contents.on('did-navigate-in-page', () => {
      if (!isCurrentView()) return;
      tab.documentToken = randomUUID();
      tab.visualRevision += 1;
      this.refreshNavigationSafety(tab);
      this.invalidateObservation(tabId);
      this.deferPassiveCapture(tab);
      this.emitState();
    });
    // La pagina avisa por consola cuando cambia su seleccion. Es el unico
    // disparador que no depende de que Electron emita eventos de entrada para
    // una vista nativa, y ademas cubre seleccionar con teclado o por script.
    contents.on('console-message', (...args: unknown[]) => {
      if (!isCurrentView()) return;
      const detalle = args[0] as { message?: string } | undefined;
      const mensaje = typeof detalle?.message === 'string' ? detalle.message : String(args[2] ?? '');
      if (mensaje.includes(WRITING_PANEL_BEACON)) {
        void this.collectWritingRequest(tab);
        return;
      }
      const accionMenu = parseSelectionMenuBeacon(mensaje);
      if (accionMenu) {
        void this.runSelectionMenuAction(tab, accionMenu);
        return;
      }
      if (mensaje.includes(SELECTION_BEACON)) this.deferSelectionProbe(tab);
    });
    contents.on('input-event', (_event, input) => {
      if (!isCurrentView()) return;
      // Al soltar el raton o el teclado puede haber terminado una seleccion:
      // el chat la adjunta sola, sin pasar por el menu contextual.
      if (input.type === 'mouseUp' || input.type === 'keyUp') {
        selectionLog(`entrada ${input.type}: sondeo programado`);
        this.deferSelectionProbe(tab);
      }
      if (!isMeaningfulBrowserInput(input)) return;
      this.deferPassiveCapture(tab);
    });
    contents.on('page-title-updated', () => {
      if (!isCurrentView()) return;
      this.snapshotTab(tab);
      const detached = this.detachedWindows.get(tabId);
      if (detached && !detached.isDestroyed()) detached.setTitle(detachedWindowTitle(tab));
      this.emitState();
    });
    contents.on('certificate-error', (_event, url, _error, _certificate, callback) => {
      callback(false);
      if (!isCurrentView()) return;
      this.setNavigationSafety(tab, url, this.certificateBlockVerdict());
      this.emitState();
    });
    contents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (!isCurrentView()) return;
      if (!isMainFrame || errorCode === -3) return;
      tab.loading = false;
      tab.error = safeErrorMessage(errorDescription || `Error de navegacion (${errorCode}).`);
      this.emitState();
    });
  }

  private async loadTarget(rawTarget: unknown, assertCallerCurrent?: () => void): Promise<void> {
    const target = normalizeBrowserTarget(rawTarget);
    const view = this.ensureView();
    const tab = this.getActiveTab()!;
    const assertCurrent = this.captureNavigationGuard();
    const requestRevision = ++this.navigationRequestRevision;
    const documentRevision = tab.visualRevision;
    const previousUrl = view.webContents.getURL();
    const safety = await checkBrowserNavigation(target, { allowRemote: this.profileKind === 'authenticated' });
    assertCurrent();
    assertCallerCurrent?.();
    if (requestRevision !== this.navigationRequestRevision || tab.view !== view || view.webContents.isDestroyed()
      || tab.visualRevision !== documentRevision || view.webContents.getURL() !== previousUrl) {
      throw new Error('La navegación fue reemplazada durante la revisión de seguridad.');
    }
    if (!this.enterpriseUrlAllowed(target)) {
      this.setNavigationSafety(tab, target, this.localNavigationVerdict(target));
      this.emitState();
      throw new Error('El sitio está bloqueado por tu organización.');
    }
    this.setNavigationSafety(tab, target, safety);
    this.emitState();
    this.assertNavigationAllowed(safety);
    tab.error = null;
    tab.url = target;
    try {
      await view.webContents.loadURL(target);
    } catch (error) {
      assertCurrent();
      // Una navegacion abortada no es un fallo: ocurre cada vez que el propio
      // sitio navega por su cuenta (las aplicaciones de una sola pagina lo
      // hacen al arrancar) o el usuario pide otro destino antes de terminar.
      if (isSupersededNavigation(error)) {
        this.recordError(error, tab.id);
        return;
      }
      this.recordError(error, tab.id);
      throw error;
    }
  }

  private assertNavigationAllowed(verdict: BrowserNavigationSafetyVerdict): void {
    if (verdict.action === 'block') throw new Error(verdict.reason ?? 'La navegación fue bloqueada por la protección local.');
  }

  private localNavigationVerdict(target: string): BrowserNavigationSafetyVerdict {
    const local = checkBrowserNavigationLocal(target);
    if (local.action === 'block' || this.enterpriseUrlAllowed(target)) return local;
    return { ...local, action: 'block', reason: 'La política de tu organización no permite esta solicitud.' };
  }

  private certificateBlockVerdict(): BrowserNavigationSafetyVerdict {
    return { action: 'block', source: 'local', reason: 'No se pudo verificar el certificado del sitio. La conexión fue rechazada.', checkedAt: new Date().toISOString() };
  }

  private setNavigationSafety(tab: BrowserTabRuntime, target: string, verdict: BrowserNavigationSafetyVerdict): void {
    const wasBlocked = tab.navigationSafety?.action === 'block';
    tab.navigationSafetyUrl = target;
    tab.navigationSafety = { ...verdict };
    if (tab.view && tab.appliedVisible !== null && wasBlocked !== (verdict.action === 'block')) tab.view.setVisible(tab.appliedVisible && verdict.action !== 'block');
    this.updateTabSafetyInterstitial(tab);
  }

  private updateTabSafetyInterstitial(tab: BrowserTabRuntime): void {
    const key = `tab:${tab.id}`;
    const parent = this.detachedWindows.get(tab.id) ?? this.parentWindow;
    const verdict = tab.navigationSafety;
    const view = tab.view;
    if (!parent || !view || !tab.appliedVisible || !tab.appliedBounds || verdict?.action !== 'block') { this.safetyInterstitials.remove(key); return; }
    this.safetyInterstitials.show(key, { parent, bounds: tab.appliedBounds, verdict,
      isCurrent: () => this.tabs.get(tab.id) === tab && tab.view === view && tab.navigationSafety === verdict && !view.webContents.isDestroyed(),
      openBlank: async () => {
        await view.webContents.loadURL('about:blank');
        if (this.tabs.get(tab.id) !== tab || tab.view !== view) return;
        tab.url = 'about:blank'; tab.error = null;
        this.setNavigationSafety(tab, 'about:blank', checkBrowserNavigationLocal('about:blank'));
        this.emitState();
      },
      close: () => { this.closeTab(tab.id); },
    });
  }

  private refreshNavigationSafety(tab: BrowserTabRuntime): void {
    // El documento rechazado no puede retirar el aviso mediante cambios de hash
    // ni eventos tardíos. Una nueva navegación revisada establece otro dictamen.
    if (tab.navigationSafety?.action === 'block') return;
    const target = tab.view?.webContents.getURL();
    if (target && target !== tab.navigationSafetyUrl) {
      // Enlaces, historial, redirecciones y restauración no heredan un dictamen
      // remoto anterior. Esta ruta sólo acredita una revisión local.
      this.setNavigationSafety(tab, target, checkBrowserNavigationLocal(target));
    }
  }

  private captureNavigationGuard(allowPendingCleanup = false): () => void {
    const assertProfileCurrent = this.captureProfileGuard(allowPendingCleanup);
    const activeRevision = this.activeTabRevision;
    return () => {
      assertProfileCurrent();
      if (activeRevision !== this.activeTabRevision) throw new Error('La pestaña cambió durante la operación de navegación.');
    };
  }

  private recordError(error: unknown, tabId?: string): void {
    const tab = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    if (tab) {
      tab.loading = false;
      // El aborto por navegacion superada no se muestra al usuario: es el curso
      // normal de un sitio que redirige o reescribe su propia URL al cargar.
      if (!isSupersededNavigation(error)) {
        tab.error = safeErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }
    this.emitState();
  }

  /**
   * Pide al renderer que muestre el aviso de permiso y espera su decision.
   *
   * Nunca puede quedarse pendiente: la pagina esta bloqueada esperando la
   * respuesta, y una promesa que no resuelve deja la llamada a medias para
   * siempre. Sin renderer, o si el usuario ignora el aviso, se deniega.
   */
  private promptPermission(request: BrowserPermissionPromptRequest): Promise<boolean> {
    const parent = this.parentWindow;
    if (!parent || parent.isDestroyed()) {
      console.warn('[Navegador][Permisos] Sin ventana donde mostrar el aviso: se deniega.');
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      const settle = (granted: boolean) => {
        if (!this.permissionPrompts.delete(request.id)) return;
        clearTimeout(timer);
        resolve(granted);
      };
      const timer = setTimeout(() => {
        console.warn(`[Navegador][Permisos] El aviso de ${request.origin} expiro sin respuesta.`);
        settle(false);
      }, PERMISSION_PROMPT_TIMEOUT_MS);
      this.permissionPrompts.set(request.id, settle);
      this.sendToRenderer('integrated-browser:permission-prompt', request);
    });
  }

  private createAgentAccessGuard(tabId?: string, signal?: AbortSignal, document = true): () => void {
    const tab = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    const contents = tab?.view?.webContents;
    const startedUrl = contents?.getURL() ?? tab?.url;
    const scopeId = this.scopeId;
    const revision = tab?.visualRevision;
    const generation = this.sessionGeneration;
    const parent = this.parentWindow;
    const activeRevision = this.activeTabRevision;
    const policyRevision = this.agentPolicyRevision;
    const controlRevision = this.agentControlRevision;
    const assertTarget = () => {
      assertCuNotAborted(signal);
      if (this.scopeChanging || this.shutdownCommitted || this.ephemeralCleanupPending || this.ephemeralCleanupFailed
        || this.sessionGeneration !== generation || this.scopeId !== scopeId
        || !parent || parent.isDestroyed() || this.parentWindow !== parent
        || !tab || !contents || this.tabs.get(tab.id) !== tab || tab.view?.webContents !== contents
        || contents.isDestroyed() || this.agentPolicyRevision !== policyRevision || this.agentControlRevision !== controlRevision
        || (document && ((contents.getURL() ?? tab.url) !== startedUrl || tab.visualRevision !== revision))
        || (!tabId && (this.activeTabId !== tab.id || this.activeTabRevision !== activeRevision))) throw new CuContextChangedError();
    };
    assertTarget();
    return assertTarget;
  }

  private async authorizeAgentAccess(capability: BrowserAgentCapability, tabId?: string, signal?: AbortSignal): Promise<() => void> {
    const assertTarget = this.createAgentAccessGuard(tabId, signal);
    const tab = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    const startedUrl = tab?.view?.webContents.getURL() ?? tab?.url;
    const policyAudit = (allowed: boolean, confirmation: 'none' | 'accepted' | 'rejected' = 'none') => {
      if (this.capabilities.agentGovernance) this.auditStore.record({ traceId: this.auditTrace.getStore() ?? randomUUID(),
        tabId: tab?.id ?? '', url: startedUrl ?? '', operation: 'policy', result: allowed ? 'allowed' : 'blocked', confirmation });
    };
    if (this.capabilities.enterpriseControls) await this.ensureEnterprisePolicy();
    assertTarget();
    if (this.enterprisePolicy?.agentAllowed === false) { policyAudit(false); throw new Error('SofLIA está bloqueada por tu organización en el navegador.'); }
    if (!this.capabilities.agentGovernance) { this.assertKnownDocumentNotSensitive(tabId); return assertTarget; }
    await this.assertDocumentNotSensitive(tabId); assertTarget();
    let origin: string;
    try { origin = normalizeAgentOrigin(startedUrl ?? ''); }
    catch { throw new Error('SofLIA sólo puede acceder a páginas web seguras del navegador.'); }
    const evaluation = await this.agentPolicyStore.evaluate(origin, capability);
    assertTarget();
    if (evaluation === 'block') { policyAudit(false); throw new Error('SofLIA no tiene permiso para acceder a este sitio.'); }
    if (evaluation === 'allow') { await this.assertDocumentNotSensitive(tabId); assertTarget(); policyAudit(true); return assertTarget; }
    const decision = await this.promptAgentPolicy({
      id: randomUUID(),
      origin,
      capability,
      label: capability === 'act' ? 'interactuar con la página' : capability === 'capture' ? 'capturar la página' : capability === 'read-document' ? 'leer el documento' : 'leer y capturar el contenido',
    }, signal);
    assertTarget();
    policyAudit(decision === 'allow-once' || decision === 'allow-always', decision === 'allow-once' || decision === 'allow-always' ? 'accepted' : 'rejected');
    if (decision === 'allow-always' || decision === 'block') {
      const current = await this.agentPolicyStore.get(origin);
      assertTarget();
      await this.agentPolicyStore.set({ origin, mode: current.mode, decision });
      if (decision === 'block') this.agentPolicyRevision += 1;
    }
    if (decision !== 'allow-once' && decision !== 'allow-always') throw new Error('El acceso del agente fue bloqueado por el usuario.');
    await this.assertDocumentNotSensitive(tabId);
    assertTarget();
    return assertTarget;
  }

  private async canAgentAccessWithoutPrompt(rawUrl: string, capability: BrowserAgentCapability): Promise<boolean> {
    if (this.capabilities.enterpriseControls && !this.enterprisePolicyReady) return false;
    if (this.enterprisePolicy?.agentAllowed === false) return false;
    if (!this.capabilities.agentGovernance) return true;
    try { return await this.agentPolicyStore.evaluate(rawUrl, capability) === 'allow'; }
    catch { return false; }
  }

  private promptAgentPolicy(request: BrowserAgentPolicyPromptRequest, signal?: AbortSignal): Promise<BrowserAgentSiteDecision> {
    assertCuNotAborted(signal);
    const parent = this.parentWindow;
    if (!parent || parent.isDestroyed() || this.agentPolicyPrompts.size >= 5) return Promise.resolve('ask');
    return new Promise((resolve) => {
      const settle = (decision: BrowserAgentSiteDecision) => {
        if (!this.agentPolicyPrompts.delete(request.id)) return;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(decision);
        this.emitState();
      };
      const onAbort = () => settle('ask');
      const timer = setTimeout(() => settle('ask'), PERMISSION_PROMPT_TIMEOUT_MS);
      this.agentPolicyPrompts.set(request.id, settle);
      signal?.addEventListener('abort', onAbort, { once: true });
      this.sendToRenderer('integrated-browser:agent-policy-prompt', request);
    });
  }

  resolveAgentPolicyPrompt(id: string, decision: BrowserAgentSiteDecision): boolean {
    if (decision !== 'allow-once' && decision !== 'allow-always' && decision !== 'block') throw new Error('La decisión del agente es inválida.');
    const settle = this.agentPolicyPrompts.get(id);
    if (!settle) return false;
    settle(decision);
    return true;
  }

  /** Respuesta del usuario al aviso. Devuelve falso si el aviso ya no existe. */
  resolvePermissionPrompt(id: string, granted: boolean): boolean {
    const settle = this.permissionPrompts.get(id);
    if (!settle) return false;
    settle(granted);
    return true;
  }

  /** Deniega los avisos vivos: quedarse esperando a un renderer que ya no esta cuelga la pagina. */
  private discardPermissionPrompts(): void {
    for (const settle of [...this.permissionPrompts.values()]) settle(false);
    this.permissionPrompts.clear();
    for (const settle of [...this.agentPolicyPrompts.values()]) settle('ask');
    this.agentPolicyPrompts.clear();
  }

  private sendToRenderer(channel: string, payload: unknown): void {
    const parent = this.parentWindow;
    if (parent && !parent.isDestroyed()) parent.webContents.send(channel, payload);
  }

  private emitState(): void {
    if (this.agentTaskBinding) {
      try { this.agentTaskBinding.assertCurrent(); }
      catch { this.agentTaskBinding.control.command('stop'); }
    }
    const state = this.getState();
    this.emit('state-changed', state);
    const parent = this.parentWindow;
    if (parent && !parent.isDestroyed()) parent.webContents.send('integrated-browser:state-changed', state);
    this.queueSessionSave();
  }

  private captureProfileGuard(allowPendingCleanup = false): () => void {
    const scopeId = this.scopeId;
    const generation = this.sessionGeneration;
    const transition = this.scopeTransition;
    const parent = this.parentWindow;
    const assertCurrent = () => {
      if (this.scopeChanging) throw new Error('El perfil está cambiando; espera antes de usar el navegador.');
      if (this.shutdownCommitted) throw new Error('El navegador está cerrándose.');
      if (this.ephemeralCleanupFailed || (!allowPendingCleanup && this.ephemeralCleanupPending)) {
        throw new Error('El perfil temporal está limpiándose; espera o vuelve a abrir el navegador.');
      }
      if (!parent || parent.isDestroyed()) throw new Error('El navegador no está iniciado.');
      if (this.scopeId !== scopeId || this.sessionGeneration !== generation
        || this.scopeTransition !== transition || this.parentWindow !== parent) {
        throw new Error('El perfil o la ventana cambió durante la operación del navegador.');
      }
    };
    assertCurrent();
    return assertCurrent;
  }

  getSyncDevices() { return this.syncDevices.status(this.syncDeviceContext()); }
  registerSyncDevice() { return this.syncDevices.register(this.syncDeviceContext()); }
  revokeSyncDevice(id: string) { return this.syncDevices.revoke(id, this.syncDeviceContext()); }
  cancelSyncOperation(): void { this.syncDevices.cancel(); this.syncController.cancel(); }

  controlSync(input: BrowserSyncControlRequest) {
    const context = this.syncControlContext();
    switch (input.action) {
      case 'status': return this.syncController.status(context);
      case 'configure': return this.syncController.configure(input.categories, context);
      case 'pause': return this.syncController.configure([], context);
      case 'recover-settings': return this.syncController.recoverSettings(context);
      case 'recover-state': case 'rollback-state': return this.syncController.recoverState(input.action, context);
      case 'export-key': return this.syncController.keys('export', context);
      case 'import-key': return this.syncController.keys('import', context);
      case 'resolve': return this.syncController.synchronize(context, input);
      case 'run': return this.syncController.synchronize(context);
    }
  }

  private syncControlContext(): BrowserSyncControlContext {
    const context = this.syncDeviceContext();
    const parent = this.parentWindow!;
    return { ...context,
      local: createBrowserSyncLocalAdapter({ bookmarks: this.bookmarkStore,
        readSession: async () => {
          context.guard();
          if (!this.capabilities.sessionRestore) throw new Error('Habilita la restauración de sesión antes de sincronizar pestañas, grupos o disposición.');
          if (this.restorableSession) throw new Error('Restaura o descarta la sesión anterior antes de sincronizar.');
          return this.syncSessionSnapshot();
        },
        compareAndApplySession: async (expected, next, guard) => this.applySyncSession(expected, next, guard) }),
      confirm: async (action, detail) => {
        context.guard();
        const descriptions = {
          configure: 'Se habilitarán las categorías seleccionadas para ejecutar sincronización bajo demanda. No se incluyen contraseñas, cookies ni passkeys.',
          run: 'Se combinarán datos locales y remotos. Las pestañas reemplazadas o retiradas pueden perder formularios no guardados. Guarda tu trabajo antes de continuar.',
          pause: 'Se desactivarán las categorías locales. Se conservan claves, archivos y copias remotas. Para revocar el acceso de la sesión usa Revocar dispositivo.',
          'keys-export': 'El archivo contiene la clave que permite descifrar tus datos sincronizados. Guárdalo en un lugar seguro y no lo compartas. Se elegirá un archivo nuevo; no se envía al servidor.',
          'keys-import': 'Se leerá el código de un archivo elegido por ti. No se reemplazará una clave local distinta ni se subirá el archivo al servidor.',
          'recover-settings': 'Se recuperará la configuración local ausente o dañada desde su respaldo. La transferencia quedará desactivada y tendrás que elegir categorías de nuevo. Se conservan respaldo y original dañado cifrado. No se restauran claves, dispositivos, checkpoints ni decisiones pendientes y no se contacta al servidor.',
          'recover-state': 'Se archivarán cifrados los checkpoints y conflictos locales dañados o incoherentes y se reiniciará su seguimiento, con transferencia desactivada. No se repiten envíos ni aprobaciones antiguas. Tus marcadores, pestañas y datos remotos no se modifican. Al reactivar, compara nuevamente las versiones. Si se interrumpe, revierte la recuperación incompleta antes de sincronizar. No restaura claves ni dispositivos revocados.',
          'rollback-state': 'Se restaurarán exactamente los tres archivos locales anteriores a una recuperación incompleta: configuración, checkpoints y conflictos. El daño original puede seguir presente. Se conserva un archivo cifrado de la operación y no se contacta al servidor ni se modifican claves o dispositivos. No deshace cambios remotos.',
          resolve: 'La elección puede sustituir datos locales o remotos de la categoría indicada. Se comprobará que las versiones revisadas no cambiaron. Guarda tu trabajo antes de continuar.',
        };
        const result = await this.withSyncDialog(() => dialog.showMessageBox(parent, { type: 'warning', title: 'Sincronización del navegador', message: '¿Confirmas esta operación?',
          detail: `${descriptions[action]}${detail ? `\n\n${detail}` : ''}`, buttons: ['Cancelar', 'Continuar'], defaultId: 0, cancelId: 0, noLink: true }));
        context.guard(); return result.response === 1;
      },
      recoveryPath: async (action) => {
        context.guard();
        if (action === 'export') {
          const result = await this.withSyncDialog(() => dialog.showSaveDialog(parent, { title: 'Guardar código de recuperación', defaultPath: 'recuperacion-sync.txt', filters: [{ name: 'Texto', extensions: ['txt'] }] }));
          context.guard(); return result.canceled ? null : result.filePath ?? null;
        }
        const result = await this.withSyncDialog(() => dialog.showOpenDialog(parent, { title: 'Importar código de recuperación', properties: ['openFile'], filters: [{ name: 'Texto', extensions: ['txt'] }] }));
        context.guard(); return result.canceled ? null : result.filePaths[0] ?? null;
      },
    };
  }

  private syncSessionSnapshot(): BrowserSessionSnapshot {
    return { version: 2, savedAt: '', cleanExit: false, activeTabId: this.activeTabId, primaryTabId: this.primaryTabId,
      secondaryTabId: this.secondaryTabId, detachedTabIds: [...this.detachedWindows.keys()], viewMode: this.viewMode, tabLayout: this.tabLayout,
      tabs: Array.from(this.tabs.values()).map((tab, position) => { this.snapshotTab(tab); return this.toSessionTab(tab, position); }),
      groups: Array.from(this.groups.values()).map((group) => ({ ...group })) };
  }

  private async withSyncDialog<T>(action: () => Promise<T>): Promise<T> {
    if (this.syncDialogPending) throw new Error('Hay una confirmación de sincronización pendiente.');
    this.syncDialogPending = true;
    try { return await action(); } finally { this.syncDialogPending = false; }
  }

  private async applySyncSession(expected: BrowserSessionSnapshot, next: BrowserSessionSnapshot, guard: () => void): Promise<boolean> {
    await this.ensureEnterprisePolicy(); guard();
    if (this.restorableSession) throw new Error('Restaura o descarta la sesión anterior antes de sincronizar pestañas.');
    if (JSON.stringify(this.syncSessionSnapshot()) !== JSON.stringify(expected)) return false;
    if (next.tabs.length > INTEGRATED_BROWSER_MAX_TABS || next.tabs.some((tab) => !this.enterpriseUrlAllowed(tab.url))) throw new Error('La sesión sincronizada excede límites o contiene sitios bloqueados.');
    guard();
    const current = new Map(this.tabs);
    for (const tab of current.values()) {
      const saved = next.tabs.find((value) => value.id === tab.id);
      if (!saved || saved.url !== tab.url) { this.destroyTab(tab); this.tabs.delete(tab.id); }
    }
    const ordered = new Map<string, BrowserTabRuntime>();
    for (const saved of next.tabs) {
      let tab = this.tabs.get(saved.id);
      if (!tab) { tab = this.createTabRuntime(false); this.tabs.delete(tab.id); tab.id = saved.id; }
      tab.url = saved.url; tab.title = saved.title; tab.pinned = saved.pinned; tab.muted = saved.muted; tab.groupId = saved.groupId;
      ordered.set(tab.id, tab);
    }
    this.tabs = ordered;
    this.groups = new Map(next.groups.map((group) => [group.id, { ...group }]));
    this.tabLayout = next.tabLayout;
    this.activeTabId = next.activeTabId && ordered.has(next.activeTabId) ? next.activeTabId : ordered.keys().next().value ?? null;
    this.primaryTabId = next.primaryTabId && ordered.has(next.primaryTabId) ? next.primaryTabId : this.activeTabId;
    this.secondaryTabId = next.secondaryTabId && ordered.has(next.secondaryTabId) && next.secondaryTabId !== this.primaryTabId ? next.secondaryTabId : null;
    this.viewMode = next.viewMode === 'split' && !this.secondaryTabId ? 'single' : next.viewMode;
    if (this.visible && this.activeTabId) this.activateTabInternal(this.activeTabId);
    this.applyViewLayout();
    this.emitState();
    await this.saveSessionSnapshot({ ...this.syncSessionSnapshot(), savedAt: new Date().toISOString() }); guard();
    return true;
  }

  private syncDeviceContext(): BrowserSyncDeviceContext {
    const profileGuard = this.captureProfileGuard();
    const controlRevision = this.agentControlRevision;
    const guard = () => {
      profileGuard();
      if (this.agentControlling || this.agentControlRevision !== controlRevision) {
        throw new Error('El control cambió durante la operación de sincronización. Toma el control y vuelve a intentarlo.');
      }
    };
    guard();
    const parent = this.parentWindow!;
    return {
      enabled: this.capabilities.encryptedSync, authenticated: this.profileKind === 'authenticated',
      profileRoot: browserProfileRoot(this.scopeId), guard,
      confirm: async (action, label) => {
        guard();
        const result = await this.withSyncDialog(() => dialog.showMessageBox(parent, {
          type: 'warning', title: action === 'register' ? 'Registrar dispositivo' : 'Revocar dispositivo',
          message: action === 'register' ? '¿Registrar este dispositivo en tu cuenta Lia?' : `¿Revocar ${label}?`,
          detail: action === 'register' ? 'Se enviará un identificador aleatorio, sin nombre del equipo, MAC ni contenido navegado. Esto todavía no activa la sincronización de marcadores o pestañas.'
            : 'Impedirá nuevas lecturas y escrituras de esta sesión de dispositivo. No elimina copias ya descargadas. Revocar este dispositivo requiere autenticarse de nuevo para registrarlo.',
          buttons: ['Cancelar', action === 'register' ? 'Registrar' : 'Revocar'], defaultId: 0, cancelId: 0, noLink: true,
        }));
        guard();
        return result.response === 1;
      },
    };
  }

  private async ensureEnterprisePolicy(): Promise<void> {
    const assertCurrent = this.captureProfileGuard();
    if (!this.capabilities.enterpriseControls) return;
    if (!this.enterprisePolicyLoad) {
      const pending = this.refreshEnterprisePolicy();
      this.enterprisePolicyLoad = pending;
      void pending.catch(() => {
        if (this.enterprisePolicyLoad !== pending) return;
        this.enterprisePolicyFailed = true;
        this.enterprisePolicyLoad = null;
      });
    }
    await this.enterprisePolicyLoad;
    assertCurrent();
  }

  private async refreshEnterprisePolicy(): Promise<void> {
    const assertCurrent = this.captureProfileGuard();
    const status = await this.enterprisePolicyStore.getStatus();
    assertCurrent();
    await this.historyStore.setManagedRetention(status.policy?.historyRetentionDays ?? null);
    assertCurrent();
    if (this.capabilities.privacyProtection || status.policy?.forcedPrivacyLevel) {
      await this.privacyStore.hydrate();
      assertCurrent();
    }
    this.enterprisePolicy = status.policy;
    this.enterprisePolicyReady = true;
    this.enterprisePolicyFailed = false;
    this.emitState();
  }

  private enterpriseUrlAllowed(rawUrl: string): boolean {
    if (this.capabilities.enterpriseControls && !this.enterprisePolicyReady) return false;
    const blocked = this.enterprisePolicy?.blockedOrigins;
    if (!blocked?.length) return true;
    try { return !blocked.includes(new URL(rawUrl).origin); }
    catch { return false; }
  }

  private loadRestorableSession(): Promise<void> {
    if (this.scopeChanging) return Promise.reject(new Error('El perfil está cambiando; espera antes de recuperar la sesión.'));
    if (this.sessionLoadedScope === this.scopeId) return Promise.resolve();
    if (this.sessionLoad) return this.sessionLoad;
    const scopeId = this.scopeId;
    const generation = this.sessionGeneration;
    const pending = this.sessionStore.load().then((snapshot) => {
      if (generation !== this.sessionGeneration || scopeId !== this.scopeId) return;
      this.sessionLoadedScope = scopeId;
      this.restorableSession = snapshot?.tabs.length ? snapshot : null;
      this.emitState();
    });
    this.sessionLoad = pending;
    void pending.finally(() => { if (this.sessionLoad === pending) this.sessionLoad = null; }).catch(() => undefined);
    return pending;
  }

  private queueSessionSave(): void {
    if (this.shutdownCommitted || this.shutdownFlushing) return;
    if (!this.capabilities.sessionRestore) return;
    if (this.sessionLoadedScope !== this.scopeId) return;
    if (this.restorableSession || this.tabs.size === 0) return;
    if (this.sessionSaveTimer) clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = setTimeout(() => {
      this.sessionSaveTimer = null;
      void this.persistSession(false).catch((error) => console.warn('[Navegador][Sesión] No se pudo guardar:', safeErrorMessage(error instanceof Error ? error.message : String(error))));
    }, 250);
    this.sessionSaveTimer.unref?.();
  }

  private persistSession(cleanExit: boolean): Promise<void> {
    if (this.shutdownCommitted) return Promise.resolve();
    const snapshot = this.buildSessionSnapshot(cleanExit);
    return snapshot ? this.saveSessionSnapshot(snapshot) : Promise.resolve();
  }

  private buildSessionSnapshot(cleanExit: boolean): BrowserSessionSnapshot | null {
    if (!this.capabilities.sessionRestore || this.tabs.size === 0 || this.restorableSession || this.sessionLoadedScope !== this.scopeId) return null;
    const tabs = Array.from(this.tabs.values()).map((tab, position) => {
      this.snapshotTab(tab);
      return this.toSessionTab(tab, position);
    });
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      cleanExit,
      activeTabId: this.activeTabId,
      primaryTabId: this.primaryTabId,
      secondaryTabId: this.viewMode === 'single' ? null : this.secondaryTabId,
      detachedTabIds: [...this.detachedWindows.keys()],
      viewMode: this.viewMode,
      tabLayout: this.tabLayout,
      tabs,
      groups: Array.from(this.groups.values()).map((group) => ({ ...group })),
    };
  }

  private saveSessionSnapshot(snapshot: BrowserSessionSnapshot): Promise<void> {
    const saving = this.sessionStore.save(snapshot);
    this.lastSessionSnapshot = { scopeId: this.scopeId, snapshot };
    this.lastSessionSaveFailed = false;
    this.lastSessionSave = saving;
    // Se conserva el rechazo para la barrera, sin dejar una promesa huérfana.
    void saving.catch(() => { if (this.lastSessionSave === saving) this.lastSessionSaveFailed = true; });
    return saving;
  }

  private getWebContents(): WebContents | null {
    const tab = this.getActiveTab();
    if (!tab || tab.navigationSafety?.action === 'block') return null;
    const view = this.requireTabView(tab);
    return view.webContents.isDestroyed() ? null : view.webContents;
  }

  // La particion del navegador es compartida por todas sus pestañas, incluidas
  // la secundaria de la vista dividida y las ventanas separadas. Restringir los
  // permisos a la pestaña activa dejaba sin camara ni microfono a las demas,
  // aunque estuvieran visibles y en primer plano.
  private isBrowserContents(contents: WebContents | null): boolean {
    if (!contents || contents.isDestroyed()) return false;
    for (const tab of this.tabs.values()) {
      const candidate = tab.view?.webContents;
      if (candidate && !candidate.isDestroyed() && candidate === contents) return true;
    }
    // Las ventanas reales que abre un sitio comparten la particion pero no son
    // pestañas. Dejarlas fuera hacia que la gobernanza las tratara como
    // contenido ajeno y les negara camara y microfono sin preguntar: Google
    // Meet abre asi su ventana de llamada desde Gmail y no llegaba a arrancar.
    for (const window of this.pictureInPictureWindows) {
      if (!window.isDestroyed() && window.webContents === contents) return true;
    }
    return false;
  }

  private getActiveTab(): BrowserTabRuntime | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) ?? null;
  }

  private activateTabInternal(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) throw new Error('La pestaña indicada no existe.');
    this.activeTabId = tabId;
    tab.lastActivatedAt = Date.now();
    const detached = this.detachedWindows.get(tabId);
    if (!detached && this.viewMode === 'single') this.primaryTabId = tabId;
    else if (!detached && tabId !== this.primaryTabId && tabId !== this.secondaryTabId) this.primaryTabId = tabId;
    const view = this.materializeTab(tab, true);
    this.configureTabZoom(tab);
    if (detached && this.isWindowUsable(detached)) {
      if (detached.isMinimized()) detached.restore();
      detached.show();
      detached.focus();
    } else if (this.visible) view.webContents.focus();
    this.enforceLiveTabBudget();
  }

  /**
   * Solo aplica los cambios reales de bounds y visibilidad. Ocultar y volver a
   * mostrar la vista nativa (o reenviar los mismos bounds) obliga a la pagina a
   * descartar su cuadro compuesto y a reiniciar la carga diferida, que es lo
   * que hacia que sitios como YouTube tardaran en pintar paneles y listas.
   */
  /**
   * Pantalla completa de la pagina, con el mismo alcance que un navegador de
   * escritorio: la vista cubre la ventana anfitriona y la ventana pasa a
   * pantalla completa del sistema. Al salir se restaura el estado anterior,
   * incluido el caso de una ventana que ya estaba maximizada a pantalla
   * completa por decision del usuario.
   */
  private enterHtmlFullScreen(tabId: string): void {
    if (this.agentTaskBinding) return;
    const tab = this.tabs.get(tabId);
    if (!tab || this.fullscreenTabId === tabId) return;
    const host = this.getTabHost(tab);
    if (!host || host.isDestroyed()) return;
    this.fullscreenTabId = tabId;
    this.fullscreenRestore = { window: host, wasFullScreen: host.isFullScreen() };
    if (!host.isFullScreen()) host.setFullScreen(true);
    if (this.detachedWindows.has(tabId)) this.layoutDetachedTab(tabId);
    else this.applyViewLayout();
    this.emitState();
  }

  private leaveHtmlFullScreen(tabId: string): void {
    if (this.fullscreenTabId !== tabId) return;
    this.fullscreenTabId = null;
    const restore = this.fullscreenRestore;
    this.fullscreenRestore = null;
    if (restore && !restore.window.isDestroyed() && !restore.wasFullScreen && restore.window.isFullScreen()) {
      restore.window.setFullScreen(false);
    }
    // Los bounds memorizados corresponden a la pantalla completa; forzar el
    // recalculo evita que la vista se quede cubriendo la barra y el chat.
    const tab = this.tabs.get(tabId);
    if (tab) tab.appliedBounds = null;
    if (this.detachedWindows.has(tabId)) this.layoutDetachedTab(tabId);
    else this.applyViewLayout();
    this.emitState();
  }

  private applyFullScreenLayout(tab: BrowserTabRuntime): boolean {
    const host = this.getTabHost(tab);
    if (!host || host.isDestroyed()) return false;
    const view = this.materializeTab(tab, true);
    const bounds = host.getContentBounds();
    this.hideWorkspaceTabsExcept(tab.id);
    this.applyTabBounds(tab, view, { x: 0, y: 0, width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
    this.applyTabVisibility(tab, view, true);
    return true;
  }

  /**
   * Ventanas de Document Picture-in-Picture. Electron las crea con el aspecto
   * de una ventana de aplicacion; se les quita el menu y se dejan siempre
   * encima para que se comporten como el PiP de un navegador.
   */
  /**
   * Registra el error de red exacto de cada peticion que falla.
   *
   * La pestaña Network trunca el codigo y un fallo dentro de un service worker
   * solo llega a la pagina como "Failed to fetch", sin decir por que. Es
   * observacion pura: `onErrorOccurred` no puede alterar ni bloquear nada.
   */
  private observeFailedRequests(session: Session): void {
    session.webRequest.onErrorOccurred({ urls: ['<all_urls>'] }, (details) => {
      // Una navegacion reemplazada aborta por diseño y no es un fallo.
      if (details.error === 'net::ERR_ABORTED') return;
      // El tipo de recurso distingue una navegacion de una precarga
      // especulativa o de una peticion del service worker, que es lo que
      // decide donde mirar. La ruta se conserva sin query: los tokens de sesion
      // viajan ahi.
      let ruta = '(ruta ilegible)';
      try {
        const url = new URL(details.url);
        ruta = `${url.origin}${url.pathname}`;
      } catch { /* se conserva el marcador */ }
      console.warn(`[Navegador][Red] ${details.error} [${details.resourceType}] ${ruta}`);
    });

  }

  private configureRequestGovernance(session: Session): void {
    const scopeId = this.scopeId;
    const generation = this.sessionGeneration;
    if (this.privacyProtectionEnabled()) void this.privacyStore.hydrate().catch((error) => {
      console.warn('[Navegador][Privacidad] No se pudo cargar la configuración:', safeErrorMessage(error instanceof Error ? error.message : String(error)));
    });
    const filters = { urls: ['http://*/*', 'https://*/*'] };
    // Electron conserva un solo listener por fase. Unificar evita que privacidad
    // sustituya el bloqueo empresarial (o viceversa), incluso en subframes.
    const requestAllowed = (url: string) => !this.scopeChanging && this.scopeId === scopeId
      && this.sessionGeneration === generation && this.enterpriseUrlAllowed(url)
      && checkBrowserNavigationLocal(url).action !== 'block';
    session.webRequest.onBeforeRequest(filters, (details, callback) => {
      const contents = details.webContents;
      const frame = details.resourceType === 'mainFrame' ? 'main' : details.frame
        ? `frame:${details.frame.processId}:${details.frame.routingId}` : `request:${details.id}`;
      if (contents && (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame')) this.requestSafety.invalidate(contents, frame);
      if (!requestAllowed(details.url)) {
        if (!this.scopeChanging && this.scopeId === scopeId && this.sessionGeneration === generation
          && ['mainFrame', 'subFrame', 'other'].includes(details.resourceType)) {
          this.publishBlockedRequest(contents, details.url, this.localNavigationVerdict(details.url));
        }
        callback({ cancel: true }); return;
      }
      const proceed = () => {
        // `other` incluye descargas iniciadas sin navegar el documento.
        if (['mainFrame', 'subFrame', 'other'].includes(details.resourceType)) this.reviewNetworkRequest(details, frame, requestAllowed, callback);
        else callback({});
      };
      if (!this.privacyProtectionEnabled()) { proceed(); return; }
      const siteOrigin = privacyRequestOrigin(details);
      const state = this.effectivePrivacyState(this.privacyStore.peek(siteOrigin));
      const tracking = this.trackingEngine.evaluate(details.url);
      if (details.resourceType !== 'mainFrame' && tracking.blocked && privacyCategoryEnabled(state.level, state.exceptionCategories, tracking.category)) {
        void this.privacyStore.increment(siteOrigin, tracking.category).catch(() => undefined);
        callback({ cancel: true });
        return;
      }
      if (details.method === 'GET' && details.resourceType === 'mainFrame' && privacyCategoryEnabled(state.level, state.exceptionCategories, 'tracking-parameter')) {
        const stripped = stripTrackingParameters(details.url);
        if (stripped.removed.length > 0 && stripped.url !== details.url) {
          void this.privacyStore.increment(siteOrigin, 'tracking-parameter').catch(() => undefined);
          callback({ redirectURL: stripped.url });
          return;
        }
      }
      proceed();
    });
    session.webRequest.onBeforeSendHeaders(filters, (details, callback) => {
      if (!requestAllowed(details.url)) { callback({ cancel: true }); return; }
      if (!this.privacyProtectionEnabled()) { callback({ requestHeaders: details.requestHeaders }); return; }
      const siteOrigin = privacyRequestOrigin(details);
      const state = this.effectivePrivacyState(this.privacyStore.peek(siteOrigin));
      const headers: Record<string, string> = { ...details.requestHeaders };
      if (state.level !== 'off') { headers.DNT = '1'; headers['Sec-GPC'] = '1'; }
      if (state.level === 'strict' && privacyCategoryEnabled(state.level, state.exceptionCategories, 'fingerprinting')) {
        if (mitigateFingerprintingRequestHeaders(headers).length > 0) void this.privacyStore.increment(siteOrigin, 'fingerprinting').catch(() => undefined);
      }
      if (details.resourceType !== 'mainFrame' && isThirdPartyRequest(details.url, siteOrigin)
        && privacyCategoryEnabled(state.level, state.exceptionCategories, 'third-party-cookie')) {
        removeHeader(headers, 'cookie');
        if (state.level === 'strict') removeHeader(headers, 'referer');
        void this.privacyStore.increment(siteOrigin, 'third-party-cookie').catch(() => undefined);
      }
      callback({ requestHeaders: headers });
    });
    session.webRequest.onHeadersReceived(filters, (details, callback) => {
      if (!requestAllowed(details.url)) { callback({ cancel: true }); return; }
      const finish = (headers: Record<string, string[]>) => {
        const attachment = Object.entries(headers).some(([name, values]) => name.toLowerCase() === 'content-disposition' && values.some((value) => /^\s*attachment(?:\s*;|\s*$)/i.test(value)))
          || Object.entries(headers).some(([name, values]) => name.toLowerCase() === 'content-type' && values.some((value) => /^\s*application\/octet-stream(?:\s*;|\s*$)/i.test(value)));
        if (attachment) this.reviewNetworkRequest(details, `download:${details.id}`, requestAllowed, (result) => callback(result.cancel ? { cancel: true } : { responseHeaders: headers }));
        else callback({ responseHeaders: headers });
      };
      if (!this.privacyProtectionEnabled()) { finish(details.responseHeaders ?? {}); return; }
      const siteOrigin = privacyRequestOrigin(details);
      const state = this.effectivePrivacyState(this.privacyStore.peek(siteOrigin));
      const headers = { ...(details.responseHeaders ?? {}) };
      if (state.level === 'strict' && privacyCategoryEnabled(state.level, state.exceptionCategories, 'fingerprinting')) {
        mitigateFingerprintingResponseHeaders(headers);
      }
      if (details.resourceType !== 'mainFrame' && isThirdPartyRequest(details.url, siteOrigin)
        && privacyCategoryEnabled(state.level, state.exceptionCategories, 'third-party-cookie')) {
        removeHeader(headers, 'set-cookie');
      }
      finish(headers);
    });
  }

  private reviewNetworkRequest(details: { url: string; webContents?: WebContents; resourceType: string }, frame: string,
    allowed: (url: string) => boolean, callback: (result: { cancel?: boolean }) => void): void {
    let completed = false;
    const finish = (result: { cancel?: boolean }) => { if (!completed) { completed = true; callback(result); } };
    const contents = details.webContents;
    if (!contents || !this.isBrowserContents(contents) || !canCheckBrowserNavigationRemotely(details.url, { allowRemote: this.profileKind === 'authenticated' })) { finish({}); return; }
    const parent = this.parentWindow;
    const previousUrl = contents.getURL();
    const tab = Array.from(this.tabs.values()).find((value) => value.view?.webContents === contents);
    const visualRevision = tab?.visualRevision;
    const current = () => allowed(details.url) && this.parentWindow === parent && !!parent && !parent.isDestroyed()
      && !contents.isDestroyed() && this.isBrowserContents(contents) && contents.getURL() === previousUrl
      && (!tab || (tab.view?.webContents === contents && tab.visualRevision === visualRevision));
    void this.requestSafety.review(details.url, contents, frame, current).then((verdict) => {
      if (!verdict || !current()) { finish({ cancel: true }); return; }
      if (tab && (frame === 'main' || verdict.action === 'block' || (verdict.source === 'degraded' && tab.navigationSafety?.action !== 'block'))) {
        this.setNavigationSafety(tab, frame === 'main' ? details.url : previousUrl, verdict);
        this.emitState();
      }
      if (!tab && verdict.action === 'block') {
        const popup = Array.from(this.pictureInPictureWindows).find((window) => window.webContents === contents);
        if (popup) this.showPopupSafetyInterstitial(popup, verdict);
      }
      finish({ cancel: verdict.action === 'block' });
    }).catch(() => finish({ cancel: true }));
  }

  private publishBlockedRequest(contents: WebContents | undefined, target: string, verdict: BrowserNavigationSafetyVerdict): void {
    if (!contents || contents.isDestroyed() || !this.isBrowserContents(contents) || verdict.action !== 'block') return;
    const tab = Array.from(this.tabs.values()).find((value) => value.view?.webContents === contents);
    if (tab) { this.setNavigationSafety(tab, target, verdict); this.emitState(); return; }
    const popup = Array.from(this.pictureInPictureWindows).find((window) => window.webContents === contents);
    if (popup) this.showPopupSafetyInterstitial(popup, verdict);
  }

  /**
   * Mantiene la política de certificados de Chromium: sólo se acepta la
   * verificación que el sistema marcó como `OK`. No hay excepciones silenciosas
   * ni bypass desde el renderer; un certificado inválido termina la carga y
   * queda visible como error de navegación.
   */
  private configureCertificateVerification(session: Session): void {
    if (this.certificateSessions.has(session)) return;
    const setCertificateVerifyProc = (session as Session & {
      setCertificateVerifyProc?: (callback: (request: { verificationResult?: string }, callback: (result: number) => void) => void) => void;
    }).setCertificateVerifyProc;
    if (typeof setCertificateVerifyProc !== 'function') return;
    this.certificateSessions.add(session);
    setCertificateVerifyProc.call(session, (request, callback) => {
      const valid = request?.verificationResult === 'OK';
      if (!valid) console.warn('[Navegador][Certificado] Se rechazó un certificado no válido.');
      // -3 conserva la verificación de Chromium; 0 desactivaría Certificate Transparency.
      callback(browserCertificateDecision(request?.verificationResult));
    });
  }

  private privacyProtectionEnabled(): boolean {
    return this.capabilities.privacyProtection || Boolean(this.enterprisePolicy?.forcedPrivacyLevel);
  }

  private effectivePrivacyState<T extends { level: BrowserPrivacyLevel }>(state: T): T {
    const forced = this.enterprisePolicy?.forcedPrivacyLevel;
    if (!forced) return state;
    return { ...state, level: state.level === 'strict' || forced === 'strict' ? 'strict' : 'balanced', exceptionCategories: [] };
  }

  private prepareBrowserPopupWindow(window: BrowserWindow, openerOrigin: string | null): void {
    if (window.isDestroyed()) return;
    // La ventana real no hereda necesariamente el User-Agent normalizado del
    // abridor. Prepararla antes de devolver su webContents mantiene la misma
    // identidad Chromium desde su primera consulta.
    normalizeBrowserUserAgent(window.webContents);
    if (openerOrigin) {
      const contentsId = window.webContents.id;
      this.governedWindowOrigins.set(contentsId, openerOrigin);
      window.once('closed', () => this.governedWindowOrigins.delete(contentsId));
    }
    // Una ventana real puede abrir otras ventanas. La politica se hereda para
    // que ninguna quede fuera del navegador o sin origen gobernado.
    this.governePopupOpenings(window.webContents, openerOrigin);
    this.adoptPictureInPictureWindow(window, openerOrigin);
  }

  /**
   * Aplica a un `webContents` la misma politica de apertura de ventanas que a
   * una pestaña, conservando el origen heredado a lo largo de la cadena.
   */
  private governePopupOpenings(contents: WebContents, inheritedOrigin: string | null): void {
    contents.setWindowOpenHandler((details) => {
      const openerOrigin = this.governedOriginFor(contents) ?? inheritedOrigin;
      if (isBlockedGoogleChatDirectCall(openerOrigin, details.url)) {
        console.warn('[Navegador][Seguridad] Llamada directa automática de Google Chat bloqueada.');
        return { action: 'deny' };
      }
      if (isBlankPopupTarget(details.url)) {
        console.info('[Navegador][Ventana] Popup anidado gobernado permitido como ventana real.');
        const popupOptions = buildPopupWindowOptions(details);
        return {
          action: 'allow',
          createWindow: (options: BrowserWindowConstructorOptions) => {
            const popup = new BrowserWindow({ ...options, ...popupOptions });
            this.prepareBrowserPopupWindow(popup, openerOrigin);
            return popup.webContents;
          },
        };
      }
      if (isAllowedBrowserUrl(details.url) && this.enterpriseUrlAllowed(details.url)) {
        void this.createTab(details.url, true).catch((error) => this.recordError(error));
      } else this.recordError(new Error('El sitio intento abrir un protocolo no permitido.'));
      return { action: 'deny' };
    });
  }

  /**
   * Origen heredado de una ventana real adoptada. Es el del abridor: un
   * documento `about:blank` no tiene origen propio con el que decidir permisos.
   */
  governedOriginFor(contents: WebContents | null | undefined): string | null {
    if (!contents || contents.isDestroyed()) return null;
    return this.governedWindowOrigins.get(contents.id) ?? null;
  }

  private adoptPictureInPictureWindow(window: BrowserWindow, openerOrigin: string | null): void {
    if (window.isDestroyed()) return;
    this.pictureInPictureWindows.add(window);
    // `setMenu` solo existe en Windows y Linux; en macOS el menu es de
    // aplicacion y llamarlo aqui lanzaria.
    if (process.platform !== 'darwin') window.setMenu(null);
    // Solo el Picture-in-Picture se queda encima. Una ventana grande es un
    // popup ordinario (inicio de sesion, transferencia de una llamada) y
    // dejarla flotando sobre todo lo demas estorba al usuario.
    const [width] = window.getSize();
    if (width <= POPUP_ALWAYS_ON_TOP_MAX_WIDTH) window.setAlwaysOnTop(true, 'floating');
    const popupKey = `popup:${window.webContents.id}`;
    window.once('closed', () => { this.pictureInPictureWindows.delete(window); this.safetyInterstitials.remove(popupKey); });
    window.webContents.on('certificate-error', (_event, _url, _error, _certificate, callback) => {
      callback(false);
      if (!window.isDestroyed() && this.pictureInPictureWindows.has(window)) this.showPopupSafetyInterstitial(window, this.certificateBlockVerdict());
    });
    const guardPopupNavigation = (event: { url: string; preventDefault: () => void }) => {
      if (isBlockedGoogleChatDirectCall(openerOrigin, event.url)) {
        event.preventDefault();
        console.warn('[Navegador][Seguridad] Llamada directa automática de Google Chat bloqueada.');
        if (!window.isDestroyed()) window.close();
        return;
      }
      if (isAllowedBrowserUrl(event.url) && this.enterpriseUrlAllowed(event.url) && checkBrowserNavigationLocal(event.url).action !== 'block') return;
      event.preventDefault();
      this.showPopupSafetyInterstitial(window, { ...checkBrowserNavigationLocal(event.url), action: 'block', reason: 'La solicitud no cumple la política de navegación.' });
    };
    window.webContents.on('will-navigate', guardPopupNavigation);
    window.webContents.on('will-redirect', guardPopupNavigation);
    window.webContents.on('will-frame-navigate', guardPopupNavigation);
  }

  private showPopupSafetyInterstitial(window: BrowserWindow, verdict: BrowserNavigationSafetyVerdict): void {
    if (window.isDestroyed()) return;
    const key = `popup:${window.webContents.id}`;
    const bounds = window.getContentBounds();
    this.safetyInterstitials.show(key, { parent: window, fillWindow: true, bounds: { x: 0, y: 0, width: bounds.width, height: bounds.height }, verdict,
      isCurrent: () => !window.isDestroyed() && this.pictureInPictureWindows.has(window),
      openBlank: async () => { await window.webContents.loadURL('about:blank'); this.safetyInterstitials.remove(key); },
      close: () => window.close(),
    });
  }

  private closePictureInPictureWindows(): void {
    for (const window of this.pictureInPictureWindows) {
      if (!window.isDestroyed()) window.close();
    }
    this.pictureInPictureWindows.clear();
  }

  private applyViewLayout(): void {
    const fullscreenTab = this.fullscreenTabId ? this.tabs.get(this.fullscreenTabId) : null;
    if (fullscreenTab && !this.detachedWindows.has(fullscreenTab.id) && this.visible) {
      if (this.applyFullScreenLayout(fullscreenTab)) {
        this.enforceLiveTabBudget();
        return;
      }
      this.fullscreenTabId = null;
      this.fullscreenRestore = null;
    }
    if (!this.visible || !this.viewport) {
      this.hideWorkspaceTabsExcept();
      return;
    }
    const requestedPrimaryId = this.primaryTabId ?? this.activeTabId;
    const primaryId = requestedPrimaryId && !this.detachedWindows.has(requestedPrimaryId)
      ? requestedPrimaryId
      : Array.from(this.tabs.values()).find((tab) => !this.detachedWindows.has(tab.id))?.id ?? null;
    this.primaryTabId = primaryId;
    const primary = primaryId ? this.tabs.get(primaryId) : null;
    if (!primary) {
      this.hideWorkspaceTabsExcept();
      return;
    }

    let secondary = this.viewMode === 'single' || !this.secondaryTabId ? null : this.tabs.get(this.secondaryTabId) ?? null;
    if (secondary && (secondary.id === primary.id || this.detachedWindows.has(secondary.id))) secondary = null;
    if (this.viewMode !== 'single' && !secondary) {
      this.viewMode = 'single';
      this.secondaryTabId = null;
    }
    this.hideWorkspaceTabsExcept(primary.id, secondary?.id);

    const primaryView = this.materializeTab(primary, true);
    if (!secondary) {
      this.applyTabBounds(primary, primaryView, this.viewport);
      this.applyTabVisibility(primary, primaryView, true);
      this.enforceLiveTabBudget();
      return;
    }

    const secondaryView = this.materializeTab(secondary, true);
    if (this.viewMode === 'split') {
      const gap = 6;
      const primaryWidth = Math.floor((this.viewport.width - gap) / 2);
      this.applyTabBounds(primary, primaryView, { ...this.viewport, width: primaryWidth });
      this.applyTabBounds(secondary, secondaryView, {
        x: this.viewport.x + primaryWidth + gap,
        y: this.viewport.y,
        width: this.viewport.width - primaryWidth - gap,
        height: this.viewport.height,
      });
    } else {
      const margin = 12;
      const defaultWidth = Math.min(Math.max(360, Math.round(this.viewport.width * 0.40)), Math.max(200, this.viewport.width - margin * 2));
      const defaultHeight = Math.max(200, this.viewport.height - margin * 2);
      const defaultX = this.viewport.width - defaultWidth - margin;
      const defaultY = margin;

      const eff = this.customOverlayBounds ?? { x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight };

      this.applyTabBounds(primary, primaryView, this.viewport);
      this.applyTabBounds(secondary, secondaryView, {
        x: this.viewport.x + eff.x,
        y: this.viewport.y + eff.y + 32,
        width: Math.max(160, eff.width),
        height: Math.max(100, eff.height - 32),
      });
      if (this.overlayTopTabId !== secondary.id) {
        try {
          this.parentWindow?.contentView.removeChildView(secondaryView);
          this.parentWindow?.contentView.addChildView(secondaryView);
          this.overlayTopTabId = secondary.id;
        } catch {
          this.overlayTopTabId = null;
        }
      }
    }
    this.applyTabVisibility(primary, primaryView, true);
    this.applyTabVisibility(secondary, secondaryView, true);
    this.enforceLiveTabBudget();
  }

  private hideWorkspaceTabsExcept(...visibleTabIds: Array<string | undefined>): void {
    const keep = new Set(visibleTabIds.filter((id): id is string => typeof id === 'string'));
    for (const tab of this.tabs.values()) {
      if (this.detachedWindows.has(tab.id) || keep.has(tab.id) || !tab.view) continue;
      this.applyTabVisibility(tab, tab.view, false);
    }
  }

  private applyTabVisibility(tab: BrowserTabRuntime, view: WebContentsView, visible: boolean): void {
    if (tab.appliedVisible === visible) { this.updateTabSafetyInterstitial(tab); return; }
    tab.appliedVisible = visible;
    view.setVisible(visible && tab.navigationSafety?.action !== 'block');
    this.updateTabSafetyInterstitial(tab);
  }

  private applyTabBounds(tab: BrowserTabRuntime, view: WebContentsView, bounds: Rectangle): void {
    const applied = tab.appliedBounds;
    if (applied && applied.x === bounds.x && applied.y === bounds.y && applied.width === bounds.width && applied.height === bounds.height) {
      return;
    }
    tab.appliedBounds = { ...bounds };
    view.setBounds(bounds);
    this.configureTabZoom(tab);
    this.updateTabSafetyInterstitial(tab);
  }

  private toTabState(tab: BrowserTabRuntime): IntegratedBrowserTabState {
    this.snapshotTab(tab);
    return {
      id: tab.id,
      url: tab.url || 'about:blank',
      title: tab.title || 'Nueva pestaña',
      isLoading: tab.loading,
      error: tab.error,
      navigationSafety: tab.navigationSafety ? { ...tab.navigationSafety } : null,
      sensitiveHandoff: tab.view && this.sensitiveDocuments.has(tab.view.webContents) ? { reason: this.sensitiveDocuments.get(tab.view.webContents)! } : null,
      isSuspended: tab.view === null,
      isDetached: this.detachedWindows.has(tab.id),
      muted: tab.muted,
      zoomFactor: tab.zoomFactor,
      find: tab.find ? { ...tab.find } : null,
      pinned: tab.pinned,
      groupId: tab.groupId,
      position: Array.from(this.tabs.keys()).indexOf(tab.id),
    };
  }

  private toSessionTab(tab: BrowserTabRuntime, position: number): BrowserSessionTab {
    return { id: tab.id, url: tab.url, title: tab.title, pinned: tab.pinned, muted: tab.muted, groupId: tab.groupId, position };
  }

  private moveTabToIndex(tabId: string, rawPosition: number): void {
    const entries = Array.from(this.tabs.entries());
    const current = entries.findIndex(([id]) => id === tabId);
    if (current < 0) return;
    const [entry] = entries.splice(current, 1);
    entries.splice(Math.max(0, Math.min(entries.length, rawPosition)), 0, entry);
    this.tabs = new Map(entries);
  }

  /**
   * Instala el arranque del mundo del agente por CDP. Nunca puede impedir que
   * la pestana nazca: si la sesion no esta disponible —lo normal con DevTools
   * abierto— el navegador sigue funcionando con la inyeccion por carga de
   * siempre, y al cerrar DevTools se reintenta.
   */
  private installAgentBootstrap(tab: BrowserTabRuntime): void {
    const contents = tab.view?.webContents;
    if (!contents || tab.bootstrap) return;
    const bootstrap = new IntegratedBrowserBootstrap(contents, {
      onMessage: (mensaje) => {
        if (mensaje.type !== 'documento-listo') return;
        // Llega antes que el script del sitio y en cada marco, incluidos los
        // que `did-finish-load` nunca reporta por separado.
        selectionLog(`mundo del agente listo en ${mensaje.url || 'un marco'}`);
      },
      onDegraded: (motivo) => selectionLog(`arranque por CDP no disponible: ${safeErrorMessage(motivo)}`),
      onRestored: () => selectionLog('arranque por CDP instalado en cada documento'),
    });
    tab.bootstrap = bootstrap;
    // DevTools exige ser el unico cliente del protocolo. No se le disputa la
    // sesion: se cede al abrirlo y se recupera cuando el usuario lo cierra.
    contents.on('devtools-closed', () => {
      void bootstrap.install();
      if (this.credentialAutosaveEnabled) void tab.credentialObserver?.install();
    });
    // Diferido a la siguiente vuelta del bucle, no a una microtarea: adjuntar
    // el depurador durante la construccion de la vista se entrelazaba con la
    // negociacion de permisos de la pagina y con su navegacion inicial.
    const pendiente = setImmediate(() => {
      if (tab.bootstrap !== bootstrap || contents.isDestroyed()) return;
      void bootstrap.install();
    });
    pendiente.unref?.();
  }

  private destroyTab(tab: BrowserTabRuntime): void {
    this.safetyInterstitials.remove(`tab:${tab.id}`);
    this.invalidateObservation(tab.id);
    void tab.credentialObserver?.dispose();
    tab.credentialObserver = null;
    void tab.bootstrap?.dispose();
    tab.bootstrap = null;
    const view = tab.view;
    tab.view = null;
    if (!view) return;
    const detached = this.detachedWindows.get(tab.id);
    if (detached) {
      this.detachedWindows.delete(tab.id);
      try { detached.contentView.removeChildView(view); } catch { /* cierre idempotente */ }
      try { if (!detached.isDestroyed()) detached.destroy(); } catch { /* cierre idempotente */ }
    }
    try { view.setVisible(false); } catch { /* cierre idempotente */ }
    try { this.parentWindow?.contentView.removeChildView(view); } catch { /* cierre idempotente */ }
    try {
      if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
    } catch { /* cierre idempotente */ }
  }

  private snapshotTab(tab: BrowserTabRuntime): void {
    const contents = tab.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    tab.url = contents.getURL() || tab.url || 'about:blank';
    tab.title = contents.getTitle() || tab.title || 'Nueva pestaña';
    if (supportsIsolatedBrowserZoom(contents)) tab.zoomFactor = contents.getZoomFactor();
    tab.canGoBack = contents.navigationHistory.canGoBack();
    tab.canGoForward = contents.navigationHistory.canGoForward();
  }

  private requireTabView(tab: BrowserTabRuntime): WebContentsView {
    return this.materializeTab(tab, true);
  }

  private enforceLiveTabBudget(): void {
    const liveTabs = Array.from(this.tabs.values()).filter((tab) => tab.view && !tab.view.webContents.isDestroyed());
    if (liveTabs.length <= INTEGRATED_BROWSER_MAX_LIVE_TABS) return;
    const protectedIds = new Set([
      this.activeTabId,
      this.primaryTabId,
      this.viewMode === 'single' ? null : this.secondaryTabId,
      ...this.detachedWindows.keys(),
    ]);
    const candidates = liveTabs
      .filter((tab) => !protectedIds.has(tab.id))
      .sort((left, right) => left.lastActivatedAt - right.lastActivatedAt);
    while (liveTabs.filter((tab) => tab.view !== null).length > INTEGRATED_BROWSER_MAX_LIVE_TABS) {
      const candidate = candidates.shift();
      if (!candidate) break;
      this.snapshotTab(candidate);
      this.destroyTab(candidate);
      candidate.loading = false;
    }
  }

  private layoutDetachedTab(tabId: string): void {
    const detached = this.detachedWindows.get(tabId);
    const tab = this.tabs.get(tabId);
    if (!detached || detached.isDestroyed() || !tab?.view || tab.view.webContents.isDestroyed()) return;
    const bounds = detached.getContentBounds();
    this.applyTabBounds(tab, tab.view, {
      x: 0,
      y: 0,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    });
    this.applyTabVisibility(tab, tab.view, true);
  }

  private isWindowUsable(window: BaseWindow | BrowserWindow): boolean {
    return !window.isDestroyed() && window.isVisible() && !window.isMinimized();
  }

  private isTabVisible(tab: BrowserTabRuntime): boolean {
    const detached = this.detachedWindows.get(tab.id);
    if (detached) return this.isWindowUsable(detached);
    if (!this.visible || !this.viewport) return false;
    return tab.id === this.primaryTabId || (this.viewMode !== 'single' && tab.id === this.secondaryTabId);
  }

  private getTabHost(tab: BrowserTabRuntime): BaseWindow | BrowserWindow | null {
    return this.detachedWindows.get(tab.id) ?? this.parentWindow;
  }

  private requireTabId(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 80) {
      throw new Error('El identificador de pestaña es inválido.');
    }
    if (!this.tabs.has(value)) throw new Error('La pestaña indicada no existe.');
    return value;
  }

  private parseViewMode(value: unknown): IntegratedBrowserViewMode {
    if (value === 'single' || value === 'split' || value === 'overlay') return value;
    throw new Error('El modo de vista del navegador es inválido.');
  }

  private requireParentWindow(): BrowserWindow {
    if (this.scopeChanging) throw new Error('El perfil está cambiando; espera antes de usar el navegador.');
    if (this.ephemeralCleanupPending || this.ephemeralCleanupFailed || this.shutdownCommitted) {
      throw new Error('El perfil temporal no está disponible durante el cierre o la limpieza.');
    }
    if (!this.parentWindow || this.parentWindow.isDestroyed()) {
      throw new Error('La ventana principal no esta disponible para mostrar el navegador.');
    }
    return this.parentWindow;
  }

  private waitForViewport(timeoutMs: number, signal?: AbortSignal): Promise<void> {
    assertCuNotAborted(signal);
    return new Promise((resolve, reject) => {
      const waiter = {} as ViewportWaiter;
      const abort = () => waiter.reject(new Error('Tarea cancelada.'));
      const cleanup = () => {
        clearTimeout(waiter.timer);
        signal?.removeEventListener('abort', abort);
        this.viewportWaiters.delete(waiter);
      };
      waiter.resolve = () => { cleanup(); resolve(); };
      waiter.reject = error => { cleanup(); reject(error); };
      waiter.timer = setTimeout(() => waiter.reject(new Error('El navegador integrado no recibio un viewport visible a tiempo.')), timeoutMs);
      this.viewportWaiters.add(waiter);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }

  private resolveViewportWaiters(): void {
    for (const waiter of this.viewportWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
    this.viewportWaiters.clear();
  }

  private rejectViewportWaiters(error: Error): void {
    for (const waiter of this.viewportWaiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.viewportWaiters.clear();
  }

  private startObservationTimer(): void {
    if (!this.observationEnabled || this.observationTimer) return;
    const active = this.getActiveTab();
    this.schedulePassiveCapture(passiveObservationIntervalMs(active?.view?.webContents.getURL() ?? active?.url ?? ''));
  }

  private stopObservationTimer(): void {
    this.observationTimerGeneration += 1;
    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
      this.observationTimer = null;
    }
  }

  private schedulePassiveCapture(delayMs: number): void {
    if (!this.observationEnabled || !this.parentWindow) return;
    if (this.observationTimer) clearTimeout(this.observationTimer);
    const generation = ++this.observationTimerGeneration;
    this.observationTimer = setTimeout(() => {
      if (generation !== this.observationTimerGeneration) return;
      this.observationTimer = null;
      void this.refreshVisualCapture().finally(() => {
        if (
          generation !== this.observationTimerGeneration
          || !this.observationEnabled
          || !this.parentWindow
        ) {
          return;
        }
        // Si la ventana de calma sigue abierta (el usuario acaba de interactuar)
        // se reintenta al cerrarla, no al siguiente intervalo completo.
        const active = this.getActiveTab();
        const remainingCalm = active ? active.passiveCaptureNotBefore - Date.now() : 0;
        const activeUrl = active?.view?.webContents.getURL() ?? active?.url ?? '';
        this.schedulePassiveCapture(remainingCalm > 0 ? remainingCalm : passiveObservationIntervalMs(activeUrl));
      });
    }, Math.max(0, delayMs));
    this.observationTimer.unref?.();
  }

  /**
   * Una rafaga de entrada (rueda, teclado) llegaba a reprogramar el temporizador
   * decenas de veces por segundo. Extender la ventana de calma es barato;
   * reconstruir el temporizador en cada evento no lo es.
   */
  /**
   * Espera a que la seleccion se asiente antes de leerla: arrastrar el raton
   * emite muchos eventos y solo interesa el resultado final.
   */
  /** Espera antes de leer la seleccion; evita releer en cada arrastre. */
  private selectionProbeTimer: NodeJS.Timeout | null = null;
  private lastReportedSelection = '';

  /**
   * Instala en cada marco un vigia que avisa por consola cuando cambia la
   * seleccion, y el menu flotante que ofrece las acciones de SofLIA junto al
   * texto marcado. El aviso viaja por `console-message`, que el proceso
   * principal siempre recibe, sin necesidad de preload ni de un canal IPC
   * nuevo.
   */
  private async installSelectionWatcher(contents: WebContents): Promise<void> {
    for (const marco of collectSelectableFrames(contents)) {
      await marco.executeJavaScript(SELECTION_WATCHER_SCRIPT, true).catch((error: unknown) => {
        selectionLog(`vigia no instalado en un marco: ${error instanceof Error ? error.message : String(error)}`);
      });
      await installBrowserSelectionMenu(marco).catch((error: unknown) => {
        selectionLog(`menu flotante no instalado en un marco: ${error instanceof Error ? error.message : String(error)}`);
      });
      await installBrowserWritingPanel(marco).catch((error: unknown) => {
        selectionLog(`panel de redaccion no instalado en un marco: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
    if (this.agentControlling) this.setSelectionMenuEnabled(false);
  }

  /**
   * Recoge la peticion que dejo el panel de redaccion. Es una lectura por
   * marco: el aviso de consola no dice cual la origino y el texto nunca viaja
   * por la consola.
   */
  private async collectWritingRequest(tab: BrowserTabRuntime): Promise<void> {
    if (this.agentControlling) return;
    const contents = tab.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    for (const marco of collectSelectableFrames(contents)) {
      const solicitud = await takeBrowserWritingRequest(marco).catch(() => null);
      if (!solicitud) continue;
      selectionLog(`redaccion pedida desde el panel (${solicitud.text.length} chars, instruccion ${solicitud.prompt.length ? 'propia' : 'vacia'})`);
      this.sendToRenderer('integrated-browser:writing-request', {
        requestId: solicitud.requestId,
        prompt: solicitud.prompt,
        text: solicitud.text,
        title: tab.title,
        url: contents.getURL(),
      });
      return;
    }
    selectionLog('aviso de redaccion sin peticion pendiente');
  }

  /**
   * Entrega al panel lo que respondio el modelo. Se reparte por todos los
   * marcos porque el panel vive en el que tenia la seleccion y una espera de
   * red pudo cambiar el arbol; el que no reconoce el identificador lo ignora.
   */
  async resolveWritingRequest(result: BrowserWritingResult): Promise<{ delivered: boolean }> {
    const tab = this.getActiveTab();
    const contents = tab?.view?.webContents;
    if (!contents || contents.isDestroyed()) return { delivered: false };
    let delivered = false;
    for (const marco of collectSelectableFrames(contents)) {
      const entregado = await deliverBrowserWritingResult(marco, result).catch(() => false);
      delivered = delivered || entregado;
    }
    selectionLog(`respuesta de redaccion ${delivered ? 'entregada' : 'sin panel que la reciba'}`);
    return { delivered };
  }

  /**
   * El menu solo tiene sentido cuando quien selecciona es una persona. Mientras
   * el agente conduce el navegador se apaga: sus clics sintetizados no son una
   * peticion y la burbuja ensuciaria las capturas de percepcion.
   */
  private setSelectionMenuEnabled(enabled: boolean): void {
    const tab = this.getActiveTab();
    const contents = tab?.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    for (const marco of collectSelectableFrames(contents)) {
      void setBrowserSelectionMenuEnabled(marco, enabled).catch(() => undefined);
      // Un panel abierto mientras el agente conduce estorbaria a sus capturas y
      // escribiria sobre un campo que ya no controla el usuario.
      if (!enabled) void closeBrowserWritingPanel(marco).catch(() => undefined);
    }
  }

  /**
   * Atiende una accion del menu flotante. El texto seleccionado sigue siendo
   * contenido no confiable: viaja al compositor junto a su instruccion y es el
   * usuario quien decide que pedir y cuando enviarlo. Ninguna accion manda el
   * turno por su cuenta.
   */
  private async runSelectionMenuAction(tab: BrowserTabRuntime, action: BrowserSelectionMenuAction): Promise<void> {
    if (this.agentControlling) {
      selectionLog(`accion ${action} ignorada: el agente controla el navegador`);
      return;
    }
    const contents = tab.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    const limite = action === 'read' ? MAX_READING_SELECTION_CHARS : MAX_SELECTION_CHARS;
    const texto = await this.readSelectionText(contents, limite);
    if (!texto) {
      selectionLog(`accion ${action} sin seleccion viva`);
      return;
    }
    if (action === 'read') {
      selectionLog(`modo lectura pedido desde el menu flotante (${texto.length} chars)`);
      this.sendToRenderer('integrated-browser:reading-mode-requested', {
        url: contents.getURL(),
        title: tab.title,
        selection: texto,
      });
      return;
    }
    // El adjunto ya viajo solo al chat al asentarse la seleccion; aqui se
    // reenvia con la instruccion elegida y se anota para que el sondeo
    // posterior no lo pise con un adjunto sin instruccion.
    this.lastReportedSelection = texto;
    selectionLog(`accion ${action} enviada al chat (${texto.length} chars)`);
    this.sendToRenderer('integrated-browser:selection-action', {
      action,
      text: texto,
      title: tab.title,
      instruction: buildSelectionInstruction(action),
    });
  }

  private deferSelectionProbe(tab: BrowserTabRuntime): void {
    // Los clics que sintetiza el agente no son una seleccion del usuario.
    if (this.agentControlling) {
      selectionLog('sondeo omitido: el agente controla el navegador');
      return;
    }
    if (this.selectionProbeTimer) clearTimeout(this.selectionProbeTimer);
    this.selectionProbeTimer = setTimeout(() => {
      this.selectionProbeTimer = null;
      void this.reportSelection(tab);
    }, SELECTION_PROBE_DELAY_MS);
  }

  /**
   * Adjunta al chat la seleccion viva de la pagina. Nunca la retira sola: si
   * el usuario pasa al chat a escribir, el fragmento debe seguir a la vista;
   * quitarlo es decision suya desde el chip.
   */
  private async reportSelection(tab: BrowserTabRuntime): Promise<void> {
    const contents = tab.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    const texto = await this.readSelectionText(contents);
    // Al deshacer la seleccion se avisa al chat para que retire el chip, y se
    // olvida la ultima leida para poder volver a adjuntar el mismo fragmento.
    if (!texto) {
      if (!this.lastReportedSelection) return;
      this.lastReportedSelection = '';
      selectionLog('seleccion deshecha: se retira el adjunto');
      this.sendToRenderer('integrated-browser:selection-action', {
        action: 'ask',
        text: '',
        title: tab.title,
        instruction: '',
      });
      return;
    }
    if (texto === this.lastReportedSelection) return;
    this.lastReportedSelection = texto;
    selectionLog(`seleccion enviada al chat (${texto.length} chars)`);
    this.sendToRenderer('integrated-browser:selection-action', {
      action: 'ask',
      text: texto,
      title: tab.title,
      instruction: '',
    });
  }

  /**
   * Lee la seleccion recorriendo tambien los iframes: en Gmail, Docs o
   * cualquier app compuesta, el texto marcado casi nunca vive en el documento
   * principal. Devuelve la primera seleccion no vacia que encuentre.
   */
  private async readSelectionText(contents: WebContents, limit = MAX_SELECTION_CHARS): Promise<string> {
    const marcos = collectSelectableFrames(contents);
    let fallos = 0;
    for (const marco of marcos) {
      const crudo = await marco.executeJavaScript('(() => { const s = window.getSelection(); return s ? String(s) : ""; })()', true).catch((error: unknown) => {
        fallos += 1;
        selectionLog(`marco ilegible: ${error instanceof Error ? error.message : String(error)}`);
        return '';
      });
      const texto = typeof crudo === 'string' ? crudo.trim() : '';
      if (texto) {
        selectionLog(`seleccion leida (${texto.length} chars) en ${marcos.length} marco(s)`);
        return texto.slice(0, limit);
      }
    }
    selectionLog(`sin seleccion en ${marcos.length} marco(s), ${fallos} ilegible(s)`);
    return '';
  }

  private deferPassiveCapture(tab: BrowserTabRuntime): void {
    const now = Date.now();
    const currentUrl = tab.view?.webContents.getURL() ?? tab.url;
    const idleMs = passiveObservationIdleMs(currentUrl);
    tab.passiveCaptureNotBefore = now + idleMs;
    if (now - tab.lastDeferAt < INTEGRATED_BROWSER_DEFER_THROTTLE_MS) return;
    tab.lastDeferAt = now;
    tab.visualRevision += 1;
    if (this.latestObservation?.tabId === tab.id) this.latestObservation = null;
    this.schedulePassiveCapture(idleMs);
  }

  private invalidateObservation(tabId?: string): void {
    if (!tabId || this.latestObservation?.tabId === tabId) this.latestObservation = null;
    if (!tabId || this.latestVisualCapture?.tabId === tabId) this.latestVisualCapture = null;
  }

  private async refreshVisualCapture(force = false, authorization?: () => void): Promise<BrowserVisualCapture | null> {
    if (!this.observationEnabled) return null;
    const tab = this.getActiveTab();
    if (!tab || !this.isTabVisible(tab) || !tab.view || tab.view.webContents.isDestroyed()) return null;
    const authorizedUrl = tab.view.webContents.getURL();
    if (!authorization && !await this.canAgentAccessWithoutPrompt(authorizedUrl, 'capture')) {
      this.latestVisualCapture = null;
      return null;
    }
    try { await this.assertDocumentNotSensitive(tab.id); } catch { this.invalidateObservation(tab.id); return null; }
    authorization?.();
    if (this.getActiveTab() !== tab || tab.view.webContents.isDestroyed() || tab.view.webContents.getURL() !== authorizedUrl) return null;
    const host = this.getTabHost(tab);
    if (!host || !this.isWindowUsable(host)) {
      return Promise.resolve(this.compatibleLatestVisualCapture(tab.id, tab.view.webContents.getURL(), tab.visualRevision));
    }
    if (!force && !host.isFocused()) {
      return Promise.resolve(this.compatibleLatestVisualCapture(tab.id, tab.view.webContents.getURL(), tab.visualRevision));
    }
    if (tab.loading && !force) return Promise.resolve(this.compatibleLatestVisualCapture(tab.id, tab.view.webContents.getURL(), tab.visualRevision));
    const tabId = tab.id;
    const contents = tab.view.webContents;
    const startedUrl = contents.getURL();
    const startedRevision = tab.visualRevision;
    const intervalMs = passiveObservationIntervalMs(startedUrl);
    const compatibleLatest = this.compatibleLatestVisualCapture(tabId, startedUrl, startedRevision);
    if (!force) {
      if (this.agentControlling || Date.now() < tab.passiveCaptureNotBefore) return Promise.resolve(compatibleLatest);
      const latestAge = compatibleLatest
        ? Date.now() - Date.parse(compatibleLatest.capturedAt)
        : Number.POSITIVE_INFINITY;
      if (latestAge < intervalMs) return Promise.resolve(compatibleLatest);
    }
    if (this.observationInFlight && !force) {
      return Promise.resolve(compatibleLatest);
    }
    if (this.visualCaptureInFlight) {
      const sameTarget = this.visualCaptureInFlightTarget?.tabId === tabId && this.visualCaptureInFlightTarget.url === startedUrl;
      if (sameTarget) return this.visualCaptureInFlight;
      return this.visualCaptureInFlight.then(() => this.refreshVisualCapture(force, authorization));
    }
    const capture = (async (): Promise<BrowserVisualCapture | null> => {
      try {
        const image = await contents.capturePage();
        await this.assertDocumentNotSensitive(tabId);
        authorization?.();
        if (image.isEmpty()) throw new Error('La captura de percepción está vacía.');
        if (!this.observationEnabled || !this.isTabVisible(tab) || this.activeTabId !== tabId || contents.isDestroyed() || contents.getURL() !== startedUrl || tab.visualRevision !== startedRevision) {
          return this.compatibleLatestVisualCapture(tabId, startedUrl, tab.visualRevision);
        }
        const visualCapture: BrowserVisualCapture = {
          tabId,
          url: startedUrl,
          capturedAt: new Date().toISOString(),
          screenshot: encodePassiveCapture(image),
          revision: startedRevision,
        };
        this.latestVisualCapture = visualCapture;
        return visualCapture;
      } catch (error) {
        this.observationLastError = safeErrorMessage(error instanceof Error ? error.message : String(error));
        return this.compatibleLatestVisualCapture(tabId, startedUrl, tab.visualRevision);
      } finally {
        this.visualCaptureInFlight = null;
        this.visualCaptureInFlightTarget = null;
      }
    })();
    this.visualCaptureInFlight = capture;
    this.visualCaptureInFlightTarget = { tabId, url: startedUrl };
    return capture;
  }

  private async refreshObservation(force = false, authorization?: () => void): Promise<BrowserObservationSnapshot | null> {
    if (!this.observationEnabled) return null;
    const tab = this.getActiveTab();
    if (!tab || !this.isTabVisible(tab) || !tab.view || tab.view.webContents.isDestroyed()) return null;
    const authorizedUrl = tab.view.webContents.getURL();
    if (!authorization && !await this.canAgentAccessWithoutPrompt(authorizedUrl, 'observe-dom')) {
      this.latestObservation = null;
      return null;
    }
    try { await this.assertDocumentNotSensitive(tab.id); } catch { this.invalidateObservation(tab.id); return null; }
    authorization?.();
    if (this.getActiveTab() !== tab || tab.view.webContents.isDestroyed() || tab.view.webContents.getURL() !== authorizedUrl) return null;
    const host = this.getTabHost(tab);
    if (!host || !this.isWindowUsable(host)) {
      return Promise.resolve(this.compatibleLatestObservation(tab.id, tab.view.webContents.getURL()));
    }
    if (tab.loading && !force) return Promise.resolve(this.compatibleLatestObservation(tab.id, tab.view.webContents.getURL()));
    const tabId = tab.id;
    const contents = tab.view.webContents;
    const startedUrl = contents.getURL();
    if (this.observationInFlight) {
      const sameTarget = this.observationInFlightTarget?.tabId === tabId && this.observationInFlightTarget.url === startedUrl;
      if (sameTarget) return this.observationInFlight;
      return this.observationInFlight.then(() => this.refreshObservation(force, authorization));
    }
    const capture = (async (): Promise<BrowserObservationSnapshot | null> => {
      try {
        const [visualCapture, dom] = await Promise.all([
          this.getFreshVisualCapture(tabId, startedUrl, authorization),
          collectIntegratedBrowserDom(contents),
        ]);
        await this.assertDocumentNotSensitive(tabId);
        authorization?.();
        if (!visualCapture) throw new Error('La captura de percepción está vacía.');
        if (!this.observationEnabled || !this.isTabVisible(tab) || this.activeTabId !== tabId || contents.isDestroyed() || contents.getURL() !== startedUrl) {
          return this.compatibleLatestObservation(tabId, startedUrl);
        }
        const observation: BrowserObservationSnapshot = {
          id: randomUUID(),
          sequence: ++this.observationSequence,
          capturedAt: visualCapture.capturedAt,
          tabId,
          screenshot: visualCapture.screenshot,
          dom,
        };
        this.latestObservation = observation;
        this.observationLastError = null;
        return observation;
      } catch (error) {
        this.observationLastError = safeErrorMessage(error instanceof Error ? error.message : String(error));
        return this.compatibleLatestObservation(tabId, startedUrl);
      } finally {
        this.observationInFlight = null;
        this.observationInFlightTarget = null;
      }
    })();
    this.observationInFlight = capture;
    this.observationInFlightTarget = { tabId, url: startedUrl };
    return capture;
  }

  private compatibleLatestObservation(tabId: string, url: string): BrowserObservationSnapshot | null {
    const latest = this.latestObservation;
    return latest?.tabId === tabId && latest.dom.url === sanitizeStateUrl(url) ? latest : null;
  }

  private compatibleLatestVisualCapture(tabId: string, url: string, revision?: number): BrowserVisualCapture | null {
    const latest = this.latestVisualCapture;
    return latest?.tabId === tabId && latest.url === url && (revision === undefined || latest.revision === revision) ? latest : null;
  }

  private getFreshVisualCapture(tabId: string, url: string, authorization?: () => void): Promise<BrowserVisualCapture | null> {
    const tab = this.tabs.get(tabId);
    const latest = this.compatibleLatestVisualCapture(tabId, url, tab?.visualRevision);
    const age = latest ? Date.now() - Date.parse(latest.capturedAt) : Number.POSITIVE_INFINITY;
    // La cadencia multimedia solo limita el muestreo pasivo. Un turno
    // explicito no debe reutilizar durante 30 s una imagen que pudo cambiar por
    // XHR sin producir un evento de entrada.
    return age < INTEGRATED_BROWSER_OBSERVATION_INTERVAL_MS ? Promise.resolve(latest) : this.refreshVisualCapture(true, authorization);
  }

  private configureTabZoom(tab: BrowserTabRuntime): void {
    const contents = tab.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    applyBrowserTabZoom(contents, tab.zoomFactor, tab.appliedBounds);
  }

  private assertCapability(capability: keyof typeof this.capabilities): void {
    if (!this.capabilities[capability]) throw new Error(`La capacidad del navegador está deshabilitada: ${capability}.`);
  }
}

function passiveObservationIntervalMs(url: string): number {
  return isHighCostMediaUrl(url)
    ? INTEGRATED_BROWSER_MEDIA_OBSERVATION_INTERVAL_MS
    : INTEGRATED_BROWSER_OBSERVATION_INTERVAL_MS;
}

function passiveObservationIdleMs(url: string): number {
  return isHighCostMediaUrl(url)
    ? INTEGRATED_BROWSER_MEDIA_OBSERVATION_IDLE_MS
    : INTEGRATED_BROWSER_OBSERVATION_IDLE_MS;
}

/**
 * YouTube mantiene paneles como la transcripcion mediante solicitudes y
 * renders posteriores a la carga principal. Capturar a los cuatro segundos
 * puede coincidir exactamente con ese trabajo y bloquear su compositor.
 */
function isHighCostMediaUrl(rawUrl: string): boolean {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname === 'youtube.com'
      || hostname.endsWith('.youtube.com')
      || hostname === 'youtu.be'
      || hostname.endsWith('.youtu.be');
  } catch {
    return false;
  }
}

function encodePassiveCapture(image: Awaited<ReturnType<WebContents['capturePage']>>): string {
  return encodeBrowserCapture(image, INTEGRATED_BROWSER_OBSERVATION_MAX_EDGE, INTEGRATED_BROWSER_OBSERVATION_QUALITY);
}

/**
 * JPEG en vez de PNG: la captura es una fotografia de pantalla, no un grafico
 * plano. El PNG bloqueaba el proceso principal durante la codificacion y
 * multiplicaba por diez el tamano transferido por IPC en cada percepcion.
 */
function encodeBrowserCapture(
  image: Awaited<ReturnType<WebContents['capturePage']>>,
  maxEdge: number,
  quality: number,
): string {
  const size = image.getSize();
  const longestEdge = Math.max(size.width, size.height);
  const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
  const encodedImage = scale < 1
    ? image.resize({
      width: Math.max(1, Math.round(size.width * scale)),
      height: Math.max(1, Math.round(size.height * scale)),
      quality: 'good',
    })
    : image;
  return `data:image/jpeg;base64,${encodedImage.toJPEG(quality).toString('base64')}`;
}

function sendBrowserClick(contents: WebContents, x: number, y: number): void {
  contents.sendInputEvent({ type: 'mouseMove', x, y });
  contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x, y });
  contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x, y });
}

function isMeaningfulBrowserInput(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const type = (input as { type?: unknown }).type;
  return typeof type === 'string' && !['mouseMove', 'pointerMove', 'pointerRawUpdate', 'mouseEnter', 'mouseLeave'].includes(type);
}

/**
 * Aplica la identidad Chromium tanto al documento como a la sesion.
 *
 * `webContents.setUserAgent` cubre la pagina principal, pero Chromium 152 usa
 * el User-Agent de `Session` en workers y algunos subframes cruzados. Google
 * Chat carga precisamente la llamada de Meet por esas superficies; si la
 * sesion conserva `Electron/x.y.z`, la mayor parte del flujo vuelve a anunciar
 * Electron aunque la pestaña principal ya parezca Chrome.
 */
function normalizeBrowserUserAgent(contents: WebContents): void {
  const userAgent = toStandardChromiumUserAgent(contents.getUserAgent());
  contents.session.setUserAgent(userAgent);
  contents.setUserAgent(userAgent);
}

function detachedWindowTitle(tab: BrowserTabRuntime): string {
  const title = (tab.title || 'Nueva pestaña').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120);
  return `${title || 'Nueva pestaña'} · Navegador SofLIA`;
}

/**
 * Un `window.open` sin destino: Document Picture-in-Picture y los popups que la
 * pagina rellena por script. Necesitan una ventana real; convertirlos en
 * pestañas rompe a quien los abrio.
 */
function isBlankPopupTarget(url: unknown): boolean {
  return typeof url === 'string' && (url === '' || url === 'about:blank' || url === 'about:blank#blocked');
}

/** La ruta directa de Chat se reconoce de forma exacta para bloquearla. */
function isGoogleMeetDirectCallUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:'
      && url.hostname === 'meet.google.com'
      && (url.pathname === '/call' || url.pathname === '/call/');
  } catch {
    return false;
  }
}

/** La protección solo se aplica a aperturas originadas por Gmail o Chat. */
function isGoogleChatCallSource(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:'
      && (url.hostname === 'mail.google.com' || url.hostname === 'chat.google.com');
  } catch {
    return false;
  }
}

function isBlockedGoogleChatDirectCall(source: unknown, target: unknown): boolean {
  return isGoogleChatCallSource(source) && isGoogleMeetDirectCallUrl(target);
}

/**
 * Margen antes de dar por abandonado un aviso de permiso. Es largo a proposito:
 * el usuario puede estar leyendolo. Solo existe para que una pagina no quede
 * bloqueada para siempre si el aviso nunca llega a responderse.
 */
const BUILTIN_TRACKING_RULES: Array<{ host: string; category: BrowserPrivacyCategory }> = [
  { host: 'doubleclick.net', category: 'advertising' },
  { host: 'google-analytics.com', category: 'tracker' },
  { host: 'googlesyndication.com', category: 'advertising' },
  { host: 'scorecardresearch.com', category: 'tracker' },
  { host: 'hotjar.com', category: 'tracker' },
  { host: 'clarity.ms', category: 'tracker' },
  { host: 'criteo.com', category: 'advertising' },
];

function privacyRequestOrigin(details: { url: string; resourceType: string; webContents?: WebContents; frame?: Electron.WebFrameMain | null }): string {
  // Electron no expone `initiator`; la política pertenece al documento superior.
  if (details.resourceType === 'mainFrame') return normalizePrivacyOrigin(details.url);
  try { return normalizePrivacyOrigin(details.webContents?.getURL() || details.frame?.top?.url || details.url); }
  catch { return normalizePrivacyOrigin(details.url); }
}

function privacyCategoryEnabled(level: BrowserPrivacyLevel, exceptions: BrowserPrivacyCategory[], category: BrowserPrivacyCategory): boolean {
  if (category === 'malware') return true;
  return level !== 'off' && !exceptions.includes(category);
}

function isThirdPartyRequest(requestUrl: string, initiator?: string): boolean {
  if (!initiator) return false;
  try {
    const requestHost = new URL(requestUrl).hostname.toLowerCase();
    const initiatorHost = new URL(initiator).hostname.toLowerCase();
    const site = (host: string) => getDomain(host, { allowPrivateDomains: true }) ?? host;
    return site(requestHost) !== site(initiatorHost);
  } catch { return false; }
}

function removeHeader(headers: Record<string, unknown>, name: string): void {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  if (key) delete headers[key];
}

const PERMISSION_PROMPT_TIMEOUT_MS = 120_000;

/**
 * Lo que Chrome llama "cookies y otros datos de sitios". `cache` queda fuera a
 * proposito: es una categoria propia que el usuario marca por separado.
 */
const SITE_DATA_TYPES = [
  'cookies',
  'localStorage',
  'indexedDB',
  'serviceWorkers',
  'fileSystems',
  'webSQL',
  'backgroundFetch',
] as const;

const POPUP_DEFAULT_WIDTH = 640;
const POPUP_DEFAULT_HEIGHT = 480;
const POPUP_MIN_EDGE = 180;
const POPUP_MAX_EDGE = 2_048;
/** Por encima de este ancho la ventana es un popup, no un Picture-in-Picture. */
const POPUP_ALWAYS_ON_TOP_MAX_WIDTH = 700;

function buildPopupWindowOptions(details: { features?: string }): Record<string, unknown> {
  const features = parseWindowFeatures(details.features);
  return {
    width: clampWindowEdge(features.width, POPUP_DEFAULT_WIDTH),
    height: clampWindowEdge(features.height, POPUP_DEFAULT_HEIGHT),
    autoHideMenuBar: true,
  };
}

function parseWindowFeatures(raw: unknown): { width?: number; height?: number } {
  if (typeof raw !== 'string' || !raw) return {};
  const parsed: { width?: number; height?: number } = {};
  for (const part of raw.split(',')) {
    const [name, value] = part.split('=').map((piece) => piece.trim().toLowerCase());
    if (name !== 'width' && name !== 'height') continue;
    const numeric = Number.parseInt(value ?? '', 10);
    if (Number.isFinite(numeric)) parsed[name] = numeric;
  }
  return parsed;
}

function clampWindowEdge(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(POPUP_MAX_EDGE, Math.max(POPUP_MIN_EDGE, Math.round(value)));
}

type CredentialFieldTargets = {
  username?: { x: number; y: number } | null;
  password: { x: number; y: number };
};

const FIND_LOGIN_FIELDS_SCRIPT = `(() => {
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return !element.disabled && !element.readOnly && rect.width > 2 && rect.height > 2 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const point = (element) => {
    const rect = element.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  };
  const passwords = Array.from(document.querySelectorAll('input[type="password"]')).filter(visible);
  const password = passwords[0];
  if (!password) return null;
  const scope = password.form || document;
  const candidates = Array.from(scope.querySelectorAll('input')).filter((element) => {
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    return element !== password && ['text', 'email', 'tel'].includes(type) && visible(element);
  });
  const username = candidates.find((element) => {
    const hint = [element.name, element.id, element.autocomplete, element.placeholder].filter(Boolean).join(' ').toLowerCase();
    return /user|email|login|correo|usuario/.test(hint);
  }) || candidates.at(-1) || null;
  return { username: username ? point(username) : null, password: point(password) };
})()`;

function isPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') return false;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && Number.isFinite(point.x)
    && typeof point.y === 'number' && Number.isFinite(point.y);
}

async function replaceFocusedField(contents: WebContents, point: { x: number; y: number }, value: string): Promise<void> {
  const x = Math.max(0, Math.round(point.x));
  const y = Math.max(0, Math.round(point.y));
  contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x, y });
  contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x, y });
  const selectionModifier = process.platform === 'darwin' ? 'meta' : 'control';
  contents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: [selectionModifier] });
  contents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: [selectionModifier] });
  await contents.insertText(value);
}

/**
 * `ERR_ABORTED (-3)` es el rechazo que devuelve `loadURL` cuando otra
 * navegacion reemplaza a la que estaba en curso. No indica que la pagina haya
 * fallado y no debe llegar a la barra de errores.
 */
function isSupersededNavigation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /ERR_ABORTED|\(-3\)/.test(message);
}

function safeErrorMessage(message: string): string {
  const normalized = message.replace(/[\r\n\t]+/g, ' ').trim();
  return (normalized || 'No se pudo cargar la pagina.').slice(0, 240);
}

function sanitizeStateUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().slice(0, 500);
  } catch {
    return '';
  }
}

/** Tope de marcos a inspeccionar; una pagina anidada no debe costar una ronda cara. */
const MAX_SELECTION_FRAMES = 12;

interface SelectableFrame {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
}

function collectSelectableFrames(contents: WebContents): SelectableFrame[] {
  const principal = contents.mainFrame;
  if (!principal) return [contents];
  const subarbol = principal.framesInSubtree ?? [];
  const marcos = subarbol.length > 0 ? subarbol : [principal];
  return marcos.slice(0, MAX_SELECTION_FRAMES);
}

/** Traza del camino de la seleccion; sin ella los fallos por marco son invisibles. */
function selectionLog(mensaje: string): void {
  console.log('[Navegador][Seleccion] ' + mensaje);
}

/** Marca que la pagina emite por consola al cambiar su seleccion. */
const SELECTION_BEACON = '__SOFLIA_SELECTION__';

const SELECTION_WATCHER_SCRIPT = '(() => { if (window.__sofliaSelWatch) return true; window.__sofliaSelWatch = true; document.addEventListener("selectionchange", () => { clearTimeout(window.__sofliaSelTimer); window.__sofliaSelTimer = setTimeout(() => console.log("__SOFLIA_SELECTION__"), 180); }, true); return true; })()';
