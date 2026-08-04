import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  EMPTY_INTEGRATED_BROWSER_STATE,
  integratedBrowserService,
  type IntegratedBrowserResponse,
  type IntegratedBrowserState,
} from '../../services/integrated-browser-service';
import { BrowserManagementPanel, type BrowserManagementTab } from './BrowserManagementPanel';

export function IntegratedBrowserPanel(props: { onClose?: () => void; maximized?: boolean; onToggleMaximize?: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const addressEditingRef = useRef(false);
  const [state, setState] = useState<IntegratedBrowserState>(EMPTY_INTEGRATED_BROWSER_STATE);
  const [address, setAddress] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [managementTab, setManagementTab] = useState<BrowserManagementTab | null>(null);

  const consumeResponse = useCallback((response: IntegratedBrowserResponse) => {
    if (!response.success) {
      setLocalError(response.error || 'No se pudo completar la operacion.');
      return;
    }
    setLocalError(null);
    if (response.state) setState(response.state);
  }, []);

  const publishViewport = useCallback(async () => {
    const element = viewportRef.current;
    if (!element || !integratedBrowserService.isAvailable()) return;
    const rect = element.getBoundingClientRect();
    if (rect.width < 160 || rect.height < 120) return;
    const response = await integratedBrowserService.setViewport({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    consumeResponse(response);
  }, [consumeResponse]);

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
    const observer = new ResizeObserver(() => { void publishViewport(); });
    if (viewportRef.current) observer.observe(viewportRef.current);
    const handleWindowResize = () => { void publishViewport(); };
    window.addEventListener('resize', handleWindowResize);

    void publishViewport();
    void integratedBrowserService.open().then((response) => {
      consumeResponse(response);
      if (response.state?.url && response.state.url !== 'about:blank') setAddress(response.state.url);
    }).catch((error) => setLocalError(error instanceof Error ? error.message : String(error)));

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      unsubscribe();
      void integratedBrowserService.hide().catch(() => undefined);
    };
  }, [consumeResponse, publishViewport]);

  const run = useCallback(async (operation: () => Promise<IntegratedBrowserResponse>) => {
    try {
      consumeResponse(await operation());
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }, [consumeResponse]);

  const handleNavigate = (event: FormEvent) => {
    event.preventDefault();
    void run(() => integratedBrowserService.navigate(address));
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-background dark:bg-background-dark" aria-label="Navegador integrado">
      <header className="flex flex-col gap-2 border-b border-gray-200/80 bg-white/90 px-3 py-2 dark:border-white/[0.08] dark:bg-[#0d1117]/95">
        <div className="flex items-center gap-2">
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
          <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={handleNavigate}>
            <label className="sr-only" htmlFor="integrated-browser-address">Direccion o busqueda</label>
            <input
              id="integrated-browser-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              onFocus={(event) => {
                addressEditingRef.current = true;
                event.currentTarget.select();
              }}
              onBlur={() => { addressEditingRef.current = false; }}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              placeholder="Busca o escribe una direccion"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="rounded-xl bg-[#0A2540] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2F4D] dark:bg-accent dark:text-on-accent">
              Ir
            </button>
          </form>
          <ManagementButton label="Historial" active={managementTab === 'history'} onClick={() => setManagementTab((current) => current === 'history' ? null : 'history')}>H</ManagementButton>
          <ManagementButton label="Contrasenas" active={managementTab === 'credentials'} onClick={() => setManagementTab((current) => current === 'credentials' ? null : 'credentials')}>C</ManagementButton>
          <ManagementButton label="Extensiones" active={managementTab === 'extensions'} onClick={() => setManagementTab((current) => current === 'extensions' ? null : 'extensions')}>E</ManagementButton>
          {props.onToggleMaximize && <ManagementButton label={props.maximized ? 'Restaurar panel' : 'Expandir navegador'} onClick={props.onToggleMaximize}>{props.maximized ? '↙' : '↗'}</ManagementButton>}
          {props.onClose && <ManagementButton label="Cerrar navegador" onClick={props.onClose}>×</ManagementButton>}
        </div>
        <div className="flex min-h-5 items-center justify-between gap-3 px-1 text-xs">
          <span className="truncate text-gray-500 dark:text-white/50">{state.title || 'Navegador'}</span>
          {state.agentControlling && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> SofLIA esta usando el navegador
            </span>
          )}
        </div>
        {(localError || state.error) && (
          <div role="alert" className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger">
            {localError || state.error}
          </div>
        )}
      </header>
      {managementTab && <BrowserManagementPanel tab={managementTab} />}
      <div ref={viewportRef} className="relative min-h-0 flex-1 bg-white dark:bg-[#111820]" data-testid="integrated-browser-viewport">
        {state.isLoading && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-accent/15">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
          </div>
        )}
        <div className="grid h-full place-items-center text-sm text-gray-400 dark:text-white/30">
          Preparando navegador seguro...
        </div>
      </div>
    </section>
  );
}

function ManagementButton(props: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className={`grid h-9 min-w-9 place-items-center rounded-xl px-2 text-xs font-bold transition ${props.active ? 'bg-accent/12 text-accent' : 'text-gray-600 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-white/[0.06]'}`}
    >
      {props.children}
    </button>
  );
}

function BrowserIconButton(props: {
  label: string;
  disabled?: boolean;
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
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-white/70 dark:hover:bg-white/[0.06]"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {props.children}
      </svg>
    </button>
  );
}
