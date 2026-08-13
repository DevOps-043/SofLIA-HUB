import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  EMPTY_INTEGRATED_BROWSER_STATE,
  integratedBrowserService,
  type BrowserExtensionMetadata,
  type IntegratedBrowserCaptureResponse,
  type BrowserObservationStatus,
  type BrowserReadingContent,
  type BrowserReadingModeRequest,
  type IntegratedBrowserResponse,
  type IntegratedBrowserState,
} from '../../services/integrated-browser-service';
import { BrowserManagementPanel, type BrowserManagementTab } from './BrowserManagementPanel';
import { BrowserAddressBar } from './BrowserAddressBar';
import { BrowserBookmarksBar, BrowserBookmarkToggle, BrowserExtensionsBar } from './BrowserBookmarksBar';
import { BrowserToolsMenu } from './BrowserToolsMenu';
import { BrowserAppGridMenu } from './BrowserAppGridMenu';
import { useBrowserBookmarks } from './use-browser-bookmarks';
import { BrowserReadingModePanel } from './BrowserReadingModePanel';
import { BrowserTabStrip } from './BrowserTabStrip';
import { scopedPreferenceKey } from '../../services/user-scope';

const UTILITY_BAR_STORAGE_KEY = 'sofLia_integratedBrowserUtilityBarVisible';

/**
 * La vista del navegador es una superficie nativa que se compone por encima del
 * renderer: intercambiarla por el respaldo (o al reves) sin esperar a que el
 * cuadro este pintado deja el area en blanco y se percibe como un refresco de
 * toda la pagina. Dos cuadros garantizan que React ya confirmo el DOM y que el
 * compositor ya lo mostro.
 */
function waitForNextPaint(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(() => requestAnimationFrame(settle));
    // Con la ventana minimizada u oculta el compositor deja de entregar
    // cuadros: sin salvaguarda la barra de direcciones quedaria bloqueada.
    setTimeout(settle, PAINT_WAIT_FALLBACK_MS);
  });
}

const PAINT_WAIT_FALLBACK_MS = 120;

export function IntegratedBrowserPanel(props: {
  onClose?: () => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  viewportInsets?: { left: number; right: number };
  onContentTopChange?: (offset: number) => void;
  chatVisible?: boolean;
  onShowChat?: () => void;
}) {
  const { onContentTopChange } = props;
  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportInsetsRef = useRef({ left: 0, right: 0 });
  const currentUrlRef = useRef(EMPTY_INTEGRATED_BROWSER_STATE.url);
  const extensionRequestIdRef = useRef(0);
  const addressEditingRef = useRef(false);
  const managementTabRef = useRef<BrowserManagementTab | null>(null);
  const suggestionOverlayRef = useRef(false);
  const suggestionOverlayRequestIdRef = useRef(0);
  const suggestionOpenPromiseRef = useRef<Promise<void> | null>(null);
  const suggestionRestorePromiseRef = useRef<Promise<void> | null>(null);
  const readingModeRef = useRef<BrowserReadingContent | null>(null);
  const [state, setState] = useState<IntegratedBrowserState>(EMPTY_INTEGRATED_BROWSER_STATE);
  const [address, setAddress] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [managementTab, setManagementTab] = useState<BrowserManagementTab | null>(null);
  const [managementSnapshot, setManagementSnapshot] = useState<string | null>(null);
  const [suggestionSnapshot, setSuggestionSnapshot] = useState<string | null>(null);
  /**
   * Rectangulo que ocupaba la vista nativa al capturar el respaldo, ya en
   * coordenadas del contenedor. Sin el, el respaldo se estiraba al espacio
   * disponible y la pagina aparecia ampliada mientras el panel estaba abierto.
   */
  const [snapshotStyle, setSnapshotStyle] = useState<CSSProperties | null>(null);
  const [utilityBarVisible, setUtilityBarVisible] = useState(readStoredUtilityBarVisible);
  const [toolbarExtensions, setToolbarExtensions] = useState<BrowserExtensionMetadata[]>([]);
  const [readingContent, setReadingContent] = useState<BrowserReadingContent | null>(null);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [appGridOpen, setAppGridOpen] = useState(false);
  const bookmarks = useBrowserBookmarks(state.url, state.title);
  const [observationStatus, setObservationStatus] = useState<BrowserObservationStatus>({
    enabled: true,
    capturing: false,
    intervalMs: 10_000,
    lastCapturedAt: null,
    lastError: null,
  });
  const viewportInsetLeft = Math.max(0, Math.round(props.viewportInsets?.left ?? 0));
  const viewportInsetRight = Math.max(0, Math.round(props.viewportInsets?.right ?? 0));
  viewportInsetsRef.current = { left: viewportInsetLeft, right: viewportInsetRight };

  const consumeResponse = useCallback((response: IntegratedBrowserResponse) => {
    if (!response.success) {
      setLocalError(response.error || 'No se pudo completar la operacion.');
      return;
    }
    setLocalError(null);
    if (response.state) setState(response.state);
  }, []);

  /**
   * Traduce el rectangulo que devuelve el proceso principal, en coordenadas de
   * ventana, al sistema del contenedor del respaldo. Si la captura no lo trae
   * se cae al comportamiento anterior de ocupar el contenedor completo.
   */
  const adoptSnapshotBounds = useCallback((capture: IntegratedBrowserCaptureResponse) => {
    const element = viewportRef.current;
    const bounds = capture.captureBounds;
    if (!element || !bounds || bounds.width < 1 || bounds.height < 1) {
      setSnapshotStyle(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    setSnapshotStyle({
      left: Math.round(bounds.x - rect.left),
      top: Math.round(bounds.y - rect.top),
      width: bounds.width,
      height: bounds.height,
    });
  }, []);

  const publishViewport = useCallback(async (force = false) => {
    const element = viewportRef.current;
    if (!element) return;
    if ((managementTabRef.current || suggestionOverlayRef.current) && !force) return;
    const rect = element.getBoundingClientRect();
    const rootRect = rootRef.current?.getBoundingClientRect();
    if (rootRect) onContentTopChange?.(Math.max(0, Math.round(rect.top - rootRect.top)));
    if (!integratedBrowserService.isAvailable()) return;
    const insets = viewportInsetsRef.current;
    const width = Math.round(rect.width) - insets.left - insets.right;
    if (width < 160 || rect.height < 120) return;
    const response = await integratedBrowserService.setViewport({
      x: Math.round(rect.left) + insets.left,
      y: Math.round(rect.top),
      width,
      height: Math.round(rect.height),
    });
    consumeResponse(response);
  }, [consumeResponse, onContentTopChange]);

  const handleSuggestionsVisibilityChange = useCallback(async (visible: boolean) => {
    if (!integratedBrowserService.isAvailable()) return;

    if (!visible) {
      const requestId = ++suggestionOverlayRequestIdRef.current;
      const wasVisible = suggestionOverlayRef.current;
      const pendingOpen = suggestionOpenPromiseRef.current;
      suggestionOverlayRef.current = false;

      if (!wasVisible) {
        setSuggestionSnapshot(null);
        if (pendingOpen) await pendingOpen;
        if (suggestionRestorePromiseRef.current) await suggestionRestorePromiseRef.current;
        return;
      }
      if (managementTabRef.current) {
        setSuggestionSnapshot(null);
        return;
      }

      const restorePromise = (async () => {
        if (pendingOpen) await pendingOpen;
        if (requestId !== suggestionOverlayRequestIdRef.current || managementTabRef.current) {
          setSuggestionSnapshot(null);
          return;
        }
        await publishViewport(true);
        // La vista nativa vuelve a componer un cuadro despues de recibir el
        // viewport. Retirar el respaldo antes deja el area en blanco y produce
        // el parpadeo visible al cerrar la barra o al navegar.
        await waitForNextPaint();
        if (requestId !== suggestionOverlayRequestIdRef.current) return;
        setSuggestionSnapshot(null);
      })();
      suggestionRestorePromiseRef.current = restorePromise;
      try {
        await restorePromise;
      } finally {
        if (suggestionRestorePromiseRef.current === restorePromise) suggestionRestorePromiseRef.current = null;
      }
      return;
    }

    if (managementTabRef.current || suggestionOverlayRef.current) return;
    const requestId = ++suggestionOverlayRequestIdRef.current;
    if (suggestionRestorePromiseRef.current) await suggestionRestorePromiseRef.current;
    if (requestId !== suggestionOverlayRequestIdRef.current || managementTabRef.current || suggestionOverlayRef.current) return;

    suggestionOverlayRef.current = true;
    const openPromise = (async () => {
      try {
        try {
          const capture = await integratedBrowserService.captureVisible();
          if (requestId !== suggestionOverlayRequestIdRef.current || !suggestionOverlayRef.current) return;
          adoptSnapshotBounds(capture);
          setSuggestionSnapshot(capture.success && capture.screenshot ? capture.screenshot : null);
        } catch {
          if (requestId !== suggestionOverlayRequestIdRef.current || !suggestionOverlayRef.current) return;
          setSuggestionSnapshot(null);
        }

        // Ocultar la vista nativa antes de que el respaldo este pintado deja el
        // area en blanco durante uno o dos cuadros.
        await waitForNextPaint();
        if (requestId !== suggestionOverlayRequestIdRef.current || !suggestionOverlayRef.current) {
          if (!managementTabRef.current) await publishViewport(true);
          return;
        }

        const hidden = await integratedBrowserService.hide();
        if (requestId !== suggestionOverlayRequestIdRef.current || !suggestionOverlayRef.current) {
          if (!managementTabRef.current) await publishViewport(true);
          return;
        }
        if (!hidden.success) {
          suggestionOverlayRef.current = false;
          setSuggestionSnapshot(null);
          consumeResponse(hidden);
          return;
        }
        setLocalError(null);
      } catch (error) {
        if (requestId !== suggestionOverlayRequestIdRef.current) {
          if (!managementTabRef.current) await publishViewport(true);
          return;
        }
        suggestionOverlayRef.current = false;
        setSuggestionSnapshot(null);
        setLocalError(error instanceof Error ? error.message : String(error));
      }
    })();
    suggestionOpenPromiseRef.current = openPromise;
    try {
      await openPromise;
    } finally {
      if (suggestionOpenPromiseRef.current === openPromise) suggestionOpenPromiseRef.current = null;
    }
  }, [consumeResponse, publishViewport]);

  const handleToolsMenuOpenChange = useCallback((open: boolean) => {
    setToolsMenuOpen(open);
    void handleSuggestionsVisibilityChange(open);
  }, [handleSuggestionsVisibilityChange]);

  const handleAppGridOpenChange = useCallback((open: boolean) => {
    setAppGridOpen(open);
    void handleSuggestionsVisibilityChange(open);
  }, [handleSuggestionsVisibilityChange]);

  const refreshToolbarExtensions = useCallback(async () => {
    if (!integratedBrowserService.isAvailable()) return;
    const requestId = ++extensionRequestIdRef.current;
    try {
      const response = await integratedBrowserService.listExtensions();
      if (requestId === extensionRequestIdRef.current && response.success) setToolbarExtensions(response.extensions ?? []);
    } catch {
      // El gestor completo conserva el error y el reintento; la barra no bloquea la navegación.
    }
  }, []);

  const closeManagement = useCallback(async () => {
    const closedTab = managementTabRef.current;
    managementTabRef.current = null;
    setManagementTab(null);
    await waitForNextPaint();
    await publishViewport(true);
    // El respaldo se retira solo cuando la vista nativa ya volvio a pintar.
    await waitForNextPaint();
    if (!managementTabRef.current) setManagementSnapshot(null);
    if (closedTab === 'extensions') await refreshToolbarExtensions();
  }, [publishViewport, refreshToolbarExtensions]);

  const toggleManagement = useCallback(async (tab: BrowserManagementTab) => {
    await handleSuggestionsVisibilityChange(false);
    if (managementTabRef.current === tab) {
      await closeManagement();
      return;
    }
    if (managementTabRef.current) {
      managementTabRef.current = tab;
      setManagementTab(tab);
      return;
    }
    try {
      const capture = await integratedBrowserService.captureVisible();
      if (capture.success && capture.screenshot) {
        adoptSnapshotBounds(capture);
        setManagementSnapshot(capture.screenshot);
      }
    } catch {
      setManagementSnapshot(null);
    }
    managementTabRef.current = tab;
    try {
      await waitForNextPaint();
      const hidden = await integratedBrowserService.hide();
      if (!hidden.success) {
        managementTabRef.current = null;
        setManagementSnapshot(null);
        consumeResponse(hidden);
        return;
      }
      setManagementTab(tab);
    } catch (error) {
      managementTabRef.current = null;
      setManagementSnapshot(null);
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }, [closeManagement, consumeResponse, handleSuggestionsVisibilityChange]);

  const fillCredentialFromManagement = useCallback(async (id: string) => {
    await closeManagement();
    const response = await integratedBrowserService.fillCredential(id);
    consumeResponse(response);
    return response;
  }, [closeManagement, consumeResponse]);

  const closeReadingMode = useCallback(async () => {
    const reading = readingModeRef.current;
    readingModeRef.current = null;
    setReadingContent(null);
    if (!reading) return;
    await integratedBrowserService.closeReadingMode({ readingId: reading.readingId }).catch(() => undefined);
  }, []);

  const openReadingMode = useCallback(async (request: Partial<BrowserReadingModeRequest> = {}) => {
    if (!integratedBrowserService.isAvailable()) return;
    if (readingModeRef.current) await closeReadingMode();
    try {
      const response = await integratedBrowserService.prepareReadingMode({
        sourceUrl: request.url || currentUrlRef.current,
        selection: request.selection || undefined,
      });
      if (!response.success || !response.reading) throw new Error(response.error || 'No se pudo abrir el modo lectura.');
      readingModeRef.current = response.reading;
      setReadingContent(response.reading);
      setLocalError(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }, [closeReadingMode]);

  useEffect(() => {
    if (!integratedBrowserService.isAvailable()) {
      setLocalError('El navegador integrado solo esta disponible en la aplicacion de escritorio.');
      return undefined;
    }

    const unsubscribe = integratedBrowserService.subscribe({
      onStateChanged: (nextState) => {
        currentUrlRef.current = nextState.url;
        setState(nextState);
        if (!addressEditingRef.current) setAddress(nextState.url === 'about:blank' ? '' : nextState.url);
        const reading = readingModeRef.current;
        if (reading && nextState.url !== reading.url) void closeReadingMode();
      },
      onReadingModeRequested: (request) => { void openReadingMode(request); },
    });
    const syncViewport = () => { void publishViewport(); };
    const observer = new ResizeObserver(syncViewport);
    if (viewportRef.current) observer.observe(viewportRef.current);
    const handleWindowResize = syncViewport;
    window.addEventListener('resize', handleWindowResize);

    let canceled = false;
    void (async () => {
      try {
        const response = await integratedBrowserService.open();
        if (canceled) return;
        consumeResponse(response);
        if (response.state?.url) currentUrlRef.current = response.state.url;
        if (!addressEditingRef.current && response.state?.url && response.state.url !== 'about:blank') setAddress(response.state.url);
        await publishViewport();
        const observation = await integratedBrowserService.getObservation(false);
        if (!canceled && observation.observationStatus) setObservationStatus(observation.observationStatus);
      } catch (error) {
        if (!canceled) setLocalError(error instanceof Error ? error.message : String(error));
      }
    })();

    return () => {
      canceled = true;
      extensionRequestIdRef.current += 1;
      suggestionOverlayRequestIdRef.current += 1;
      suggestionOverlayRef.current = false;
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      unsubscribe();
      const reading = readingModeRef.current;
      readingModeRef.current = null;
      if (reading) void integratedBrowserService.closeReadingMode({ readingId: reading.readingId }).catch(() => undefined);
      void integratedBrowserService.hide().catch(() => undefined);
    };
  }, [closeReadingMode, consumeResponse, openReadingMode, publishViewport]);

  useEffect(() => {
    void publishViewport();
  }, [publishViewport, viewportInsetLeft, viewportInsetRight]);

  useEffect(() => {
    if (utilityBarVisible) void refreshToolbarExtensions();
  }, [refreshToolbarExtensions, utilityBarVisible]);

  const run = useCallback(async (operation: () => Promise<IntegratedBrowserResponse>) => {
    try {
      consumeResponse(await operation());
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }, [consumeResponse]);

  const navigate = (target: string) => void run(() => integratedBrowserService.navigate(target));

  const toggleUtilityBar = () => {
    setUtilityBarVisible((visible) => {
      const next = !visible;
      try { localStorage.setItem(scopedPreferenceKey(UTILITY_BAR_STORAGE_KEY), String(next)); } catch { /* preferencia no persistible */ }
      return next;
    });
  };

  const toggleObservation = () => {
    void (async () => {
      try {
        const response = await integratedBrowserService.setObservationEnabled(!observationStatus.enabled);
        consumeResponse(response);
        if (response.observationStatus) setObservationStatus(response.observationStatus);
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : String(error));
      }
    })();
  };

  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;

  return (
    <section ref={rootRef} className="relative flex h-full min-h-0 flex-1 flex-col bg-background dark:bg-background-dark" aria-label="Navegador integrado">
      <BrowserTabStrip
        tabs={state.tabs}
        activeTabId={state.activeTabId}
        secondaryTabId={state.secondaryTabId}
        viewMode={state.viewMode}
        onActivateTab={(tabId) => void run(() => integratedBrowserService.activateTab(tabId))}
        onCloseTab={(tabId) => void run(() => integratedBrowserService.closeTab(tabId))}
        onCreateTab={() => void run(() => integratedBrowserService.createTab())}
        onSetViewMode={(mode, secId) => void run(() => integratedBrowserService.setViewMode(mode, secId))}
        activeTab={activeTab}
        onReattachTab={(tabId) => void run(() => integratedBrowserService.reattachTab(tabId))}
        onDetachTab={(tabId) => void run(() => integratedBrowserService.detachTab(tabId))}
        maximized={props.maximized}
        onToggleMaximize={props.onToggleMaximize}
        onCloseBrowser={props.onClose}
      />
      <header
        className="relative z-50 flex flex-col gap-2 border-b border-gray-200/80 bg-white/95 px-3 py-2 shadow-xs dark:border-white/[0.08] dark:bg-[#0d1117]/95"
        data-testid="integrated-browser-toolbar"
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-gray-200/80 bg-gray-50/80 p-1 shadow-xs backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.03]">
            <BrowserIconButton label="Atras" disabled={!state.canGoBack} onClick={() => void run(integratedBrowserService.goBack)}>
              <path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </BrowserIconButton>
            <BrowserIconButton label="Adelante" disabled={!state.canGoForward} onClick={() => void run(integratedBrowserService.goForward)}>
              <path d="M9 18l6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </BrowserIconButton>
            <BrowserIconButton
              label={state.isLoading ? 'Detener carga' : 'Recargar'}
              onClick={() => void run(state.isLoading ? integratedBrowserService.stop : integratedBrowserService.reload)}
            >
              {state.isLoading ? (
                <rect x="7" y="7" width="10" height="10" rx="1.5" strokeWidth="2" />
              ) : (
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </BrowserIconButton>
          </div>
          <BrowserAddressBar
            address={address}
            currentUrl={state.url}
            onAddressChange={setAddress}
            onEditingChange={(editing) => { addressEditingRef.current = editing; }}
            onNavigate={navigate}
            onSuggestionsVisibilityChange={handleSuggestionsVisibilityChange}
          />
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-gray-200/80 bg-gray-50/80 p-1 shadow-xs backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.03]">
            <BrowserAppGridMenu
              open={appGridOpen}
              onOpenChange={handleAppGridOpenChange}
              onNavigate={navigate}
              favorites={bookmarks.favorites}
            />
            <BrowserBookmarkToggle bookmarks={bookmarks} />
            <BrowserExtensionsBar extensions={toolbarExtensions} onOpenExtensions={() => void toggleManagement('extensions')} />
            <BrowserIconButton
              label={observationStatus.enabled ? 'Pausar percepción de SofLIA' : 'Activar percepción de SofLIA'}
              active={observationStatus.enabled}
              onClick={toggleObservation}
            >
              {observationStatus.enabled ? (
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" /><line x1="3" y1="3" x2="21" y2="21" strokeWidth="1.8" strokeLinecap="round" /></>
              )}
            </BrowserIconButton>
            <BrowserIconButton
              label={readingContent ? 'Cerrar modo lectura' : 'Abrir modo lectura'}
              active={Boolean(readingContent)}
              disabled={!state.activeTabId || state.url === 'about:blank'}
              onClick={() => { void (readingContent ? closeReadingMode() : openReadingMode()); }}
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </BrowserIconButton>
            <BrowserToolsMenu
              open={toolsMenuOpen}
              onOpenChange={handleToolsMenuOpenChange}
              items={[
                { id: 'bookmarks', label: 'Marcadores', active: utilityBarVisible, icon: <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>, onSelect: toggleUtilityBar },
                { id: 'history', label: 'Historial', active: managementTab === 'history', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth="1.8" /><path d="M12 7v5l3 2M5 5l-2 2" strokeWidth="1.8" strokeLinecap="round" /></svg>, onSelect: () => void toggleManagement('history') },
                { id: 'credentials', label: 'Contraseñas', active: managementTab === 'credentials', icon: <svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4" strokeWidth="1.8" /><path d="M11 12l8-8M15 8l2 2M17 6l2 2" strokeWidth="1.8" strokeLinecap="round" /></svg>, onSelect: () => void toggleManagement('credentials') },
                { id: 'extensions', label: 'Extensiones', active: managementTab === 'extensions', icon: <svg viewBox="0 0 24 24"><path d="M8 3h5v5a2 2 0 104 0V3h4v7h-5a2 2 0 100 4h5v7h-7v-5a2 2 0 10-4 0v5H3v-7h5a2 2 0 100-4H3V3h5z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>, onSelect: () => void toggleManagement('extensions') },
                { id: 'privacy', label: 'Borrar datos', active: managementTab === 'privacy', icon: <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>, onSelect: () => void toggleManagement('privacy') },
                { id: 'devtools', label: 'Inspeccionar', icon: <svg viewBox="0 0 24 24"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>, onSelect: () => void run(integratedBrowserService.toggleDevTools) },
              ]}
            />
          </div>
        </div>
        {(utilityBarVisible || state.agentControlling) && (
          <div className="flex flex-col gap-1.5">
            {state.agentControlling && (
              <div className="flex items-center gap-2 px-1 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse" />
                <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-0.5 font-semibold text-accent">
                  SofLIA controla esta vista
                </span>
              </div>
            )}
            {utilityBarVisible && (
              <BrowserBookmarksBar bookmarks={bookmarks} onNavigate={navigate} />
            )}
          </div>
        )}
        {(localError || state.error) && (
          <div role="alert" className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger">
            {localError || state.error}
          </div>
        )}
      </header>
      {readingContent && (
        <BrowserReadingModePanel
          key={readingContent.readingId}
          content={readingContent}
          onClose={() => { void closeReadingMode(); }}
        />
      )}
      <div ref={viewportRef} className="relative z-0 min-h-0 flex-1 bg-white dark:bg-[#111820]" data-testid="integrated-browser-viewport">
        {(managementSnapshot ?? suggestionSnapshot) && (
          <div
            className="pointer-events-none absolute overflow-hidden bg-white dark:bg-[#111820]"
            data-testid="integrated-browser-snapshot"
            style={snapshotStyle ?? { inset: 0, left: viewportInsetLeft, right: viewportInsetRight }}
          >
            <img
              src={managementSnapshot ?? suggestionSnapshot ?? ''}
              alt="Vista actual del navegador"
              className="h-full w-full object-fill object-top"
            />
          </div>
        )}
        {state.isLoading && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-accent/15">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
          </div>
        )}
        <div className="grid h-full place-items-center text-sm text-gray-400 dark:text-white/30">
          Preparando navegador seguro...
        </div>
      </div>
      {managementTab && (
        <BrowserManagementPanel
          tab={managementTab}
          onTabChange={(tab) => { managementTabRef.current = tab; setManagementTab(tab); }}
          onClose={() => void closeManagement()}
          onFillCredential={fillCredentialFromManagement}
        />
      )}
    </section>
  );
}

function readStoredUtilityBarVisible(): boolean {
  try { return localStorage.getItem(scopedPreferenceKey(UTILITY_BAR_STORAGE_KEY)) !== 'false'; } catch { return true; }
}



function BrowserIconButton(props: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`group relative grid h-8.5 w-8.5 shrink-0 place-items-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 ${
        props.active
          ? 'bg-accent/15 text-accent shadow-xs shadow-accent/20 font-semibold'
          : props.danger
          ? 'text-gray-600 hover:bg-danger/10 hover:text-danger dark:text-white/70'
          : 'text-gray-600 hover:bg-white hover:text-accent hover:shadow-xs dark:text-white/70 dark:hover:bg-white/[0.1] dark:hover:text-accent'
      }`}
    >
      <svg className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {props.children}
      </svg>
      {props.active && (
        <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-emerald-400 ring-2 ring-white/90 dark:ring-[#0d1117]" />
      )}
    </button>
  );
}
