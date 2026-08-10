import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { BaseWindow, WebContentsView, type BrowserWindow, type Rectangle, type WebContents } from 'electron';
import { BrowserHistoryStore } from './browser-history-store';
import { BrowserCredentialVault } from './credential-vault';
import { BrowserExtensionManager } from './extension-manager';
import { buildBrowserContextMenu, buildSelectionInstruction, MAX_SELECTION_CHARS } from './context-menu';
import { collectIntegratedBrowserDom } from './page-observation';
import { describeResolutionFailure, resolveBrowserElement, type BrowserElementTarget } from './page-interaction';
import { IntegratedBrowserPermissionGovernance } from './permission-governance';
import { BrowserSitePermissionStore } from './site-permissions';
import { pickDisplayMediaSource } from './display-media-picker';
import { BrowserReadingModeService, type BrowserReadingSpeechResult } from './reading-mode-service';
import type {
  BrowserReadingContent,
  BrowserReadingPrepareInput,
  BrowserReadingToolbarAction,
  BrowserReadingToolbarState,
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
  INTEGRATED_BROWSER_PARTITION,
  type BrowserCredentialMetadata,
  type BrowserCredentialSaveInput,
  type BrowserExtensionInstallPreview,
  type BrowserExtensionMetadata,
  type BrowserHistoryEntry,
  type BrowserInteractionOutcome,
  type BrowserObservationSnapshot,
  type BrowserObservationStatus,
  type BrowserSitePermissionKind,
  type BrowserSitePermissionState,
  type BrowserSitePermissionSummary,
  type IntegratedBrowserState,
  type IntegratedBrowserTabState,
  type IntegratedBrowserViewMode,
} from './types';
import { isAllowedBrowserUrl, normalizeBrowserTarget, parseBrowserViewport } from './validation';

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
  lastActivatedAt: number;
  visualRevision: number;
  passiveCaptureNotBefore: number;
  lastDeferAt: number;
  /** Ultimo estado aplicado a la vista nativa: evita ocultar y volver a mostrar
   *  la pagina en cada publicacion de viewport, que la obliga a descartar el
   *  cuadro compuesto y reiniciar temporizadores de carga. */
  appliedVisible: boolean | null;
  appliedBounds: Rectangle | null;
};

type BrowserVisualCapture = {
  tabId: string;
  url: string;
  capturedAt: string;
  screenshot: string;
  revision: number;
};

export class IntegratedBrowserService extends EventEmitter {
  private parentWindow: BrowserWindow | null = null;
  private detachedWindows = new Map<string, BaseWindow>();
  private mainWindowFocusHandler: (() => void) | null = null;
  private tabs = new Map<string, BrowserTabRuntime>();
  private activeTabId: string | null = null;
  private primaryTabId: string | null = null;
  private secondaryTabId: string | null = null;
  private viewMode: IntegratedBrowserViewMode = 'single';
  private overlayTopTabId: string | null = null;
  private customOverlayBounds: Rectangle | null = null;
  private viewport: Rectangle | null = null;
  private visible = false;
  private agentControlling = false;
  private permissions: IntegratedBrowserPermissionGovernance | null = null;
  /** Pestaña que pidio pantalla completa a la pagina, si hay alguna. */
  private fullscreenTabId: string | null = null;
  /** Estado de la ventana anfitriona antes de entrar en pantalla completa. */
  private fullscreenRestore: { window: BaseWindow | BrowserWindow; wasFullScreen: boolean } | null = null;
  private pictureInPictureWindows = new Set<BrowserWindow>();
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

  constructor(
    private readonly historyStore = new BrowserHistoryStore(),
    private readonly credentialVault = new BrowserCredentialVault(),
    private readonly extensionManager = new BrowserExtensionManager(),
    private readonly readingModeService = new BrowserReadingModeService(),
    private readonly sitePermissionStore = new BrowserSitePermissionStore(),
  ) {
    super();
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
    const origin = typeof input.origin === 'string' && input.origin
      ? input.origin
      : this.getActiveTab()?.url ?? '';
    await this.permissions.setPermission(
      origin,
      input.kind as BrowserSitePermissionKind,
      input.state as BrowserSitePermissionState,
    );
    return this.permissions.getSummary(origin);
  }

  async resetSitePermissions(input: { origin?: unknown } = {}): Promise<BrowserSitePermissionSummary> {
    if (!this.permissions) throw new Error('El navegador no esta iniciado.');
    const origin = typeof input.origin === 'string' && input.origin
      ? input.origin
      : this.getActiveTab()?.url ?? '';
    await this.permissions.resetOrigin(origin);
    return this.permissions.getSummary(origin);
  }

  attachWindow(window: BrowserWindow): void {
    if (this.parentWindow === window) return;
    this.detachWindow();
    this.parentWindow = window;
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
  }

  detachWindow(expectedWindow?: BrowserWindow): void {
    if (expectedWindow && this.parentWindow !== expectedWindow) return;
    this.rejectViewportWaiters(new Error('La ventana principal se cerro antes de mostrar el navegador.'));
    this.permissions?.dispose();
    this.permissions = null;
    this.closePictureInPictureWindows();
    this.fullscreenTabId = null;
    this.fullscreenRestore = null;
    if (this.parentWindow && this.mainWindowFocusHandler) {
      this.parentWindow.removeListener('focus', this.mainWindowFocusHandler);
    }
    this.mainWindowFocusHandler = null;
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
    this.activeTabId = null;
    this.primaryTabId = null;
    this.secondaryTabId = null;
    this.viewMode = 'single';
    this.overlayTopTabId = null;
    this.parentWindow = null;
    this.viewport = null;
    this.visible = false;
    this.agentControlling = false;
    this.stopObservationTimer();
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
    this.readingModeService.dispose();
  }

  getState(): IntegratedBrowserState {
    const active = this.getActiveTab();
    if (active) this.snapshotTab(active);
    const contents = active?.view?.webContents ?? null;
    return {
      url: active?.url || 'about:blank',
      title: active?.title || 'Navegador',
      canGoBack: contents?.navigationHistory.canGoBack() ?? active?.canGoBack ?? false,
      canGoForward: contents?.navigationHistory.canGoForward() ?? active?.canGoForward ?? false,
      isLoading: active?.loading ?? false,
      isVisible: this.visible || Array.from(this.detachedWindows.values()).some((window) => this.isWindowUsable(window)),
      agentControlling: this.agentControlling,
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
    };
  }

  async open(rawUrl?: unknown): Promise<IntegratedBrowserState> {
    const contents = this.ensureView().webContents;
    const currentUrl = contents.getURL();
    if (rawUrl !== undefined) {
      await this.loadTarget(rawUrl);
    } else if (!currentUrl || currentUrl === 'about:blank') {
      await contents.loadURL(INTEGRATED_BROWSER_HOME);
    }
    return this.getState();
  }

  async navigate(rawTarget: unknown): Promise<IntegratedBrowserState> {
    this.ensureView();
    await this.loadTarget(rawTarget);
    return this.getState();
  }

  async createTab(rawUrl?: unknown, activate = true): Promise<IntegratedBrowserState> {
    const target = rawUrl === undefined ? INTEGRATED_BROWSER_HOME : normalizeBrowserTarget(rawUrl);
    if (this.tabs.size >= INTEGRATED_BROWSER_MAX_TABS) {
      throw new Error(`El navegador admite hasta ${INTEGRATED_BROWSER_MAX_TABS} pestañas abiertas.`);
    }
    const tab = this.createTabRuntime();
    tab.url = target;
    if (!this.primaryTabId) this.primaryTabId = tab.id;
    if (activate) this.activateTabInternal(tab.id);
    this.applyViewLayout();
    try {
      await this.requireTabView(tab).webContents.loadURL(target);
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

  activateTab(rawTabId: unknown): IntegratedBrowserState {
    const tabId = this.requireTabId(rawTabId);
    this.activateTabInternal(tabId);
    this.applyViewLayout();
    this.emitState();
    return this.getState();
  }

  detachTab(rawTabId: unknown): IntegratedBrowserState {
    const tabId = this.requireTabId(rawTabId);
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
      secondaryTabId ??= Array.from(this.tabs.keys()).find((id) => id !== this.activeTabId) ?? null;
      if (!secondaryTabId) {
        await this.createTab(undefined, false);
        secondaryTabId = Array.from(this.tabs.keys()).find((id) => id !== this.activeTabId) ?? null;
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
    if (solicitud.selection) selectionLog(`modo lectura sobre la seleccion (${solicitud.selection.length} chars)`);
    return this.readingModeService.prepare({ contents, tabId: active.id, request: solicitud });
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

  async openForAgent(rawUrl?: unknown, timeoutMs = INTEGRATED_BROWSER_AGENT_VIEWPORT_TIMEOUT_MS): Promise<void> {
    if (this.agentControlling) {
      throw new Error('El navegador integrado ya esta siendo controlado por otra tarea.');
    }
    const parent = this.requireParentWindow();
    const contents = this.ensureView().webContents;
    const active = this.getActiveTab();
    const detached = active ? this.detachedWindows.get(active.id) : null;
    const host = detached ?? parent;
    if (host.isMinimized()) host.restore();
    if (!host.isVisible()) host.show();
    host.focus();
    this.setAgentControlling(true);
    parent.webContents.send('integrated-browser:open-requested', { url: typeof rawUrl === 'string' ? rawUrl : this.getState().url });
    const viewportReady = detached || (this.visible && this.viewport) ? Promise.resolve() : this.waitForViewport(timeoutMs);
    const navigationReady = rawUrl !== undefined
      ? this.loadTarget(rawUrl)
      : (!contents.getURL() || contents.getURL() === 'about:blank')
        ? contents.loadURL(INTEGRATED_BROWSER_HOME)
        : Promise.resolve();
    try {
      await Promise.all([viewportReady, navigationReady]);
      contents.focus();
    } catch (error) {
      this.setAgentControlling(false);
      throw error;
    }
  }

  releaseAgentControl(): void {
    if (!this.agentControlling) return;
    this.setAgentControlling(false);
  }

  private setAgentControlling(value: boolean): void {
    this.agentControlling = value;
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

  /**
   * Respaldo visual que el renderer muestra mientras la vista nativa esta
   * oculta. Se codifica en JPEG y a la escala logica del viewport: el PNG a
   * resolucion de dispositivo tardaba cientos de milisegundos en codificarse y
   * viajaba por IPC como varios megabytes en cada apertura de la barra.
   */
  async captureVisiblePage(): Promise<string> {
    return (await this.captureVisibleBackdrop()).screenshot;
  }

  /**
   * Captura y el rectangulo exacto que ocupaba la vista al tomarla. El
   * renderer usa el respaldo mientras oculta la vista nativa para desplegar un
   * panel encima; sin el rectangulo lo estiraba al contenedor disponible y la
   * pagina aparecia ampliada durante ese instante.
   */
  async captureVisibleBackdrop(): Promise<{ screenshot: string; bounds: Rectangle }> {
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
    tabId: string;
    url: string;
    title: string;
    isCurrent: boolean;
    text: string;
  }> {
    const summaries: Array<{
      tabId: string;
      url: string;
      title: string;
      isCurrent: boolean;
      text: string;
    }> = [];

    for (const tab of this.tabs.values()) {
      const isCurrent = tab.id === this.activeTabId;
      summaries.push({
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
  async getTabContent(tabId: string): Promise<{
    tabId: string;
    url: string;
    title: string;
    text: string;
  }> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      return { tabId, url: '', title: '', text: '' };
    }
    let text = '';
    if (tab.view && !tab.view.webContents.isDestroyed()) {
      try {
        const dom = await collectIntegratedBrowserDom(tab.view.webContents);
        text = dom.text;
      } catch {
        // Fallback si la pestaña está inaccesible o cargando
      }
    }
    return {
      tabId: tab.id,
      url: sanitizeStateUrl(tab.view?.webContents.getURL() ?? tab.url ?? 'about:blank'),
      title: tab.title || 'Nueva pestaña',
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

  async getObservation(forceFresh = false): Promise<{ observation: BrowserObservationSnapshot | null; observationStatus: BrowserObservationStatus }> {
    if (!this.observationEnabled) return { observation: null, observationStatus: this.getObservationStatus() };
    const active = this.getActiveTab();
    const currentUrl = active?.view?.webContents.getURL() ?? active?.url ?? '';
    const latest = this.latestObservation;
    const latestMatches = latest !== null && latest.tabId === active?.id && latest.dom.url === sanitizeStateUrl(currentUrl);
    const observation = forceFresh ? await this.refreshObservation(true) : latestMatches ? latest : null;
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
    const { contents, target } = await this.requireInteractiveTarget(rawRef);
    if (target.disabled) throw new Error(`El control "${target.name || target.tag}" esta deshabilitado.`);
    sendBrowserClick(contents, target.x, target.y);
    this.noteInteraction();
    return { target, warning: target.occluded ? 'Otro elemento cubria el punto de impacto; verifica el resultado antes de continuar.' : null };
  }

  /**
   * Escribe en un campo del ultimo snapshot. Enfoca con un clic real para que
   * los editores controlados del sitio reciban los mismos eventos que con un
   * usuario, limpia el valor previo y opcionalmente envia el formulario.
   */
  async typeInElement(rawRef: unknown, rawText: unknown, rawSubmit: unknown): Promise<BrowserInteractionOutcome> {
    if (typeof rawText !== 'string') throw new Error('El texto a escribir debe ser una cadena.');
    if (rawText.length > 5_000) throw new Error('El texto a escribir excede el limite de 5000 caracteres.');
    const { contents, target } = await this.requireInteractiveTarget(rawRef);
    if (!target.editable) throw new Error(`El elemento "${target.name || target.tag}" no es un campo editable.`);
    if (target.disabled) throw new Error(`El campo "${target.name || target.tag}" esta deshabilitado.`);
    sendBrowserClick(contents, target.x, target.y);
    const selectionModifier = process.platform === 'darwin' ? 'meta' : 'control';
    contents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: [selectionModifier] });
    contents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: [selectionModifier] });
    await contents.insertText(rawText);
    if (rawSubmit === true) {
      contents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      contents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
    }
    this.noteInteraction();
    return { target, warning: null };
  }

  /** Desplaza la pestaña activa con la rueda real del navegador. */
  scrollView(rawDirection: unknown, rawAmount: unknown): void {
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

  listHistory(input?: { query?: unknown; limit?: unknown }): Promise<BrowserHistoryEntry[]> {
    return this.historyStore.list(input);
  }

  async clearHistory(): Promise<boolean> {
    await this.historyStore.clear();
    return true;
  }

  listCredentials(): Promise<BrowserCredentialMetadata[]> {
    return this.credentialVault.list(this.getState().url);
  }

  saveCredential(input: BrowserCredentialSaveInput): Promise<BrowserCredentialMetadata> {
    return this.credentialVault.save(this.getState().url, input);
  }

  async fillCredential(id: string): Promise<BrowserCredentialMetadata> {
    const contents = this.getWebContentsForAgent();
    if (!this.visible) throw new Error('El navegador debe estar visible para rellenar una credencial.');
    const resolved = await this.credentialVault.resolveSecret(id, contents.getURL());
    const fields = await contents.executeJavaScript(FIND_LOGIN_FIELDS_SCRIPT, true) as CredentialFieldTargets | null;
    if (!fields?.password || !isPoint(fields.password)) {
      throw new Error('No se encontro un campo de contrasena visible en esta pagina.');
    }
    if (fields.username && isPoint(fields.username)) {
      await replaceFocusedField(contents, fields.username, resolved.metadata.username);
    }
    await replaceFocusedField(contents, fields.password, resolved.password);
    return resolved.metadata;
  }

  async removeCredential(id: string): Promise<boolean> {
    const currentUrl = this.getState().url;
    const credential = (await this.credentialVault.list(currentUrl)).find((item) => item.id === id);
    if (!credential) throw new Error('La credencial no pertenece al sitio actual.');
    return this.credentialVault.remove(id, currentUrl);
  }

  listExtensions(): Promise<BrowserExtensionMetadata[]> {
    return this.extensionManager.list();
  }

  prepareExtensionInstall(): Promise<{ canceled: boolean; preview?: BrowserExtensionInstallPreview }> {
    return this.extensionManager.prepareFromDialog(this.requireParentWindow());
  }

  confirmExtensionInstall(token: string): Promise<BrowserExtensionMetadata> {
    return this.extensionManager.confirmInstall(token, this.ensureView().webContents.session);
  }

  setExtensionEnabled(installId: string, enabled: boolean): Promise<BrowserExtensionMetadata> {
    return this.extensionManager.setEnabled(installId, enabled, this.ensureView().webContents.session);
  }

  removeExtension(installId: string): Promise<boolean> {
    return this.extensionManager.remove(installId, this.ensureView().webContents.session);
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

  private createTabRuntime(): BrowserTabRuntime {
    const tab: BrowserTabRuntime = {
      id: randomUUID(),
      view: null,
      url: 'about:blank',
      title: 'Nueva pestaña',
      canGoBack: false,
      canGoForward: false,
      loading: false,
      error: null,
      lastActivatedAt: Date.now(),
      visualRevision: 0,
      passiveCaptureNotBefore: 0,
      lastDeferAt: 0,
      appliedVisible: null,
      appliedBounds: null,
    };
    this.tabs.set(tab.id, tab);
    this.materializeTab(tab, false);
    return tab;
  }

  private materializeTab(tab: BrowserTabRuntime, restoreUrl: boolean): WebContentsView {
    if (tab.view && !tab.view.webContents.isDestroyed()) return tab.view;
    const parent = this.requireParentWindow();
    const view = new WebContentsView({
      webPreferences: {
        partition: INTEGRATED_BROWSER_PARTITION,
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
    tab.appliedVisible = false;
    tab.appliedBounds = null;
    this.configureWebContents(tab);
    if (!this.permissions) {
      this.permissions = new IntegratedBrowserPermissionGovernance({
        session: view.webContents.session,
        store: this.sitePermissionStore,
        isBrowserContents: (contents) => this.isBrowserContents(contents),
        getParentWindow: () => this.parentWindow,
        onChanged: () => this.sendToRenderer('integrated-browser:site-permissions-changed', {}),
      });
      this.configureDisplayMedia(view.webContents.session);
    }
    if (!this.extensionsRestored) {
      this.extensionsRestored = true;
      void this.extensionManager.restore(view.webContents.session).catch((error) => {
        console.warn('[Navegador][Extensiones] No se pudieron restaurar todas las extensiones:', safeErrorMessage(error instanceof Error ? error.message : String(error)));
      });
    }
    if (restoreUrl && tab.url && tab.url !== 'about:blank') {
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
    contents.setUserAgent(toStandardChromiumUserAgent(contents.getUserAgent()));
    const isCurrentView = () => tab.view === view && !contents.isDestroyed();
    contents.setWindowOpenHandler((details) => {
      if (!isCurrentView()) return { action: 'deny' };
      const { url } = details;
      // Document Picture-in-Picture y los popups que la pagina rellena por
      // script piden `about:blank`. Convertirlos en pestañas dejaba pestañas
      // vacias y a la pagina esperando una ventana que nunca existio: es lo
      // que dejaba a Google Meet con el area de la llamada en negro.
      if (isBlankPopupTarget(url)) {
        console.info('[Navegador][Ventana] Apertura sin destino permitida como ventana real.');
        // Sin `webPreferences` propias: la ventana hereda las del abridor y
        // conserva su proceso y su relacion `window.opener`. Fijarlas la
        // colocaba en otro SiteInstance y el abridor perdia el acceso al
        // documento hijo antes de que terminara de inicializarse.
        return {
          action: 'allow',
          overrideBrowserWindowOptions: buildPopupWindowOptions(details),
        };
      }
      if (isAllowedBrowserUrl(url)) void this.createTab(url, true).catch((error) => this.recordError(error));
      else this.recordError(new Error('El sitio intento abrir un protocolo no permitido.'));
      return { action: 'deny' };
    });
    contents.on('did-create-window', (window) => {
      this.adoptPictureInPictureWindow(window);
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
      }).popup({ window: this.requireParentWindow() });
    });
    contents.on('will-navigate', (event) => {
      if (!isCurrentView()) return;
      if ((event as typeof event & { isMainFrame?: boolean }).isMainFrame === false) return;
      const url = event.url;
      if (isAllowedBrowserUrl(url)) return;
      event.preventDefault();
      this.recordError(new Error('La navegacion fue bloqueada por seguridad.'), tabId);
    });
    contents.on('will-redirect', (event) => {
      if (!isCurrentView()) return;
      if ((event as typeof event & { isMainFrame?: boolean }).isMainFrame === false) return;
      if (isAllowedBrowserUrl(event.url)) return;
      event.preventDefault();
      this.recordError(new Error('La redireccion fue bloqueada por seguridad.'), tabId);
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
      this.snapshotTab(tab);
      this.invalidateObservation(tabId);
      this.deferPassiveCapture(tab);
      this.emitState();
    });
    contents.on('did-finish-load', () => {
      if (!isCurrentView()) return;
      void this.installSelectionWatcher(contents);
      this.snapshotTab(tab);
      if (isAllowedBrowserUrl(tab.url)) tab.error = null;
      void this.historyStore.record({ url: contents.getURL(), title: contents.getTitle() }).catch((error) => {
        console.warn('[Navegador][Historial] No se pudo registrar la visita:', safeErrorMessage(error instanceof Error ? error.message : String(error)));
      });
    });
    contents.on('did-navigate-in-page', () => {
      if (!isCurrentView()) return;
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
      if (!mensaje.includes(SELECTION_BEACON)) return;
      this.deferSelectionProbe(tab);
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
    contents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (!isCurrentView()) return;
      if (!isMainFrame || errorCode === -3) return;
      tab.loading = false;
      tab.error = safeErrorMessage(errorDescription || `Error de navegacion (${errorCode}).`);
      this.emitState();
    });
  }

  private async loadTarget(rawTarget: unknown): Promise<void> {
    const target = normalizeBrowserTarget(rawTarget);
    const tab = this.getActiveTab();
    if (tab) {
      tab.error = null;
      tab.url = target;
    }
    try {
      await this.ensureView().webContents.loadURL(target);
    } catch (error) {
      // Una navegacion abortada no es un fallo: ocurre cada vez que el propio
      // sitio navega por su cuenta (las aplicaciones de una sola pagina lo
      // hacen al arrancar) o el usuario pide otro destino antes de terminar.
      if (isSupersededNavigation(error)) {
        this.recordError(error, this.activeTabId ?? undefined);
        return;
      }
      this.recordError(error, this.activeTabId ?? undefined);
      throw error;
    }
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

  private sendToRenderer(channel: string, payload: unknown): void {
    const parent = this.parentWindow;
    if (parent && !parent.isDestroyed()) parent.webContents.send(channel, payload);
  }

  private emitState(): void {
    const state = this.getState();
    this.emit('state-changed', state);
    const parent = this.parentWindow;
    if (parent && !parent.isDestroyed()) parent.webContents.send('integrated-browser:state-changed', state);
  }

  private getWebContents(): WebContents | null {
    const tab = this.getActiveTab();
    if (!tab) return null;
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
  private adoptPictureInPictureWindow(window: BrowserWindow): void {
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
    window.once('closed', () => this.pictureInPictureWindows.delete(window));
    window.webContents.on('will-navigate', (event) => {
      if (isAllowedBrowserUrl(event.url)) return;
      event.preventDefault();
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
    if (tab.appliedVisible === visible) return;
    tab.appliedVisible = visible;
    view.setVisible(visible);
  }

  private applyTabBounds(tab: BrowserTabRuntime, view: WebContentsView, bounds: Rectangle): void {
    const applied = tab.appliedBounds;
    if (applied && applied.x === bounds.x && applied.y === bounds.y && applied.width === bounds.width && applied.height === bounds.height) {
      return;
    }
    tab.appliedBounds = { ...bounds };
    view.setBounds(bounds);
  }

  private toTabState(tab: BrowserTabRuntime): IntegratedBrowserTabState {
    this.snapshotTab(tab);
    return {
      id: tab.id,
      url: tab.url || 'about:blank',
      title: tab.title || 'Nueva pestaña',
      isLoading: tab.loading,
      error: tab.error,
      isSuspended: tab.view === null,
      isDetached: this.detachedWindows.has(tab.id),
    };
  }

  private destroyTab(tab: BrowserTabRuntime): void {
    this.invalidateObservation(tab.id);
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
    this.applyTabBounds(tab, tab.view, { x: 0, y: 0, width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
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
    if (!this.parentWindow || this.parentWindow.isDestroyed()) {
      throw new Error('La ventana principal no esta disponible para mostrar el navegador.');
    }
    return this.parentWindow;
  }

  private waitForViewport(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiter = {} as ViewportWaiter;
      waiter.resolve = resolve;
      waiter.reject = reject;
      waiter.timer = setTimeout(() => {
        this.viewportWaiters.delete(waiter);
        reject(new Error('El navegador integrado no recibio un viewport visible a tiempo.'));
      }, timeoutMs);
      this.viewportWaiters.add(waiter);
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
   * seleccion. El aviso viaja por `console-message`, que el proceso principal
   * siempre recibe, sin necesidad de preload ni de un canal IPC nuevo.
   */
  private async installSelectionWatcher(contents: WebContents): Promise<void> {
    for (const marco of collectSelectableFrames(contents)) {
      await marco.executeJavaScript(SELECTION_WATCHER_SCRIPT, true).catch((error: unknown) => {
        selectionLog(`vigia no instalado en un marco: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
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
  private async readSelectionText(contents: WebContents): Promise<string> {
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
        return texto.slice(0, MAX_SELECTION_CHARS);
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

  private refreshVisualCapture(force = false): Promise<BrowserVisualCapture | null> {
    if (!this.observationEnabled) return Promise.resolve(null);
    const tab = this.getActiveTab();
    if (!tab || !this.isTabVisible(tab) || !tab.view || tab.view.webContents.isDestroyed()) return Promise.resolve(null);
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
      return this.visualCaptureInFlight.then(() => this.refreshVisualCapture(force));
    }
    const capture = (async (): Promise<BrowserVisualCapture | null> => {
      try {
        const image = await contents.capturePage();
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

  private refreshObservation(force = false): Promise<BrowserObservationSnapshot | null> {
    if (!this.observationEnabled) return Promise.resolve(null);
    const tab = this.getActiveTab();
    if (!tab || !this.isTabVisible(tab) || !tab.view || tab.view.webContents.isDestroyed()) return Promise.resolve(null);
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
      return this.observationInFlight.then(() => this.refreshObservation(force));
    }
    const capture = (async (): Promise<BrowserObservationSnapshot | null> => {
      try {
        const [visualCapture, dom] = await Promise.all([
          this.getFreshVisualCapture(tabId, startedUrl),
          collectIntegratedBrowserDom(contents),
        ]);
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

  private getFreshVisualCapture(tabId: string, url: string): Promise<BrowserVisualCapture | null> {
    const tab = this.tabs.get(tabId);
    const latest = this.compatibleLatestVisualCapture(tabId, url, tab?.visualRevision);
    const age = latest ? Date.now() - Date.parse(latest.capturedAt) : Number.POSITIVE_INFINITY;
    // La cadencia multimedia solo limita el muestreo pasivo. Un turno
    // explicito no debe reutilizar durante 30 s una imagen que pudo cambiar por
    // XHR sin producir un evento de entrada.
    return age < INTEGRATED_BROWSER_OBSERVATION_INTERVAL_MS ? Promise.resolve(latest) : this.refreshVisualCapture(true);
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
 * Deja el User-Agent identico al de un Chromium de escritorio.
 *
 * Electron inserta dos fichas propias: el nombre y version de la aplicacion
 * (`soflia-hub-desktop/x.y.z`) y `Electron/x.y.z`. Ambas convierten la cadena
 * en la de un cliente desconocido, mientras `Sec-CH-UA` sigue anunciando
 * `"Chromium"`. Los endpoints que validan la coherencia del cliente rechazan
 * esa combinacion; es lo que devolvia `FAILED_PRECONDITION` al pedir la
 * transcripcion de YouTube. Sin esas fichas, la cadena y las Client Hints
 * describen al mismo Chromium.
 */
function toStandardChromiumUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\s+Electron\/\d+(?:\.\d+)*/gi, '')
    .replace(/\s+[\w.-]+\/\d+(?:\.\d+)*(?=\s+Chrome\/)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
