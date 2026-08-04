import { EventEmitter } from 'node:events';
import { WebContentsView, type BrowserWindow, type Rectangle, type WebContents } from 'electron';
import { configureIntegratedBrowserPermissions } from './permission-governance';
import {
  INTEGRATED_BROWSER_AGENT_VIEWPORT_TIMEOUT_MS,
  INTEGRATED_BROWSER_HOME,
  INTEGRATED_BROWSER_PARTITION,
  type IntegratedBrowserState,
} from './types';
import { isAllowedBrowserUrl, normalizeBrowserTarget, parseBrowserViewport } from './validation';

type ViewportWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class IntegratedBrowserService extends EventEmitter {
  private parentWindow: BrowserWindow | null = null;
  private view: WebContentsView | null = null;
  private viewport: Rectangle | null = null;
  private loading = false;
  private visible = false;
  private agentControlling = false;
  private navigationError: string | null = null;
  private permissionCleanup: (() => void) | null = null;
  private viewportWaiters = new Set<ViewportWaiter>();

  attachWindow(window: BrowserWindow): void {
    if (this.parentWindow === window) return;
    this.detachWindow();
    this.parentWindow = window;
    window.once('closed', () => this.detachWindow(window));
  }

  detachWindow(expectedWindow?: BrowserWindow): void {
    if (expectedWindow && this.parentWindow !== expectedWindow) return;
    this.rejectViewportWaiters(new Error('La ventana principal se cerro antes de mostrar el navegador.'));
    this.permissionCleanup?.();
    this.permissionCleanup = null;
    if (this.view) {
      try { this.view.setVisible(false); } catch { /* cierre idempotente */ }
      try { this.parentWindow?.contentView.removeChildView(this.view); } catch { /* cierre idempotente */ }
      try {
        if (!this.view.webContents.isDestroyed()) this.view.webContents.close({ waitForBeforeUnload: false });
      } catch { /* cierre idempotente */ }
    }
    this.view = null;
    this.parentWindow = null;
    this.viewport = null;
    this.loading = false;
    this.visible = false;
    this.agentControlling = false;
    this.navigationError = null;
  }

  getState(): IntegratedBrowserState {
    const contents = this.getWebContents();
    return {
      url: contents?.getURL() || 'about:blank',
      title: contents?.getTitle() || 'Navegador',
      canGoBack: contents?.navigationHistory.canGoBack() ?? false,
      canGoForward: contents?.navigationHistory.canGoForward() ?? false,
      isLoading: this.loading,
      isVisible: this.visible,
      agentControlling: this.agentControlling,
      error: this.navigationError,
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

  setViewport(rawViewport: unknown): IntegratedBrowserState {
    const parent = this.requireParentWindow();
    const view = this.ensureView();
    const viewport = parseBrowserViewport(rawViewport, parent.getContentBounds());
    this.viewport = viewport;
    view.setBounds(viewport);
    view.setVisible(true);
    this.visible = true;
    this.resolveViewportWaiters();
    this.emitState();
    return this.getState();
  }

  hide(): IntegratedBrowserState {
    if (this.view) this.view.setVisible(false);
    this.visible = false;
    this.emitState();
    return this.getState();
  }

  focus(): IntegratedBrowserState {
    if (this.visible) this.getWebContents()?.focus();
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
    this.loading = false;
    this.emitState();
    return this.getState();
  }

  async openForAgent(rawUrl?: unknown, timeoutMs = INTEGRATED_BROWSER_AGENT_VIEWPORT_TIMEOUT_MS): Promise<void> {
    if (this.agentControlling) {
      throw new Error('El navegador integrado ya esta siendo controlado por otra tarea.');
    }
    const parent = this.requireParentWindow();
    const contents = this.ensureView().webContents;
    if (parent.isMinimized()) parent.restore();
    if (!parent.isVisible()) parent.show();
    parent.focus();
    this.setAgentControlling(true);
    parent.webContents.send('integrated-browser:open-requested', { url: typeof rawUrl === 'string' ? rawUrl : this.getState().url });
    const viewportReady = this.visible && this.viewport ? Promise.resolve() : this.waitForViewport(timeoutMs);
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
    this.emitState();
  }

  getViewportSize(): { width: number; height: number } {
    if (!this.viewport || !this.visible) throw new Error('El navegador integrado no tiene un viewport visible.');
    return { width: this.viewport.width, height: this.viewport.height };
  }

  getWebContentsForAgent(): WebContents {
    const contents = this.getWebContents();
    if (!contents || contents.isDestroyed()) throw new Error('El navegador integrado no esta disponible.');
    return contents;
  }

  private ensureView(): WebContentsView {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    const parent = this.requireParentWindow();
    const view = new WebContentsView({
      webPreferences: {
        partition: INTEGRATED_BROWSER_PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: true,
      },
    });
    view.setVisible(false);
    view.setBackgroundColor('#ffffff');
    parent.contentView.addChildView(view);
    this.view = view;
    this.configureWebContents(view.webContents);
    this.permissionCleanup = configureIntegratedBrowserPermissions({
      session: view.webContents.session,
      getBrowserContents: () => this.getWebContents(),
      getParentWindow: () => this.parentWindow,
    });
    return view;
  }

  private configureWebContents(contents: WebContents): void {
    contents.setWindowOpenHandler(({ url }) => {
      if (isAllowedBrowserUrl(url)) void contents.loadURL(url).catch((error) => this.recordError(error));
      else this.recordError(new Error('El sitio intento abrir un protocolo no permitido.'));
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event) => {
      const url = event.url;
      if (isAllowedBrowserUrl(url)) return;
      event.preventDefault();
      this.recordError(new Error('La navegacion fue bloqueada por seguridad.'));
    });
    contents.on('will-redirect', (event) => {
      if (isAllowedBrowserUrl(event.url)) return;
      event.preventDefault();
      this.recordError(new Error('La redireccion fue bloqueada por seguridad.'));
    });
    contents.on('did-start-loading', () => {
      this.loading = true;
      this.navigationError = null;
      this.emitState();
    });
    contents.on('did-stop-loading', () => {
      this.loading = false;
      this.emitState();
    });
    contents.on('did-navigate', () => this.emitState());
    contents.on('did-navigate-in-page', () => this.emitState());
    contents.on('page-title-updated', () => this.emitState());
    contents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      this.loading = false;
      this.navigationError = safeErrorMessage(errorDescription || `Error de navegacion (${errorCode}).`);
      this.emitState();
    });
  }

  private async loadTarget(rawTarget: unknown): Promise<void> {
    const target = normalizeBrowserTarget(rawTarget);
    this.navigationError = null;
    try {
      await this.ensureView().webContents.loadURL(target);
    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }

  private recordError(error: unknown): void {
    this.loading = false;
    this.navigationError = safeErrorMessage(error instanceof Error ? error.message : String(error));
    this.emitState();
  }

  private emitState(): void {
    const state = this.getState();
    this.emit('state-changed', state);
    const parent = this.parentWindow;
    if (parent && !parent.isDestroyed()) parent.webContents.send('integrated-browser:state-changed', state);
  }

  private getWebContents(): WebContents | null {
    if (!this.view || this.view.webContents.isDestroyed()) return null;
    return this.view.webContents;
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
}

function safeErrorMessage(message: string): string {
  const normalized = message.replace(/[\r\n\t]+/g, ' ').trim();
  return (normalized || 'No se pudo cargar la pagina.').slice(0, 240);
}
