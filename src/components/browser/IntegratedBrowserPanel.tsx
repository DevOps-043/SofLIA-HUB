import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMPTY_INTEGRATED_BROWSER_STATE,
  integratedBrowserService,
  type BrowserExtensionMetadata,
  type BrowserObservationStatus,
  type IntegratedBrowserResponse,
  type IntegratedBrowserState,
  type IntegratedBrowserViewMode,
} from '../../services/integrated-browser-service';
import { BrowserManagementPanel, type BrowserManagementTab } from './BrowserManagementPanel';
import { BrowserAddressBar } from './BrowserAddressBar';
import { BrowserQuickAccessBar } from './BrowserQuickAccessBar';

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
  const extensionRequestIdRef = useRef(0);
  const addressEditingRef = useRef(false);
  const managementTabRef = useRef<BrowserManagementTab | null>(null);
  const suggestionOverlayRef = useRef(false);
  const suggestionOverlayRequestIdRef = useRef(0);
  const suggestionOpenPromiseRef = useRef<Promise<void> | null>(null);
  const suggestionRestorePromiseRef = useRef<Promise<void> | null>(null);
  const [state, setState] = useState<IntegratedBrowserState>(EMPTY_INTEGRATED_BROWSER_STATE);
  const [address, setAddress] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [managementTab, setManagementTab] = useState<BrowserManagementTab | null>(null);
  const [managementSnapshot, setManagementSnapshot] = useState<string | null>(null);
  const [suggestionSnapshot, setSuggestionSnapshot] = useState<string | null>(null);
  const [utilityBarVisible, setUtilityBarVisible] = useState(readStoredUtilityBarVisible);
  const [toolbarExtensions, setToolbarExtensions] = useState<BrowserExtensionMetadata[]>([]);
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
      if (capture.success && capture.screenshot) setManagementSnapshot(capture.screenshot);
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

  useEffect(() => {
    if (!integratedBrowserService.isAvailable()) {
      setLocalError('El navegador integrado solo esta disponible en la aplicacion de escritorio.');
      return undefined;
    }

    const unsubscribe = integratedBrowserService.subscribe({
      onStateChanged: (nextState) => {
        setState(nextState);
        if (!addressEditingRef.current) setAddress(nextState.url === 'about:blank' ? '' : nextState.url);
      },
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
      void integratedBrowserService.hide().catch(() => undefined);
    };
  }, [consumeResponse, publishViewport]);

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
      try { localStorage.setItem(UTILITY_BAR_STORAGE_KEY, String(next)); } catch { /* preferencia no persistible */ }
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
      <header
        className="relative z-50 flex flex-col gap-2 border-b border-gray-200/80 bg-white/95 px-3 py-2.5 shadow-sm dark:border-white/[0.08] dark:bg-[#0d1117]/95"
        data-testid="integrated-browser-toolbar"
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex shrink-0 items-center rounded-xl border border-gray-200 bg-gray-50/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <BrowserIconButton label="Atras" disabled={!state.canGoBack} onClick={() => void run(integratedBrowserService.goBack)}>
            <path d="M15 18l-6-6 6-6" />
          </BrowserIconButton>
          <BrowserIconButton label="Adelante" disabled={!state.canGoForward} onClick={() => void run(integratedBrowserService.goForward)}>
            <path d="M9 18l6-6-6-6" />
          </BrowserIconButton>
          <BrowserIconButton
            label={state.isLoading ? 'Detener carga' : 'Recargar'}
            onClick={() => void run(state.isLoading ? integratedBrowserService.stop : integratedBrowserService.reload)}
          >
            {state.isLoading
              ? <path d="M8 8h8v8H8z" />
              : <path d="M20 11a8.1 8.1 0 10.5 4M20 4v7h-7" />}
          </BrowserIconButton>
          </div>
          <BrowserAddressBar
            address={address}
            onAddressChange={setAddress}
            onEditingChange={(editing) => { addressEditingRef.current = editing; }}
            onNavigate={navigate}
            onSuggestionsVisibilityChange={handleSuggestionsVisibilityChange}
          />
          <div className="flex shrink-0 items-center rounded-xl border border-gray-200 bg-gray-50/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <BrowserIconButton
              label={observationStatus.enabled ? 'Pausar percepción de SofLIA' : 'Activar percepción de SofLIA'}
              active={observationStatus.enabled}
              onClick={toggleObservation}
            >
              {observationStatus.enabled
                ? <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></>
                : <><path d="M3 3l18 18" /><path d="M10.6 6.2A11.8 11.8 0 0112 6c6.5 0 10 6 10 6a15.8 15.8 0 01-2.1 2.8M6.5 6.5C3.6 8.3 2 12 2 12s3.5 6 10 6a10.9 10.9 0 004.1-.8" /></>}
            </BrowserIconButton>
            <BrowserIconButton label={utilityBarVisible ? 'Ocultar barra de herramientas' : 'Mostrar barra de herramientas'} onClick={toggleUtilityBar}>
              {utilityBarVisible ? <><path d="M4 7h16M7 12h10M10 17h4" /><path d="M18 15l3 3M21 15l-3 3" /></> : <><path d="M4 7h16M7 12h10M10 17h4" /><path d="M18 15l3 3 3-3" /></>}
            </BrowserIconButton>
            {activeTab && (
              <BrowserIconButton
                label={activeTab.isDetached ? 'Integrar pestaña en SofLIA' : 'Separar pestaña en otra ventana'}
                active={activeTab.isDetached}
                onClick={() => void run(() => activeTab.isDetached
                  ? integratedBrowserService.reattachTab(activeTab.id)
                  : integratedBrowserService.detachTab(activeTab.id))}
              >
                {activeTab.isDetached
                  ? <><path d="M5 5h14v14H5z" /><path d="M9 9h6v6H9" /></>
                  : <><path d="M4 8h12v12H4z" /><path d="M9 4h11v11M14 4h6v6" /></>}
              </BrowserIconButton>
            )}
            {props.onToggleMaximize && (
              <BrowserIconButton label={props.maximized ? 'Restaurar panel' : 'Expandir navegador'} onClick={props.onToggleMaximize}>
                {props.maximized
                  ? <><path d="M9 4v5H4M15 20v-5h5M4 9l5-5M20 15l-5 5" /></>
                  : <><path d="M9 4H4v5M15 20h5v-5M4 4l6 6M20 20l-6-6" /></>}
              </BrowserIconButton>
            )}
            {props.onClose && (
              <BrowserIconButton label="Cerrar navegador" danger onClick={props.onClose}>
                <path d="M6 6l12 12M18 6L6 18" />
              </BrowserIconButton>
            )}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]" aria-label="Pestañas del navegador">
            <div className="flex min-w-max items-center gap-1">
              {state.tabs.map((tab) => {
                const active = tab.id === state.activeTabId;
                const secondary = tab.id === state.secondaryTabId && state.viewMode !== 'single';
                return (
                  <div
                    key={tab.id}
                    style={{ contentVisibility: 'auto', contain: 'layout paint style' }}
                    className={`group flex h-8 max-w-[220px] items-center rounded-[10px] border transition ${active ? 'border-accent/30 bg-accent/10 text-accent' : secondary ? 'border-sky-400/25 bg-sky-400/10 text-sky-600 dark:text-sky-300' : 'border-transparent bg-gray-100/70 text-secondary hover:border-gray-200 dark:bg-white/[0.04] dark:hover:border-white/[0.09]'}`}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={`${tab.title || 'Nueva pestaña'}${tab.isDetached ? ', ventana separada' : tab.isSuspended ? ', suspendida' : ''}`}
                      title={`${tab.title || tab.url}${tab.isDetached ? ' · Ventana separada' : tab.isSuspended ? ' · Se restaurará al abrir' : ''}`}
                      onClick={() => void run(() => integratedBrowserService.activateTab(tab.id))}
                      className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-left text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tab.isLoading ? 'animate-pulse bg-amber-400' : tab.isDetached ? 'bg-sky-500 ring-2 ring-sky-500/20' : active ? 'bg-accent' : tab.isSuspended ? 'border border-current bg-transparent opacity-55' : 'bg-gray-400/60'}`} />
                      <span className="truncate">{tab.title || 'Nueva pestaña'}</span>
                    </button>
                    {!active && (
                      <button
                        type="button"
                        aria-label={`Mostrar ${tab.title || 'pestaña'} junto a la activa`}
                        title="Mostrar junto"
                        onClick={() => void run(() => integratedBrowserService.setViewMode(state.viewMode === 'overlay' ? 'overlay' : 'split', tab.id))}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg opacity-60 transition hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-white/10"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h7v14H4zM13 5h7v14h-7z" /></svg>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Cerrar ${tab.title || 'pestaña'}`}
                      title="Cerrar pestaña"
                      onClick={() => void run(() => integratedBrowserService.closeTab(tab.id))}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg opacity-55 transition hover:bg-danger/10 hover:text-danger hover:opacity-100 focus-visible:opacity-100"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                aria-label="Nueva pestaña"
                title="Nueva pestaña"
                onClick={() => void run(() => integratedBrowserService.createTab())}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-secondary transition hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center rounded-xl border border-gray-200 bg-gray-50/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.03]" aria-label="Composición de pestañas">
            <ViewModeButton mode="single" current={state.viewMode} label="Una pestaña" onSelect={(mode) => void run(() => integratedBrowserService.setViewMode(mode))} />
            <ViewModeButton mode="split" current={state.viewMode} label="Pantalla dividida" onSelect={(mode) => void run(() => integratedBrowserService.setViewMode(mode))} />
            <ViewModeButton mode="overlay" current={state.viewMode} label="Pestaña superpuesta" onSelect={(mode) => void run(() => integratedBrowserService.setViewMode(mode))} />
          </div>
        </div>
        {utilityBarVisible && <div className="flex min-w-0 items-center gap-2">
          <div className="hidden min-w-0 max-w-[13rem] shrink-0 items-center gap-2 px-1 text-xs text-gray-500 dark:text-white/50 sm:flex">
            <span className={`h-2 w-2 shrink-0 rounded-full ${state.agentControlling ? 'animate-pulse bg-accent' : state.isLoading ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'}`} />
            <span className="truncate">{state.title || 'Navegador integrado'}</span>
            {state.agentControlling && (
              <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">
                SofLIA controla esta vista
              </span>
            )}
          </div>
          <BrowserQuickAccessBar
            currentUrl={state.url}
            currentTitle={state.title}
            extensions={toolbarExtensions}
            onNavigate={navigate}
            onOpenExtensions={() => void toggleManagement('extensions')}
          />
          <nav className="flex shrink-0 items-center gap-1 overflow-x-auto" aria-label="Herramientas del navegador">
            {!props.chatVisible && props.onShowChat && (
              <ManagementButton label="Mostrar chat" onClick={props.onShowChat}>
              <svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z" /></svg><span className="hidden xl:inline">Chat</span>
              </ManagementButton>
            )}
            <ManagementButton label="Historial" active={managementTab === 'history'} onClick={() => void toggleManagement('history')}>
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M5 5l-2 2" /></svg><span className="hidden xl:inline">Historial</span>
            </ManagementButton>
            <ManagementButton label="Contrasenas" active={managementTab === 'credentials'} onClick={() => void toggleManagement('credentials')}>
              <svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M15 8l2 2M17 6l2 2" /></svg><span className="hidden xl:inline">Contrasenas</span>
            </ManagementButton>
            <ManagementButton label="Extensiones" active={managementTab === 'extensions'} onClick={() => void toggleManagement('extensions')}>
              <svg viewBox="0 0 24 24"><path d="M8 3h5v5a2 2 0 104 0V3h4v7h-5a2 2 0 100 4h5v7h-7v-5a2 2 0 10-4 0v5H3v-7h5a2 2 0 100-4H3V3h5z" /></svg><span className="hidden xl:inline">Extensiones</span>
            </ManagementButton>
          </nav>
        </div>}
        {(localError || state.error) && (
          <div role="alert" className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger">
            {localError || state.error}
          </div>
        )}
      </header>
      <div ref={viewportRef} className="relative z-0 min-h-0 flex-1 bg-white dark:bg-[#111820]" data-testid="integrated-browser-viewport">
        {(managementSnapshot ?? suggestionSnapshot) && (
          <div
            className="pointer-events-none absolute inset-y-0 overflow-hidden bg-white dark:bg-[#111820]"
            data-testid="integrated-browser-snapshot"
            style={{ left: viewportInsetLeft, right: viewportInsetRight }}
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
  try { return localStorage.getItem(UTILITY_BAR_STORAGE_KEY) !== 'false'; } catch { return true; }
}

function ViewModeButton(props: {
  mode: IntegratedBrowserViewMode;
  current: IntegratedBrowserViewMode;
  label: string;
  onSelect: (mode: IntegratedBrowserViewMode) => void;
}) {
  const active = props.mode === props.current;
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-pressed={active}
      onClick={() => props.onSelect(props.mode)}
      className={`grid h-8 w-8 place-items-center rounded-[9px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? 'bg-white text-accent shadow-sm dark:bg-white/[0.1]' : 'text-secondary hover:text-accent'}`}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {props.mode === 'single' && <rect x="4" y="5" width="16" height="14" rx="2" />}
        {props.mode === 'split' && <><rect x="3" y="5" width="8" height="14" rx="1.5" /><rect x="13" y="5" width="8" height="14" rx="1.5" /></>}
        {props.mode === 'overlay' && <><rect x="3" y="5" width="16" height="14" rx="2" /><rect x="11" y="9" width="10" height="8" rx="1.5" /></>}
      </svg>
    </button>
  );
}

function ManagementButton(props: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] ${props.active ? 'bg-accent/12 text-accent' : 'text-gray-600 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-white/[0.06]'}`}
    >
      {props.children}
    </button>
  );
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
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 ${props.active ? 'bg-accent/12 text-accent' : props.danger ? 'text-gray-600 hover:bg-danger/10 hover:text-danger dark:text-white/70' : 'text-gray-600 hover:bg-white hover:shadow-sm dark:text-white/70 dark:hover:bg-white/[0.08]'}`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {props.children}
      </svg>
      {props.active && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 ring-2 ring-white/80 dark:ring-[#0d1117]" />}
    </button>
  );
}
