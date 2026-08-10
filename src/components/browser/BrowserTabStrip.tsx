import { useMemo, useRef, useState } from 'react';
import {
  integratedBrowserService,
  type IntegratedBrowserTabState,
  type IntegratedBrowserViewMode,
} from '../../services/integrated-browser-service';
import { WindowControls } from '../ui/WindowControls';

interface BrowserTabStripProps {
  tabs: IntegratedBrowserTabState[];
  activeTabId: string | null;
  secondaryTabId: string | null;
  viewMode: IntegratedBrowserViewMode;
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: () => void;
  onSetViewMode: (mode: IntegratedBrowserViewMode, secondaryTabId?: string) => void;
  activeTab?: IntegratedBrowserTabState | null;
  onReattachTab?: (tabId: string) => void;
  onDetachTab?: (tabId: string) => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  onCloseBrowser?: () => void;
}

function TabFavicon({ url, isLoading, isDetached, active, isSuspended }: { url: string; isLoading: boolean; isDetached: boolean; active: boolean; isSuspended: boolean }) {
  const [failed, setFailed] = useState(false);
  const domain = useMemo(() => {
    try {
      if (!url || url === 'about:blank') return '';
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname;
    } catch {
      return '';
    }
  }, [url]);

  if (isLoading) {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full animate-pulse bg-amber-400" />;
  }

  if (domain && !failed) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    return (
      <img
        src={faviconUrl}
        alt=""
        onError={() => setFailed(true)}
        className="h-3.5 w-3.5 shrink-0 rounded-xs object-contain transition-transform duration-200 group-hover:scale-110 pointer-events-none"
      />
    );
  }

  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125 pointer-events-none ${
        isDetached
          ? 'bg-sky-500 ring-2 ring-sky-500/20'
          : active
          ? 'bg-accent'
          : isSuspended
          ? 'border border-current bg-transparent opacity-55'
          : 'bg-gray-400/60'
      }`}
    />
  );
}

export function BrowserTabStrip(props: BrowserTabStripProps) {
  const {
    tabs,
    activeTabId,
    secondaryTabId,
    viewMode,
    onActivateTab,
    onCloseTab,
    onCreateTab,
    onSetViewMode,
    activeTab,
    onReattachTab,
    onDetachTab,
    maximized,
    onToggleMaximize,
    onCloseBrowser,
  } = props;

  // Orden provisional MIENTRAS se arrastra. Fuera del arrastre manda el de
  // main: derivarlo evita el efecto de sincronizacion, que dejaba la tira
  // desfasada un render y podia mostrar un orden que ya no existia.
  const [ordenArrastre, setOrdenArrastre] = useState<IntegratedBrowserTabState[] | null>(null);
  const [dragState, setDragState] = useState<{
    tabId: string;
    startX: number;
    currentX: number;
    hasMoved: boolean;
  } | null>(null);

  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  /** Orden vivo durante el arrastre, para decidir el intercambio sin leer estado. */
  const ordenRef = useRef<IntegratedBrowserTabState[]>(tabs);

  const displayTabs = ordenArrastre ?? tabs;

  /**
   * Arrastre de pestanas al estilo de Chrome.
   *
   * Se usa Pointer Events con captura para que el gesto no se pierda al salir
   * de la pestana, pero el fin del arrastre se escucha en la VENTANA, no en el
   * nodo. Escucharlo solo en el nodo dependia de conservar la captura, y aqui
   * se pierde con facilidad: el contenido web es una `WebContentsView` NATIVA
   * por encima del renderer, asi que al soltar sobre ella el `pointerup` nunca
   * llegaba al DOM. El arrastre no terminaba y la pestana se quedaba clavada
   * fuera de sitio, que es exactamente el fallo reportado.
   *
   * El reordenamiento se calcula FUERA del updater de estado. Llamar al IPC
   * dentro de `setState` lo ejecutaba durante la fase de render: si esa
   * llamada lanzaba —y lanzaba, porque el canal no estaba en la allowlist—
   * el error tumbaba el arbol de React y la aplicacion se quedaba en blanco.
   */
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, tabId: string) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button[aria-label^="Cerrar"]') || target.closest('button[aria-label^="Dividir"]')) {
      return;
    }

    event.preventDefault();
    const nodo = event.currentTarget;
    try {
      nodo.setPointerCapture(event.pointerId);
    } catch {
      // Sin captura el arrastre sigue funcionando mientras el puntero no
      // abandone la pestana; no es motivo para cancelarlo.
    }

    let origenX = event.clientX;
    let movido = false;

    ordenRef.current = tabs;
    setOrdenArrastre(tabs);
    setDragState({ tabId, startX: origenX, currentX: event.clientX, hasMoved: false });

    const alMover = (movimiento: PointerEvent) => {
      if (movimiento.pointerId !== event.pointerId) return;
      // Ultima red: si vuelve el puntero sin ningun boton pulsado, el usuario
      // ya solto —probablemente sobre la vista nativa del navegador, donde el
      // `pointerup` no llega al DOM— y el arrastre debe cerrarse aqui.
      if (movimiento.buttons === 0) {
        terminar(false);
        return;
      }
      const actualX = movimiento.clientX;
      if (Math.abs(actualX - origenX) > 4) movido = true;

      // El intercambio se decide aqui, con el orden actual y las medidas
      // reales, y solo despues se aplica al estado y se avisa a main.
      const orden = ordenRef.current;
      const indice = orden.findIndex((pestana) => pestana.id === tabId);
      let intercambio: { siguiente: IntegratedBrowserTabState[]; vecinoId: string } | null = null;

      if (indice > 0) {
        const vecino = orden[indice - 1];
        const caja = tabRefs.current.get(vecino.id)?.getBoundingClientRect();
        if (caja && actualX < caja.left + caja.width / 2) {
          const propia = tabRefs.current.get(tabId)?.getBoundingClientRect();
          origenX -= (propia?.width ?? caja.width) + 4;
          const siguiente = [...orden];
          const [movida] = siguiente.splice(indice, 1);
          siguiente.splice(indice - 1, 0, movida);
          intercambio = { siguiente, vecinoId: vecino.id };
        }
      }

      if (!intercambio && indice !== -1 && indice < orden.length - 1) {
        const vecino = orden[indice + 1];
        const caja = tabRefs.current.get(vecino.id)?.getBoundingClientRect();
        if (caja && actualX > caja.left + caja.width / 2) {
          const propia = tabRefs.current.get(tabId)?.getBoundingClientRect();
          origenX += (propia?.width ?? caja.width) + 4;
          const siguiente = [...orden];
          const [movida] = siguiente.splice(indice, 1);
          siguiente.splice(indice + 1, 0, movida);
          intercambio = { siguiente, vecinoId: vecino.id };
        }
      }

      if (intercambio) {
        ordenRef.current = intercambio.siguiente;
        setOrdenArrastre(intercambio.siguiente);
        // Un fallo del puente no puede tumbar la interfaz: el orden local ya
        // se aplico y el usuario ve su arrastre aunque main no lo reciba.
        try {
          void integratedBrowserService.reorderTabs(tabId, intercambio.vecinoId).catch((error) => {
            console.warn('[Navegador] No se pudo reordenar la pestana:', error);
          });
        } catch (error) {
          console.warn('[Navegador] No se pudo reordenar la pestana:', error);
        }
      }

      setDragState({ tabId, startX: origenX, currentX: actualX, hasMoved: movido });
    };

    let terminado = false;
    const terminar = (activar: boolean) => {
      if (terminado) return;
      terminado = true;

      window.removeEventListener('pointermove', alMover, true);
      window.removeEventListener('pointerup', alSoltar, true);
      window.removeEventListener('pointercancel', alSoltar, true);
      window.removeEventListener('blur', alPerderFoco);
      nodo.removeEventListener('lostpointercapture', alPerderCaptura);
      try {
        nodo.releasePointerCapture(event.pointerId);
      } catch { /* ya liberado */ }

      if (activar && !movido) onActivateTab(tabId);
      setDragState(null);
      // A partir de aqui vuelve a mandar el orden que reporta main.
      setOrdenArrastre(null);
    };

    const alSoltar = (fin: PointerEvent) => {
      if (fin.pointerId !== event.pointerId) return;
      terminar(true);
    };

    // Si la ventana pierde el foco —tipico al soltar sobre la vista nativa del
    // navegador— el arrastre se cierra igual en vez de quedarse colgado.
    const alPerderFoco = () => terminar(false);
    // Y si el navegador retira la captura (el nodo se mueve en el DOM al
    // reordenar), tampoco se puede esperar un `pointerup` que ya no llegara.
    const alPerderCaptura = () => terminar(false);

    // En la ventana y en fase de captura: asi se recibe aunque el evento
    // termine en otro elemento o la captura del puntero se haya perdido.
    window.addEventListener('pointermove', alMover, true);
    window.addEventListener('pointerup', alSoltar, true);
    window.addEventListener('pointercancel', alSoltar, true);
    window.addEventListener('blur', alPerderFoco);
    nodo.addEventListener('lostpointercapture', alPerderCaptura);
  };

  return (
    <div
      className="relative z-50 flex h-10 select-none items-center justify-between border-b border-gray-200/80 bg-[#e4e7eb] px-2 pt-1 dark:border-white/[0.08] dark:bg-[#070a0f] [app-region:drag] [-webkit-app-region:drag]"
      data-testid="browser-tab-strip"
    >
      {/* Tira de pestañas responsive con reajuste perfecto continuo estilo Chrome */}
      <div
        className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto pr-2 [scrollbar-width:none] [app-region:drag] [-webkit-app-region:drag]"
        aria-label="Pestañas del navegador"
      >
        {displayTabs.map((tab) => {
          const active = tab.id === activeTabId;
          const secondary = tab.id === secondaryTabId && viewMode === 'split';
          const isDragged = dragState?.tabId === tab.id;
          const deltaX = isDragged && dragState ? dragState.currentX - dragState.startX : 0;

          return (
            <div
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              onPointerDown={(event) => handlePointerDown(event, tab.id)}
              style={{
                contentVisibility: 'auto',
                contain: 'layout paint style',
                transform: isDragged ? `translate3d(${deltaX}px, 0, 0)` : 'translate3d(0, 0, 0)',
                transition: isDragged ? 'none' : 'transform 150ms ease-out, background-color 150ms ease-out',
                zIndex: isDragged ? 50 : active ? 10 : 1,
              }}
              className={`group relative flex h-8 flex-1 min-w-[40px] max-w-[200px] items-center rounded-t-[9px] border-t border-x px-2 cursor-grab active:cursor-grabbing [app-region:no-drag] [-webkit-app-region:no-drag] ${
                isDragged
                  ? 'bg-white shadow-xl ring-2 ring-accent border-accent text-accent scale-[1.02] dark:bg-[#161b22]'
                  : active
                  ? 'border-gray-200/80 bg-white text-gray-900 font-semibold shadow-xs dark:border-white/10 dark:bg-[#0d1117] dark:text-white'
                  : secondary
                  ? 'border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                  : 'border-transparent bg-transparent text-gray-600 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/5'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${tab.title || 'Nueva pestaña'}${tab.isDetached ? ', ventana separada' : tab.isSuspended ? ', suspendida' : ''}`}
                title={`${tab.title || tab.url}${tab.isDetached ? ' · Ventana separada' : tab.isSuspended ? ' · Se restaurará al abrir' : ''}`}
                onClick={() => {
                  if (dragState?.hasMoved) return;
                  onActivateTab(tab.id);
                }}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs outline-none select-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <TabFavicon
                  url={tab.url}
                  isLoading={tab.isLoading}
                  isDetached={tab.isDetached}
                  active={active}
                  isSuspended={tab.isSuspended}
                />
                <span className="truncate min-w-0 flex-1">{tab.title || 'Nueva pestaña'}</span>
              </button>

              {!active && (
                <button
                  type="button"
                  aria-label={`Dividir pantalla con ${tab.title || 'pestaña'}`}
                  title="Dividir pantalla 50/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetViewMode('split', tab.id);
                  }}
                  className="ml-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded opacity-0 transition-all duration-150 group-hover:opacity-70 hover:!opacity-100 hover:bg-black/10 dark:hover:bg-white/15 hover:scale-110"
                >
                  <svg className="h-3 w-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="4" width="8.5" height="16" rx="1.5" />
                    <rect x="12.5" y="4" width="8.5" height="16" rx="1.5" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                aria-label={`Cerrar ${tab.title || 'pestaña'}`}
                title="Cerrar pestaña"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="ml-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full opacity-60 transition-all duration-150 hover:bg-danger/20 hover:text-danger hover:opacity-100 hover:rotate-90 hover:scale-110"
              >
                <svg className="h-3 w-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}

        {/* Botón Nueva Pestaña SIEMPRE visible al lado de las pestañas */}
        <button
          type="button"
          aria-label="Nueva pestaña"
          title="Nueva pestaña"
          onClick={onCreateTab}
          className="mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-600 transition-all duration-200 hover:bg-black/10 hover:text-accent hover:scale-110 active:scale-90 focus-visible:outline-none dark:text-gray-300 dark:hover:bg-white/10 [app-region:no-drag] [-webkit-app-region:no-drag]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Controles de Vista & Ventana a la derecha */}
      <div className="flex shrink-0 items-center gap-1.5 pl-2 [app-region:no-drag] [-webkit-app-region:no-drag]">
        <div className="flex items-center rounded-xl border border-gray-200/80 bg-white/70 p-0.5 shadow-xs backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]" aria-label="Composición de pestañas">
          <ViewModeButton mode="single" current={viewMode} label="Una pestaña" onSelect={(mode) => onSetViewMode(mode)} />
          <ViewModeButton mode="split" current={viewMode} label="Pantalla dividida" onSelect={(mode) => onSetViewMode(mode)} />

          {activeTab && onReattachTab && onDetachTab && (
            <TabIconButton
              label={activeTab.isDetached ? 'Integrar pestaña en SofLIA' : 'Separar pestaña en otra ventana'}
              active={activeTab.isDetached}
              onClick={() => (activeTab.isDetached ? onReattachTab(activeTab.id) : onDetachTab(activeTab.id))}
            >
              {activeTab.isDetached ? (
                <><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.6" /><rect x="8" y="8" width="8" height="8" rx="1.5" strokeWidth="1.6" /></>
              ) : (
                <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><polyline points="15 3 21 3 21 9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><line x1="10" y1="14" x2="21" y2="3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>
              )}
            </TabIconButton>
          )}
          {onToggleMaximize && (
            <TabIconButton label={maximized ? 'Restaurar panel' : 'Expandir navegador'} onClick={onToggleMaximize}>
              {maximized ? (
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </TabIconButton>
          )}
          {onCloseBrowser && (
            <TabIconButton label="Cerrar navegador" danger onClick={onCloseBrowser}>
              <path d="M18 6L6 18M6 6l12 12" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </TabIconButton>
          )}
        </div>

        {/* Controles de ventana nativa */}
        <WindowControls className="h-9 -mr-2" />
      </div>
    </div>
  );
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
      className={`grid h-7 w-7 place-items-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
        active
          ? 'bg-white text-accent shadow-xs dark:bg-white/[0.14]'
          : 'text-gray-500 hover:text-accent dark:text-gray-400'
      }`}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {props.mode === 'single' && <rect x="3" y="4" width="18" height="16" rx="2.5" />}
        {props.mode === 'split' && (
          <><rect x="3" y="4" width="8.5" height="16" rx="2" /><rect x="12.5" y="4" width="8.5" height="16" rx="2" /></>
        )}
      </svg>
    </button>
  );
}

function TabIconButton(props: {
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
      className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 ${
        props.active
          ? 'bg-accent/15 text-accent shadow-xs shadow-accent/20 font-semibold'
          : props.danger
          ? 'text-gray-500 hover:bg-danger/10 hover:text-danger dark:text-gray-400'
          : 'text-gray-500 hover:bg-white hover:text-accent hover:shadow-xs dark:text-gray-400 dark:hover:bg-white/[0.1] dark:hover:text-accent'
      }`}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {props.children}
      </svg>
    </button>
  );
}
