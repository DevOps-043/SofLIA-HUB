import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { IntegratedBrowserPanel } from './IntegratedBrowserPanel';
import { orbService } from '../../services/orb-service';
import { useModelSelector } from '../../hooks/useModelSelector';
import { ModelSelectorDropdown } from '../../adapters/desktop_ui/chat-ui/header/ModelSelectorDropdown';
import { BrowserConversationMenu, type BrowserConversationItem } from './BrowserConversationMenu';

const CHAT_WIDTH_STORAGE_KEY = 'sofLia_integratedBrowserFloatingChatWidth';
const CHAT_SIDE_STORAGE_KEY = 'sofLia_integratedBrowserFloatingChatSide';
const MIN_CHAT_WIDTH = 332;
const MAX_CHAT_WIDTH = 560;
const PANEL_INSET = 12;
const PANEL_GAP = 12;
const DEFAULT_BROWSER_CONTENT_TOP = 100;

type PanelSide = 'left' | 'right';

interface BrowserWorkspaceLayoutProps {
  chat: ReactNode;
  conversations: BrowserConversationItem[];
  currentConversationId: string | null;
  onClose: () => void;
  onNewChat: () => Promise<void>;
  onSelectConversation: (conversationId: string) => Promise<void>;
}

export function BrowserWorkspaceLayout(props: BrowserWorkspaceLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [preferredChatWidth, setPreferredChatWidth] = useState(readStoredChatWidth);
  const [panelSide, setPanelSide] = useState<PanelSide>(readStoredPanelSide);
  const [chatVisible, setChatVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [browserContentTop, setBrowserContentTop] = useState(DEFAULT_BROWSER_CONTENT_TOP);
  const [orbError, setOrbError] = useState<string | null>(null);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const model = useModelSelector();

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const update = () => setContainerWidth(Math.max(0, Math.round(containerRef.current?.getBoundingClientRect().width ?? 0)));
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    update();
    return () => observer.disconnect();
  }, []);

  const chatWidth = resolveChatWidth(preferredChatWidth, containerWidth);
  const reservedWidth = chatVisible ? chatWidth + PANEL_INSET + PANEL_GAP : 0;
  const viewportInsets = {
    left: panelSide === 'left' ? reservedWidth : 0,
    right: panelSide === 'right' ? reservedWidth : 0,
  };

  const applyChatWidth = useCallback((next: number) => {
    const resolved = resolveChatWidth(next, containerWidth);
    setPreferredChatWidth(resolved);
    localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(resolved));
  }, [containerWidth]);

  const handleBrowserContentTopChange = useCallback((offset: number) => {
    if (!Number.isFinite(offset)) return;
    const next = Math.max(0, Math.round(offset));
    setBrowserContentTop((current) => current === next ? current : next);
  }, []);

  const movePanel = () => {
    const nextSide: PanelSide = panelSide === 'left' ? 'right' : 'left';
    setPanelSide(nextSide);
    localStorage.setItem(CHAT_SIDE_STORAGE_KEY, nextSide);
  };

  const activateOrbMode = async () => {
    try {
      const response = await orbService.show();
      if (!response.success) throw new Error(response.error || 'No se pudo abrir la Orbe.');
      setOrbError(null);
      setChatVisible(false);
    } catch (error) {
      setOrbError(error instanceof Error ? error.message : String(error));
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = panelSide === 'left'
      ? event.clientX - rect.left - PANEL_INSET
      : rect.right - event.clientX - PANEL_INSET;
    applyChatWidth(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    applyChatWidth(chatWidth + direction * (panelSide === 'left' ? 32 : -32));
  };

  const finishResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setIsResizing(false);
  };

  const panelPosition = panelSide === 'left' ? { left: PANEL_INSET } : { right: PANEL_INSET };
  const separatorPosition = panelSide === 'left'
    ? { left: PANEL_INSET + chatWidth }
    : { right: PANEL_INSET + chatWidth };

  return (
    <div
      ref={containerRef}
      className={`relative h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background dark:bg-background-dark ${isResizing ? 'select-none cursor-col-resize' : ''}`}
      data-testid="browser-workspace-layout"
    >
      <section className="absolute inset-0 min-w-0 overflow-hidden" aria-label="Navegador integrado">
        <IntegratedBrowserPanel
          onClose={props.onClose}
          maximized={!chatVisible}
          onToggleMaximize={() => setChatVisible((visible) => !visible)}
          viewportInsets={viewportInsets}
          onContentTopChange={handleBrowserContentTopChange}
          chatVisible={chatVisible}
          onShowChat={() => { setOrbError(null); setChatVisible(true); }}
        />
      </section>

      <section
        className={`absolute z-30 flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card/97 shadow-[0_1.75rem_4.5rem_rgba(2,12,23,0.32)] backdrop-blur-xl transition-[opacity,transform] duration-200 ${chatVisible ? 'visible translate-y-0 opacity-100' : 'pointer-events-none invisible translate-y-2 opacity-0'}`}
        style={{ width: chatWidth, top: browserContentTop + PANEL_INSET, bottom: PANEL_INSET, ...panelPosition }}
        aria-label="Chat flotante con SofLIA"
        aria-hidden={!chatVisible}
      >
        <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3" style={{ fontFamily: 'var(--font-system-ui)' }}>
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              aria-label="Cambiar modelo y razonamiento"
              aria-expanded={model.isModelSelectorOpen}
              onClick={(event) => {
                event.stopPropagation();
                setConversationMenuOpen(false);
                model.setIsModelSelectorOpen(!model.isModelSelectorOpen);
              }}
              className="flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-accent/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
            >
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold leading-tight text-primary dark:text-white">{model.currentModel.name}</span>
                <span className="block truncate text-[9px] leading-tight text-secondary">{model.currentThinkingOption?.name ?? 'Medio'} · Asistente</span>
              </span>
              <svg className={`h-3.5 w-3.5 shrink-0 text-secondary transition ${model.isModelSelectorOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {model.isModelSelectorOpen && <ModelSelectorDropdown model={model} compact />}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <PanelButton label="Usar Modo Orbe" onClick={() => void activateOrbMode()}>
              <circle cx="12" cy="12" r="6" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            </PanelButton>
            <PanelButton
              label={`Mover panel a la ${panelSide === 'left' ? 'derecha' : 'izquierda'}`}
              onClick={movePanel}
            >
              <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M4 12h16" />
            </PanelButton>
            <PanelButton label="Minimizar panel de SofLIA" onClick={() => setChatVisible(false)}>
              <path d="M6 12h12" />
            </PanelButton>
            <BrowserConversationMenu
              conversations={props.conversations}
              currentConversationId={props.currentConversationId}
              open={conversationMenuOpen}
              onOpenChange={(open) => {
                if (open) model.setIsModelSelectorOpen(false);
                setConversationMenuOpen(open);
              }}
              onNewChat={props.onNewChat}
              onSelectConversation={props.onSelectConversation}
            />
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {props.chat}
        </div>
      </section>

      {orbError && (
        <div role="alert" className="absolute bottom-4 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-2xl border border-danger/20 bg-card/95 px-4 py-2 text-sm text-danger shadow-xl backdrop-blur-xl">
          {orbError}
        </div>
      )}

      {chatVisible && (
        <div
          role="separator"
          aria-label="Ajustar ancho del panel de SofLIA"
          aria-orientation="vertical"
          aria-valuemin={MIN_CHAT_WIDTH}
          aria-valuemax={Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, containerWidth - PANEL_INSET * 2))}
          aria-valuenow={chatWidth}
          aria-valuetext={`Panel de SofLIA ${chatWidth} pixeles`}
          title="Arrastra para ajustar el panel de SofLIA"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
          onLostPointerCapture={() => setIsResizing(false)}
          onKeyDown={handleKeyDown}
          className="group absolute z-40 w-5 translate-x-1/2 cursor-col-resize touch-none outline-none"
          style={{ ...separatorPosition, top: browserContentTop + PANEL_GAP * 2, bottom: PANEL_GAP * 2 }}
        >
          <span
            data-testid="browser-resize-grip"
            className={`absolute left-1/2 top-1/2 grid h-16 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border shadow-lg transition ${isResizing ? 'scale-105 border-accent bg-accent text-on-accent' : 'border-accent/20 bg-card/95 text-secondary group-hover:border-accent group-hover:text-accent group-focus:border-accent group-focus:text-accent'}`}
            aria-hidden="true"
          >
            <svg className="h-5 w-3" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3.5 5v10M8.5 5v10" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );
}

function PanelButton(props: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className="grid h-7 w-7 place-items-center rounded-[9px] text-secondary transition hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {props.children}
      </svg>
    </button>
  );
}

function readStoredChatWidth(): number {
  const value = Number(localStorage.getItem(CHAT_WIDTH_STORAGE_KEY));
  return Number.isFinite(value) && value >= MIN_CHAT_WIDTH ? Math.round(value) : 388;
}

function readStoredPanelSide(): PanelSide {
  return localStorage.getItem(CHAT_SIDE_STORAGE_KEY) === 'right' ? 'right' : 'left';
}

function resolveChatWidth(preferred: number, container: number): number {
  const available = container > 0 ? Math.max(MIN_CHAT_WIDTH, container - PANEL_INSET * 2) : MAX_CHAT_WIDTH;
  return Math.max(MIN_CHAT_WIDTH, Math.min(Math.round(preferred), MAX_CHAT_WIDTH, available));
}
